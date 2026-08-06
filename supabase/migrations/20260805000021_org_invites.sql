-- Luồng mời thành viên vào tổ chức đấu giá.
--
-- Bối cảnh:
--   • organization_memberships đã có sẵn PENDING_INVITE / invite_token /
--     invite_email từ 10/2025 nhưng CHƯA CÓ UI nào tạo lời mời. Code nhận lời mời
--     duy nhất nằm ở src/pages/Auth.tsx và redirect về /broker/dashboard — route
--     không tồn tại. Migration này dựng phần server còn thiếu.
--   • KHÔNG gửi email: dự án chưa có hạ tầng gửi mail (không Resend/SMTP, email
--     marketing vẫn là stub). Lời mời trả về token để người mời tự copy link gửi
--     tay — đúng pattern admin đang dùng ở CreateUserDialog.
--   • Quy tắc kích hoạt: mời được MỌI email (dialog chỉ cảnh báo), nhưng
--     accept_org_invite CHẶN CỨNG khi profiles.activated = false.
--
-- Mọi RPC là SECURITY DEFINER vì RLS profiles (users_share_org đòi cả hai
-- membership ACTIVE) chặn chủ tổ chức đọc profile của người chưa vào tổ chức.

ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- UNIQUE(user_id, organization_id) sẵn có KHÔNG bắt được lời mời trùng: Postgres
-- coi mọi NULL là khác nhau, mà lời mời chờ luôn có user_id IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_pending_invite_email
  ON public.organization_memberships (organization_id, lower(invite_email))
  WHERE user_id IS NULL AND status = 'PENDING_INVITE';

-- ─── 1. Kiểm tra email trước khi mời ────────────────────────────────────────
-- Chỉ trả 5 boolean, không trả tên/id ⇒ không thành oracle dò email.
CREATE OR REPLACE FUNCTION public.org_check_invite_email(_org_id UUID, _email TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _pid       UUID;
  _activated BOOLEAN;
  _status    TEXT;
  _already   BOOLEAN;
  _pending   BOOLEAN;
BEGIN
  IF NOT public.org_has_permission(_org_id, 'thanh-vien', 'create') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT p.id, p.activated, p.status
    INTO _pid, _activated, _status
    FROM public.profiles p
   WHERE lower(p.email) = lower(_email)
   LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships m
     WHERE m.organization_id = _org_id AND m.user_id = _pid
  ) INTO _already;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships m
     WHERE m.organization_id = _org_id
       AND m.user_id IS NULL
       AND m.status = 'PENDING_INVITE'
       AND lower(m.invite_email) = lower(_email)
  ) INTO _pending;

  RETURN jsonb_build_object(
    'exists',         _pid IS NOT NULL,
    'activated',      COALESCE(_activated, false),
    'locked',         COALESCE(_status, 'active') = 'locked',
    'already_member', COALESCE(_already, false),
    'pending_invite', COALESCE(_pending, false)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.org_check_invite_email(UUID, TEXT) TO authenticated;

-- ─── 2. Tạo lời mời ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_org_invite(
  _org_id  UUID,
  _email   TEXT,
  _role_id UUID,
  _days    INT DEFAULT 14
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tok      TEXT;
  _id       UUID;
  _code     TEXT;
  _role_org UUID;
  _expires  TIMESTAMPTZ;
BEGIN
  IF NOT public.org_has_permission(_org_id, 'thanh-vien', 'create') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _email IS NULL OR _email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT organization_id, code INTO _role_org, _code
    FROM public.org_roles WHERE id = _role_id;
  IF _role_org IS DISTINCT FROM _org_id THEN
    RAISE EXCEPTION 'role_not_in_org';
  END IF;
  -- Chỉ Chủ sở hữu mới mời được Chủ sở hữu (chặn leo thang từ Quản lý).
  IF _code = 'OWNER' AND NOT public.org_is_owner(_org_id) THEN
    RAISE EXCEPTION 'owner_role_forbidden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.organization_id = _org_id AND lower(p.email) = lower(_email)
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  _tok     := encode(gen_random_bytes(24), 'hex');
  _expires := now() + make_interval(days => _days);

  INSERT INTO public.organization_memberships
    (user_id, organization_id, role_id, status, invited_by,
     invite_token, invite_email, invite_expires_at)
  VALUES (NULL, _org_id, _role_id, 'PENDING_INVITE', auth.uid(),
          _tok, lower(_email), _expires)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('id', _id, 'token', _tok, 'expires_at', _expires);
END; $$;
GRANT EXECUTE ON FUNCTION public.create_org_invite(UUID, TEXT, UUID, INT) TO authenticated;

-- ─── 3. Xem trước lời mời (trang chấp nhận, TRƯỚC khi đăng nhập) ────────────
CREATE OR REPLACE FUNCTION public.get_org_invite_preview(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE m RECORD;
BEGIN
  SELECT om.id, om.status, om.user_id, om.invite_email, om.invite_expires_at,
         o.name AS org_name, r.name AS role_name
    INTO m
    FROM public.organization_memberships om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN public.org_roles     r ON r.id = om.role_id
   WHERE om.invite_token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok',           true,
    'org_name',     m.org_name,
    'role_name',    m.role_name,
    'invite_email', m.invite_email,
    'claimed',      m.user_id IS NOT NULL OR m.status <> 'PENDING_INVITE',
    'expired',      m.invite_expires_at IS NOT NULL AND m.invite_expires_at < now()
  );
END; $$;
-- anon: trang /loi-moi/:token phải hiện tên tổ chức trước khi người dùng đăng nhập.
GRANT EXECUTE ON FUNCTION public.get_org_invite_preview(TEXT) TO anon, authenticated;

-- ─── 4. Chấp nhận lời mời — CHẶN CỨNG nếu tài khoản chưa kích hoạt ──────────
-- Trả {ok:false, reason} thay vì RAISE cho các lỗi DỰ KIẾN ĐƯỢC, để toàn bộ câu
-- chữ tiếng Việt nằm một chỗ ở UI thay vì phải parse chuỗi lỗi Postgres.
CREATE OR REPLACE FUNCTION public.accept_org_invite(
  _token                   TEXT,
  _confirm_email_mismatch  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m           RECORD;
  _my_email   TEXT;
  _activated  BOOLEAN;
  _my_status  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT p.email, p.activated, p.status
    INTO _my_email, _activated, _my_status
    FROM public.profiles p WHERE p.id = auth.uid();

  -- FOR UPDATE: chống hai người bấm chấp nhận cùng một token đồng thời.
  SELECT * INTO m
    FROM public.organization_memberships
   WHERE invite_token = _token
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF m.user_id IS NOT NULL OR m.status <> 'PENDING_INVITE' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;
  IF m.invite_expires_at IS NOT NULL AND m.invite_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF COALESCE(_my_status, 'active') = 'locked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;
  IF lower(COALESCE(m.invite_email, '')) <> lower(COALESCE(_my_email, ''))
     AND NOT _confirm_email_mismatch THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_mismatch',
                              'invite_email', m.invite_email);
  END IF;

  -- Cổng kích hoạt: đây là chỗ duy nhất chặn, và chặn ở SERVER.
  IF NOT COALESCE(_activated, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_activated');
  END IF;

  -- Đã là thành viên (được thêm bằng đường khác trong lúc chờ) ⇒ tiêu thụ luôn
  -- lời mời cũ để nó không treo lại trong danh sách "Đang mời".
  IF EXISTS (
    SELECT 1 FROM public.organization_memberships x
     WHERE x.organization_id = m.organization_id AND x.user_id = auth.uid()
  ) THEN
    DELETE FROM public.organization_memberships WHERE id = m.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member',
                              'organization_id', m.organization_id);
  END IF;

  UPDATE public.organization_memberships
     SET user_id           = auth.uid(),
         status            = 'ACTIVE',
         joined_at         = now(),
         invite_token      = NULL,
         invite_email      = NULL,
         invite_expires_at = NULL,
         updated_at        = now()
   WHERE id = m.id;

  RETURN jsonb_build_object('ok', true, 'organization_id', m.organization_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(TEXT, BOOLEAN) TO authenticated;

-- ─── 5. Thu hồi / cấp lại lời mời ───────────────────────────────────────────
-- Thay cho "gửi lại email" vốn không tồn tại: đổi token + gia hạn, người mời
-- copy link mới.
CREATE OR REPLACE FUNCTION public.revoke_org_invite(_membership_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _org UUID; _st TEXT;
BEGIN
  SELECT organization_id, status INTO _org, _st
    FROM public.organization_memberships WHERE id = _membership_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st <> 'PENDING_INVITE' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF NOT public.org_has_permission(_org, 'thanh-vien', 'delete')
     AND NOT public.org_has_permission(_org, 'thanh-vien', 'create') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM public.organization_memberships WHERE id = _membership_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.revoke_org_invite(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rotate_org_invite(_membership_id UUID, _days INT DEFAULT 14)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _org UUID; _st TEXT; _tok TEXT; _expires TIMESTAMPTZ;
BEGIN
  SELECT organization_id, status INTO _org, _st
    FROM public.organization_memberships WHERE id = _membership_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _st <> 'PENDING_INVITE' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF NOT public.org_has_permission(_org, 'thanh-vien', 'create') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  _tok     := encode(gen_random_bytes(24), 'hex');
  _expires := now() + make_interval(days => _days);

  UPDATE public.organization_memberships
     SET invite_token = _tok, invite_expires_at = _expires, updated_at = now()
   WHERE id = _membership_id;

  RETURN jsonb_build_object('token', _tok, 'expires_at', _expires);
END; $$;
GRANT EXECUTE ON FUNCTION public.rotate_org_invite(UUID, INT) TO authenticated;

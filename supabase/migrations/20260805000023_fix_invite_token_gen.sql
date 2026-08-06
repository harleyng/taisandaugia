-- Sửa sinh token lời mời.
--
-- create_org_invite/rotate_org_invite dùng gen_random_bytes() — hàm này thuộc
-- extension pgcrypto, ở Supabase được cài trong schema "extensions". Cả hai hàm
-- lại khai báo SET search_path = public (bắt buộc, để SECURITY DEFINER an toàn)
-- nên không nhìn thấy nó ⇒ mọi lần tạo lời mời đều lỗi
-- "function gen_random_bytes(integer) does not exist".
--
-- Thay bằng gen_random_uuid(): hàm LÕI của PostgreSQL 13+ (pg_catalog), luôn
-- gọi được bất kể search_path. Ghép 2 UUID bỏ dấu gạch = 64 ký tự hex (256 bit)
-- — mạnh hơn 48 ký tự của bản cũ, và không phụ thuộc extension nào.

CREATE OR REPLACE FUNCTION public.org_new_invite_token()
RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

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

  _tok     := public.org_new_invite_token();
  _expires := now() + make_interval(days => _days);

  INSERT INTO public.organization_memberships
    (user_id, organization_id, role_id, status, invited_by,
     invite_token, invite_email, invite_expires_at)
  VALUES (NULL, _org_id, _role_id, 'PENDING_INVITE', auth.uid(),
          _tok, lower(_email), _expires)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('id', _id, 'token', _tok, 'expires_at', _expires);
END; $$;

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

  _tok     := public.org_new_invite_token();
  _expires := now() + make_interval(days => _days);

  UPDATE public.organization_memberships
     SET invite_token = _tok, invite_expires_at = _expires, updated_at = now()
   WHERE id = _membership_id;

  RETURN jsonb_build_object('token', _tok, 'expires_at', _expires);
END; $$;

GRANT EXECUTE ON FUNCTION public.org_new_invite_token()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_org_invite(UUID, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_org_invite(UUID, INT)            TO authenticated;

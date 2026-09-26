-- Lời mời + quản lý thành viên không gian chủ tài sản — Phase 3 của
-- docs/owner-control-tower-plan.md (mục A2).
--
-- Phase 2 đặt bảng thành viên nhưng thành viên chỉ ĐỌC được: mọi policy GHI trên
-- workspace / claims / chi nhánh và run_workspace_match vẫn là
-- owner_user_id = auth.uid() (chỉ người tạo). Migration này:
--   1. owner_ws_can có thêm action 'manage_workspace' (Trưởng đơn vị): chi nhánh,
--      alias, khớp lại tài sản. 'manage_members' vẫn chỉ nghĩa là "thành viên".
--   2. Bảng lời mời + RPC mời / chấp nhận / đổi vai trò / gỡ / thu hồi / liệt kê.
--   3. Chuyển quyền GHI sang vai trò; bỏ hẳn 3 policy owner_user_id.
--   4. Ghi bảng thành viên CHỈ qua RPC (bỏ policy ghi trực tiếp của Phase 2):
--      policy trực tiếp cho phép thêm người không cần họ đồng ý, tự đổi vai trò
--      của mình và bỏ qua khoá dòng chống "hai owner gỡ nhau".
--
-- Lời mời chỉ mang vai trò staff / viewer. Trưởng đơn vị thứ hai được tạo bằng
-- cách đổi vai trò SAU khi người đó đã tham gia ⇒ trigger guard của Phase 2
-- (chỉ owner mới trao owner) giữ nguyên, không cần ngoại lệ cho người được mời.
--
-- Email lời mời phải KHỚP CỨNG email tài khoản (khác lời mời tổ chức vốn cho
-- xác nhận 2 bước). Lưu ý: dự án tắt xác thực email ⇒ khớp email KHÔNG chứng
-- minh sở hữu hộp thư — chính liên kết là bí mật.
--
-- Mọi RPC ghi khoá dòng workspace trước (SELECT … FOR UPDATE) rồi mới kiểm
-- quyền: trigger "còn ít nhất một owner" đếm không khoá, hai owner gỡ nhau cùng
-- lúc sẽ cùng lọt nếu không tuần tự hoá theo workspace.

-- ─── 1. owner_ws_can + 'manage_workspace' ───────────────────────────────────
-- Cùng chữ ký ⇒ CREATE OR REPLACE giữ nguyên quyền EXECUTE đã cấp ở Phase 2.
-- Bản sao phía client: src/lib/ownerWorkspace/roles.ts (ownerWsCan).

CREATE OR REPLACE FUNCTION public.owner_ws_can(p_workspace_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    CASE public.owner_ws_role(p_workspace_id)
      WHEN 'owner'  THEN p_action IN ('read', 'write', 'manage_members', 'manage_workspace', 'send_report')
      WHEN 'staff'  THEN p_action IN ('read', 'write')
      WHEN 'viewer' THEN p_action = 'read'
    END,
    false
  )
$$;

-- ─── 2. Quyền ghi một claim ─────────────────────────────────────────────────
-- Chi nhánh của claim = workspace_branches cùng không gian có cùng asset_owner_id
-- (UNIQUE(workspace_id, asset_owner_id) ⇒ tối đa một dòng). Claim không thuộc
-- chi nhánh nào ⇒ NULL ⇒ chỉ người không bị giới hạn phạm vi được ghi.
-- Dùng trong policy ⇒ authenticated phải gọi được.
-- Bản sao phía client: canWriteClaim trong src/lib/ownerWorkspace/roles.ts.

CREATE OR REPLACE FUNCTION public.owner_ws_claim_write_ok(p_workspace_id UUID, p_asset_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_can(p_workspace_id, 'write')
     AND public.owner_ws_branch_ok(
           p_workspace_id,
           (SELECT wb.id
              FROM public.workspace_branches wb
             WHERE wb.workspace_id = p_workspace_id
               AND wb.asset_owner_id = p_asset_owner_id)
         )
$$;

REVOKE ALL ON FUNCTION public.owner_ws_claim_write_ok(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_claim_write_ok(UUID, UUID) TO authenticated;

-- Nội bộ: mọi phần tử phạm vi khác NULL và là chi nhánh của không gian này.
-- Chỉ gọi từ các RPC SECURITY DEFINER ⇒ thu hồi cả authenticated.
CREATE OR REPLACE FUNCTION public.owner_ws_scope_valid(p_workspace_id UUID, p_scope UUID[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT cardinality(p_scope) > 0
     AND NOT EXISTS (
       SELECT 1 FROM unnest(p_scope) AS s(branch_id)
        WHERE s.branch_id IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM public.workspace_branches wb
              WHERE wb.id = s.branch_id AND wb.workspace_id = p_workspace_id
           )
     )
$$;

REVOKE ALL ON FUNCTION public.owner_ws_scope_valid(UUID, UUID[]) FROM PUBLIC, anon, authenticated;

-- ─── 3. Bảng lời mời ────────────────────────────────────────────────────────

CREATE TABLE public.asset_owner_workspace_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- 2 × uuid v4 (~244 bit ngẫu nhiên). Không dùng gen_random_bytes: pgcrypto nằm
  -- ở schema extensions, không thấy được dưới SET search_path = public.
  token         TEXT NOT NULL UNIQUE
                DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  email         TEXT NOT NULL CHECK (email <> '' AND email = lower(btrim(email))),
  role          TEXT NOT NULL CHECK (role IN ('staff', 'viewer')),
  -- Phạm vi chỉ có nghĩa với Cán bộ (Người xem đọc toàn không gian). NULL = toàn bộ.
  branch_scope  UUID[],
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  invited_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at   TIMESTAMPTZ,
  accepted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aowi_scope_staff_only
    CHECK (branch_scope IS NULL OR (role = 'staff' AND cardinality(branch_scope) > 0)),
  CONSTRAINT aowi_single_outcome CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);

-- Một lời mời đang chờ cho mỗi email trong một không gian.
CREATE UNIQUE INDEX uniq_aowi_pending_email
  ON public.asset_owner_workspace_invites (workspace_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_aowi_workspace_id ON public.asset_owner_workspace_invites (workspace_id);
CREATE INDEX idx_aowi_invited_by   ON public.asset_owner_workspace_invites (invited_by);
CREATE INDEX idx_aowi_accepted_by  ON public.asset_owner_workspace_invites (accepted_by);

ALTER TABLE public.asset_owner_workspace_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asset_owner_workspace_invites FROM anon;

-- Chỉ người quản lý thành viên thấy lời mời (có token để sao chép liên kết).
-- Không có policy ghi: mọi thay đổi đi qua RPC bên dưới.
CREATE POLICY "asset_owner_workspace_invites_manager_read" ON public.asset_owner_workspace_invites
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_members'));

-- ─── 4. RPC ─────────────────────────────────────────────────────────────────
-- Lỗi nghiệp vụ trả {ok:false, reason}; RAISE chỉ cho tình huống bất thường.
-- Bảng lý do ↔ thông điệp: src/lib/ownerWorkspace/errors.ts.

-- 4a. Mời
CREATE OR REPLACE FUNCTION public.owner_ws_create_invite(
  p_workspace_id UUID,
  p_email        TEXT,
  p_role         TEXT,
  p_branch_scope UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _email TEXT := lower(btrim(COALESCE(p_email, '')));
  _scope UUID[];
  _inv   public.asset_owner_workspace_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_can(p_workspace_id, 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF _email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('staff', 'viewer') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_role');
  END IF;

  IF p_role = 'staff' AND COALESCE(cardinality(p_branch_scope), 0) > 0 THEN
    _scope := ARRAY(SELECT DISTINCT s FROM unnest(p_branch_scope) AS s);
    IF NOT public.owner_ws_scope_valid(p_workspace_id, _scope) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.asset_owner_workspace_members m
      JOIN public.profiles p ON p.id = m.user_id
     WHERE m.workspace_id = p_workspace_id
       AND m.status = 'active'
       AND lower(btrim(p.email)) = _email
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member');
  END IF;

  -- Lời mời hết hạn không được chặn việc mời lại.
  UPDATE public.asset_owner_workspace_invites
     SET revoked_at = now()
   WHERE workspace_id = p_workspace_id
     AND email = _email
     AND accepted_at IS NULL
     AND revoked_at IS NULL
     AND expires_at <= now();

  BEGIN
    INSERT INTO public.asset_owner_workspace_invites
      (workspace_id, email, role, branch_scope, invited_by)
    VALUES (p_workspace_id, _email, p_role, _scope, _uid)
    RETURNING * INTO _inv;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_invited');
  END;

  RETURN jsonb_build_object(
    'ok', true, 'id', _inv.id, 'token', _inv.token, 'expires_at', _inv.expires_at
  );
END;
$$;

-- 4b. Xem trước lời mời (trang /loi-moi-chu-tai-san/:token, cả khi chưa đăng nhập).
-- Không trả id / token / workspace_id. Người mời không còn là Trưởng đơn vị
-- đang hoạt động ⇒ coi như đã thu hồi.
CREATE OR REPLACE FUNCTION public.owner_ws_invite_preview(p_token TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'ok',             true,
              'workspace_name', w.primary_name,
              'role',           i.role,
              'invite_email',   i.email,
              'expired',        i.expires_at <= now(),
              'accepted',       i.accepted_at IS NOT NULL,
              'accepted_by_me', i.accepted_at IS NOT NULL
                                AND auth.uid() IS NOT NULL
                                AND i.accepted_by = auth.uid(),
              'revoked',        i.revoked_at IS NOT NULL
                                OR NOT EXISTS (
                                  SELECT 1 FROM public.asset_owner_workspace_members m
                                   WHERE m.workspace_id = i.workspace_id
                                     AND m.user_id = i.invited_by
                                     AND m.role = 'owner'
                                     AND m.status = 'active'
                                )
            )
       FROM public.asset_owner_workspace_invites i
       JOIN public.asset_owner_workspaces w ON w.id = i.workspace_id
      WHERE i.token = p_token),
    jsonb_build_object('ok', false, 'reason', 'not_found')
  )
$$;

-- 4c. Chấp nhận
CREATE OR REPLACE FUNCTION public.owner_ws_accept_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid       UUID := auth.uid();
  _inv       public.asset_owner_workspace_invites%ROWTYPE;
  _existing  public.asset_owner_workspace_members%ROWTYPE;
  _email     TEXT;
  _activated BOOLEAN;
  _status    TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Cùng thứ tự khoá với các RPC khác: workspace trước, rồi tới lời mời.
  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _inv.workspace_id FOR UPDATE;
  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE id = _inv.id FOR UPDATE;

  IF _inv.accepted_at IS NOT NULL THEN
    IF _inv.accepted_by = _uid THEN
      RETURN jsonb_build_object('ok', true, 'workspace_id', _inv.workspace_id, 'already_member', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_accepted');
  END IF;

  IF _inv.revoked_at IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM public.asset_owner_workspace_members m
     WHERE m.workspace_id = _inv.workspace_id
       AND m.user_id = _inv.invited_by
       AND m.role = 'owner'
       AND m.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  IF _inv.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT p.email, p.activated, p.status
    INTO _email, _activated, _status
    FROM public.profiles p WHERE p.id = _uid;

  IF COALESCE(_status, 'active') = 'locked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;

  IF lower(btrim(COALESCE(_email, ''))) <> _inv.email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_mismatch', 'invite_email', _inv.email);
  END IF;

  IF NOT COALESCE(_activated, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_activated');
  END IF;

  -- Chi nhánh trong phạm vi đã bị xoá sau khi mời ⇒ KHÔNG nới thành toàn không gian.
  IF _inv.branch_scope IS NOT NULL
     AND NOT public.owner_ws_scope_valid(_inv.workspace_id, _inv.branch_scope) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope');
  END IF;

  SELECT * INTO _existing
    FROM public.asset_owner_workspace_members
   WHERE workspace_id = _inv.workspace_id AND user_id = _uid
   FOR UPDATE;

  IF FOUND AND _existing.status = 'active' THEN
    UPDATE public.asset_owner_workspace_invites
       SET accepted_at = now(), accepted_by = _uid
     WHERE id = _inv.id;
    RETURN jsonb_build_object('ok', true, 'workspace_id', _inv.workspace_id, 'already_member', true);
  END IF;

  -- Dòng cũ đã gỡ / chưa kích hoạt: xoá rồi thêm mới. UPDATE một dòng từng là
  -- owner sẽ bị guard coi là "thu hồi vai trò owner" và chặn người được mời.
  IF FOUND THEN
    DELETE FROM public.asset_owner_workspace_members WHERE id = _existing.id;
  END IF;

  INSERT INTO public.asset_owner_workspace_members
    (workspace_id, user_id, role, branch_scope, status, invited_by, joined_at)
  VALUES
    (_inv.workspace_id, _uid, _inv.role, _inv.branch_scope, 'active', _inv.invited_by, now());

  UPDATE public.asset_owner_workspace_invites
     SET accepted_at = now(), accepted_by = _uid
   WHERE id = _inv.id;

  RETURN jsonb_build_object('ok', true, 'workspace_id', _inv.workspace_id);
END;
$$;

-- 4d. Đổi vai trò / phạm vi
CREATE OR REPLACE FUNCTION public.owner_ws_update_member(
  p_member_id    UUID,
  p_role         TEXT,
  p_branch_scope UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _m     public.asset_owner_workspace_members%ROWTYPE;
  _scope UUID[];
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _m.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_can(_m.workspace_id, 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Đọc lại sau khi khoá: một giao dịch khác có thể vừa đổi dòng này.
  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR _m.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _m.user_id = _uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_change_self');
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('owner', 'staff', 'viewer') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_role');
  END IF;

  IF p_role = 'staff' AND COALESCE(cardinality(p_branch_scope), 0) > 0 THEN
    _scope := ARRAY(SELECT DISTINCT s FROM unnest(p_branch_scope) AS s);
    IF NOT public.owner_ws_scope_valid(_m.workspace_id, _scope) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope');
    END IF;
  END IF;

  -- Người gọi là owner khác ⇒ luôn còn owner; giữ kiểm tra này làm lưới an toàn.
  IF _m.role = 'owner' AND p_role <> 'owner' AND NOT EXISTS (
    SELECT 1 FROM public.asset_owner_workspace_members o
     WHERE o.workspace_id = _m.workspace_id AND o.role = 'owner'
       AND o.status = 'active' AND o.id <> _m.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'last_owner');
  END IF;

  UPDATE public.asset_owner_workspace_members
     SET role = p_role, branch_scope = _scope
   WHERE id = _m.id;

  -- Hết là Trưởng đơn vị ⇒ các lời mời người này gửi mà chưa dùng cũng hết hiệu lực.
  IF _m.role = 'owner' AND p_role <> 'owner' THEN
    UPDATE public.asset_owner_workspace_invites
       SET revoked_at = now()
     WHERE workspace_id = _m.workspace_id AND invited_by = _m.user_id
       AND accepted_at IS NULL AND revoked_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4e. Gỡ khỏi không gian (xoá mềm: status = 'removed')
CREATE OR REPLACE FUNCTION public.owner_ws_remove_member(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _m   public.asset_owner_workspace_members%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _m.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_can(_m.workspace_id, 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR _m.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _m.user_id = _uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_remove_self');
  END IF;

  IF _m.role = 'owner' AND NOT EXISTS (
    SELECT 1 FROM public.asset_owner_workspace_members o
     WHERE o.workspace_id = _m.workspace_id AND o.role = 'owner'
       AND o.status = 'active' AND o.id <> _m.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'last_owner');
  END IF;

  UPDATE public.asset_owner_workspace_members SET status = 'removed' WHERE id = _m.id;

  UPDATE public.asset_owner_workspace_invites
     SET revoked_at = now()
   WHERE workspace_id = _m.workspace_id AND invited_by = _m.user_id
     AND accepted_at IS NULL AND revoked_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4f. Thu hồi lời mời đang chờ
CREATE OR REPLACE FUNCTION public.owner_ws_revoke_invite(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _inv public.asset_owner_workspace_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.owner_ws_can(_inv.workspace_id, 'manage_members') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE id = p_invite_id FOR UPDATE;
  IF _inv.accepted_at IS NOT NULL OR _inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.asset_owner_workspace_invites SET revoked_at = now() WHERE id = _inv.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4g. Danh sách thành viên đang hoạt động kèm tên + email.
-- RLS của profiles không cho thành viên đọc hồ sơ của nhau ⇒ phải đi qua hàm này,
-- chỉ lộ đúng các cột cần hiển thị.
CREATE OR REPLACE FUNCTION public.owner_ws_list_members(p_workspace_id UUID)
RETURNS TABLE (
  member_id    UUID,
  user_id      UUID,
  full_name    TEXT,
  email        TEXT,
  role         TEXT,
  branch_scope UUID[],
  status       TEXT,
  joined_at    TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, p.name, p.email, m.role, m.branch_scope, m.status, m.joined_at
    FROM public.asset_owner_workspace_members m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.workspace_id = p_workspace_id
     AND m.status = 'active'
     AND public.owner_ws_can(p_workspace_id, 'read')
   ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END,
            m.joined_at NULLS LAST,
            p.email
$$;

REVOKE ALL ON FUNCTION public.owner_ws_create_invite(UUID, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_invite_preview(TEXT)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_ws_accept_invite(TEXT)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_update_member(UUID, TEXT, UUID[])      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_remove_member(UUID)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_revoke_invite(UUID)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_list_members(UUID)                     FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_ws_create_invite(UUID, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_invite_preview(TEXT)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_accept_invite(TEXT)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_update_member(UUID, TEXT, UUID[])      TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_remove_member(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_revoke_invite(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_list_members(UUID)                     TO authenticated;

-- ─── 5. Quyền GHI theo vai trò ──────────────────────────────────────────────
-- owner_user_id từ nay chỉ còn nghĩa "người tạo". Người tạo luôn có dòng owner
-- (backfill + trigger Phase 2) nên không mất quyền — trừ khi bị gỡ khỏi không gian,
-- đúng như mong muốn.

DROP POLICY IF EXISTS "asset_owner_workspaces_own_rows"  ON public.asset_owner_workspaces;
DROP POLICY IF EXISTS "asset_owner_claims_via_workspace" ON public.asset_owner_claims;
DROP POLICY IF EXISTS "workspace_branches_via_workspace" ON public.workspace_branches;

DROP POLICY IF EXISTS "asset_owner_workspace_members_insert" ON public.asset_owner_workspace_members;
DROP POLICY IF EXISTS "asset_owner_workspace_members_update" ON public.asset_owner_workspace_members;
DROP POLICY IF EXISTS "asset_owner_workspace_members_delete" ON public.asset_owner_workspace_members;

-- Không gian: chỉ sửa seed khớp tài sản. Tạo mới chỉ qua trigger duyệt KYC
-- (SECURITY DEFINER). Quyền cột giữ owner_user_id / org_kyc_id bất biến
-- (policy cũ WITH CHECK owner_user_id = auth.uid() từng lo việc này).
CREATE POLICY "asset_owner_workspaces_manage_update" ON public.asset_owner_workspaces
  FOR UPDATE TO authenticated
  USING (public.owner_ws_can(id, 'manage_workspace'))
  WITH CHECK (public.owner_ws_can(id, 'manage_workspace'));

REVOKE UPDATE ON public.asset_owner_workspaces FROM authenticated, anon;
GRANT UPDATE (primary_name, abbreviations, branch_names) ON public.asset_owner_workspaces TO authenticated;

-- Chi nhánh: thiết lập không gian ⇒ Trưởng đơn vị.
CREATE POLICY "workspace_branches_manage_insert" ON public.workspace_branches
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_workspace'));

CREATE POLICY "workspace_branches_manage_update" ON public.workspace_branches
  FOR UPDATE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_workspace'))
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_workspace'));

CREATE POLICY "workspace_branches_manage_delete" ON public.workspace_branches
  FOR DELETE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_workspace'));

-- Claims: người có quyền ghi, trong phạm vi chi nhánh của mình.
CREATE POLICY "asset_owner_claims_write_insert" ON public.asset_owner_claims
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_claim_write_ok(workspace_id, asset_owner_id));

CREATE POLICY "asset_owner_claims_write_update" ON public.asset_owner_claims
  FOR UPDATE TO authenticated
  USING (public.owner_ws_claim_write_ok(workspace_id, asset_owner_id))
  WITH CHECK (public.owner_ws_claim_write_ok(workspace_id, asset_owner_id));

CREATE POLICY "asset_owner_claims_write_delete" ON public.asset_owner_claims
  FOR DELETE TO authenticated
  USING (public.owner_ws_claim_write_ok(workspace_id, asset_owner_id));

-- ─── 6. run_workspace_match theo vai trò ────────────────────────────────────
-- Thân hàm giữ nguyên bản 20260805000001; chỉ đổi phép kiểm quyền. Nhánh admin
-- giữ lại: trigger duyệt KYC gọi hàm này dưới JWT của admin. Trước đây anon
-- gọi được (mặc định Supabase cấp EXECUTE cho anon, và auth.uid() IS NULL lọt).

CREATE OR REPLACE FUNCTION public.run_workspace_match(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       public.asset_owner_workspaces%ROWTYPE;
  v_seeds    TEXT[];
  v_inserted INT := 0;
  v_auto     INT := 0;
  v_pending  INT := 0;
BEGIN
  SELECT * INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF v_ws.id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- Trưởng đơn vị, admin, hoặc service_role / trigger (auth.uid() IS NULL)
  IF auth.uid() IS NOT NULL
     AND NOT public.owner_ws_can(p_workspace_id, 'manage_workspace')
     AND NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_seeds := ARRAY(
    SELECT DISTINCT s FROM unnest(
      ARRAY[v_ws.primary_name] || v_ws.abbreviations || v_ws.branch_names
    ) AS s WHERE COALESCE(btrim(s), '') <> ''
  );

  IF COALESCE(array_length(v_seeds, 1), 0) = 0 THEN
    RETURN jsonb_build_object('inserted', 0, 'auto_claimed', 0, 'pending', 0);
  END IF;

  WITH scored AS (
    SELECT o.id AS owner_id, o.name AS owner_name,
           (SELECT max(public.org_name_similarity(o.name, s)) FROM unnest(v_seeds) AS s) AS score
    FROM public.asset_owners o
  ),
  hits AS (SELECT * FROM scored WHERE score >= 0.6),
  ins AS (
    INSERT INTO public.asset_owner_claims
      (workspace_id, listing_id, asset_owner_id, confidence_score, match_basis, matched_name, status)
    SELECT p_workspace_id, l.id, h.owner_id, h.score, 'auto_name', h.owner_name,
           CASE WHEN h.score >= 0.9 THEN 'auto_claimed' ELSE 'pending_confirmation' END
    FROM hits h
    JOIN public.listings l ON l.asset_owner_id = h.owner_id
    ON CONFLICT (workspace_id, listing_id) DO NOTHING
    RETURNING status
  )
  SELECT count(*)::INT,
         count(*) FILTER (WHERE status = 'auto_claimed')::INT,
         count(*) FILTER (WHERE status = 'pending_confirmation')::INT
    INTO v_inserted, v_auto, v_pending
  FROM ins;

  UPDATE public.asset_owner_workspaces
     SET last_matched_at = now(),
         total_claimed = (
           SELECT count(*) FROM public.asset_owner_claims
           WHERE workspace_id = p_workspace_id AND status IN ('auto_claimed','confirmed')
         )
   WHERE id = p_workspace_id;

  RETURN jsonb_build_object('inserted', v_inserted, 'auto_claimed', v_auto, 'pending', v_pending);
END;
$$;

REVOKE ALL ON FUNCTION public.run_workspace_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_workspace_match(UUID) TO authenticated, service_role;

-- ─── 7. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('asset_owner_workspaces', 'asset_owner_claims', 'workspace_branches')
       AND (COALESCE(qual, '') LIKE '%owner_user_id%' OR COALESCE(with_check, '') LIKE '%owner_user_id%')
  ) THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: còn policy dựa trên owner_user_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'asset_owner_workspace_members'
       AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: bảng thành viên còn policy ghi trực tiếp';
  END IF;

  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.asset_owner_workspace_invites'::regclass) THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: bảng lời mời chưa bật RLS';
  END IF;

  IF has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'owner_user_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'org_kyc_id', 'UPDATE') THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: authenticated còn sửa được owner_user_id / org_kyc_id';
  END IF;

  IF has_function_privilege('anon', 'public.owner_ws_create_invite(uuid, text, text, uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_accept_invite(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_update_member(uuid, text, uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_remove_member(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_revoke_invite(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_list_members(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_claim_write_ok(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_scope_valid(uuid, uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.run_workspace_match(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: hàm đang mở cho anon';
  END IF;

  IF has_function_privilege('authenticated', 'public.owner_ws_scope_valid(uuid, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: helper nội bộ owner_ws_scope_valid đang mở cho authenticated';
  END IF;

  IF NOT (has_function_privilege('anon', 'public.owner_ws_invite_preview(text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.owner_ws_claim_write_ok(uuid, uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.owner_ws_accept_invite(text)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: thiếu quyền EXECUTE cần thiết (preview/anon, policy claims, accept)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.asset_owner_workspaces w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.asset_owner_workspace_members m
        WHERE m.workspace_id = w.id AND m.role = 'owner' AND m.status = 'active'
     )
  ) THEN
    RAISE EXCEPTION 'owner_ws P3 self-check: có không gian thiếu Trưởng đơn vị';
  END IF;
END;
$$;

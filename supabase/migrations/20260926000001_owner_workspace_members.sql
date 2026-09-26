-- Thành viên không gian chủ tài sản — Phase 2 của docs/owner-control-tower-plan.md (mục A2).
--
-- Trước đây 1 workspace = 1 owner_user_id, mọi RLS là owner_user_id = auth.uid().
-- Migration này CHỈ đặt nền dữ liệu: bảng thành viên + 3 helper + trigger bảo vệ +
-- quyền ĐỌC cho thành viên. Quyền GHI trên workspace/claims/branches giữ nguyên
-- (vẫn theo owner_user_id) — chuyển sang owner_ws_can ở các phase sau.
--
-- 3 vai trò cố định, chưa có ma trận quyền:
--   owner  "Trưởng đơn vị" : read, write, manage_members, send_report
--   staff  "Cán bộ"        : read, write (ghi giới hạn trong branch_scope)
--   viewer "Người xem"     : read
--
-- Bất biến ép ở DB:
--   • luôn còn ít nhất một owner đang hoạt động (trừ khi xoá dây chuyền);
--   • chỉ owner mới trao / thu hồi vai trò owner.

-- ─── 1. Bảng thành viên ─────────────────────────────────────────────────────

CREATE TABLE public.asset_owner_workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- CASCADE: xoá người dùng không được kẹt vì còn dòng thành viên
  -- (trigger giữ owner cuối cho qua khi hồ sơ/không gian đã biến mất).
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'viewer')),
  -- NULL = toàn bộ không gian. Phần tử là workspace_branches.id cùng không gian.
  branch_scope  UUID[],
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'removed')),
  invited_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id),
  -- '{}' mơ hồ (không chi nhánh nào? hay tất cả?) ⇒ cấm, dùng NULL.
  CONSTRAINT aowm_branch_scope_not_empty CHECK (branch_scope IS NULL OR cardinality(branch_scope) > 0),
  -- Trưởng đơn vị có toàn quyền ⇒ không mang phạm vi chi nhánh.
  CONSTRAINT aowm_owner_unscoped CHECK (role <> 'owner' OR branch_scope IS NULL)
);

CREATE INDEX idx_aowm_user_id ON public.asset_owner_workspace_members (user_id);

CREATE TRIGGER asset_owner_workspace_members_updated_at
  BEFORE UPDATE ON public.asset_owner_workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. Backfill — TRƯỚC khi tạo trigger bảo vệ ─────────────────────────────

INSERT INTO public.asset_owner_workspace_members (workspace_id, user_id, role, status, joined_at)
SELECT w.id, w.owner_user_id, 'owner', 'active', w.created_at
  FROM public.asset_owner_workspaces w
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ─── 3. Helpers ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER ⇒ đọc bảng thành viên bỏ qua RLS ⇒ dùng được ngay trong
-- policy của chính bảng đó mà không đệ quy (cùng thủ thuật org_has_permission).

CREATE OR REPLACE FUNCTION public.owner_ws_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.role
    FROM public.asset_owner_workspace_members m
   WHERE m.workspace_id = p_workspace_id
     AND m.user_id = auth.uid()
     AND m.status = 'active'
$$;

-- Trả false (không bao giờ NULL) cho người ngoài và action lạ.
CREATE OR REPLACE FUNCTION public.owner_ws_can(p_workspace_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    CASE public.owner_ws_role(p_workspace_id)
      WHEN 'owner'  THEN p_action IN ('read', 'write', 'manage_members', 'send_report')
      WHEN 'staff'  THEN p_action IN ('read', 'write')
      WHEN 'viewer' THEN p_action = 'read'
    END,
    false
  )
$$;

-- true nếu người gọi là owner, hoặc không bị giới hạn chi nhánh, hoặc
-- p_branch_id nằm trong phạm vi. Bản ghi không gắn chi nhánh (NULL) ⇒ chỉ
-- người không bị giới hạn mới được đụng.
CREATE OR REPLACE FUNCTION public.owner_ws_branch_ok(p_workspace_id UUID, p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT m.role = 'owner' OR m.branch_scope IS NULL OR p_branch_id = ANY (m.branch_scope)
      FROM public.asset_owner_workspace_members m
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
  ), false)
$$;

REVOKE ALL ON FUNCTION public.owner_ws_role(UUID)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_can(UUID, TEXT)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_branch_ok(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_role(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_can(UUID, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_branch_ok(UUID, UUID) TO authenticated;

-- ─── 4. Trigger kiểm tra khi ghi thành viên ─────────────────────────────────
-- SECURITY DEFINER để các phép đếm không phụ thuộc RLS của người gọi;
-- auth.uid() bên trong vẫn là người gọi.

CREATE OR REPLACE FUNCTION public.owner_ws_members_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _touches_owner BOOLEAN;
  _bootstrap     BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'Không thể chuyển thành viên sang không gian hoặc người dùng khác';
  END IF;

  -- Chỉ kiểm khi phạm vi đổi: chi nhánh bị xoá sau này để lại id "chết" vô hại,
  -- không được chặn các thay đổi khác của dòng.
  IF NEW.branch_scope IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_scope IS DISTINCT FROM OLD.branch_scope)
     AND EXISTS (
       SELECT 1 FROM unnest(NEW.branch_scope) AS b(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.workspace_branches wb
           WHERE wb.id = b.id AND wb.workspace_id = NEW.workspace_id
        )
     ) THEN
    RAISE EXCEPTION 'Phạm vi có chi nhánh không thuộc không gian này';
  END IF;

  IF NEW.status = 'active' AND NEW.joined_at IS NULL THEN
    NEW.joined_at := now();
  END IF;

  -- Trao / thu hồi vai trò owner (kể cả đổi trạng thái của một dòng owner).
  IF TG_OP = 'INSERT' THEN
    _touches_owner := NEW.role = 'owner';
  ELSE
    _touches_owner := (OLD.role = 'owner' OR NEW.role = 'owner')
                      AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status);
  END IF;

  -- auth.uid() NULL = migration / service_role ⇒ cho qua.
  IF _touches_owner
     AND auth.uid() IS NOT NULL
     AND public.owner_ws_role(NEW.workspace_id) IS DISTINCT FROM 'owner' THEN
    -- Khởi tạo: dòng owner đầu tiên cho người tạo không gian (trigger tạo
    -- workspace chạy dưới danh nghĩa admin duyệt KYC — admin không phải owner).
    _bootstrap := TG_OP = 'INSERT'
      AND NEW.status = 'active'
      AND NEW.user_id = (SELECT w.owner_user_id FROM public.asset_owner_workspaces w
                          WHERE w.id = NEW.workspace_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.asset_owner_workspace_members m
         WHERE m.workspace_id = NEW.workspace_id AND m.role = 'owner' AND m.status = 'active'
      );
    IF NOT COALESCE(_bootstrap, false) THEN
      RAISE EXCEPTION 'Chỉ Trưởng đơn vị mới được trao hoặc thu hồi vai trò Trưởng đơn vị';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_workspace_members_guard
  BEFORE INSERT OR UPDATE ON public.asset_owner_workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_members_guard();

-- ─── 5. Trigger: luôn còn ít nhất một Trưởng đơn vị ─────────────────────────
-- Port của org_protect_last_owner (20260805000020). RLS không diễn đạt được
-- ràng buộc "dòng cuối cùng".

CREATE OR REPLACE FUNCTION public.owner_ws_protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _others INT;
BEGIN
  -- Không phải owner đang hoạt động ⇒ không liên quan.
  IF OLD.role <> 'owner' OR OLD.status <> 'active' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- UPDATE không đụng vai trò lẫn trạng thái ⇒ bỏ qua.
  IF TG_OP = 'UPDATE' AND NEW.role = OLD.role AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Xoá dây chuyền (xoá không gian / xoá người dùng): dòng cha đã biến mất
  -- ⇒ cho qua, nếu không ON DELETE CASCADE sẽ chặn cả việc xoá cha.
  IF TG_OP = 'DELETE' AND (
       NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces w WHERE w.id = OLD.workspace_id)
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = OLD.user_id)
  ) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO _others
    FROM public.asset_owner_workspace_members m
   WHERE m.workspace_id = OLD.workspace_id
     AND m.role = 'owner'
     AND m.status = 'active'
     AND m.id <> OLD.id;

  IF _others = 0 THEN
    RAISE EXCEPTION 'Không gian phải còn ít nhất một Trưởng đơn vị đang hoạt động';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER asset_owner_workspace_members_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.asset_owner_workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_protect_last_owner();

-- ─── 6. Không gian mới ⇒ tự có dòng owner ───────────────────────────────────
-- Bao cả create_workspace_on_org_approval mà không phải sửa hàm đó.

CREATE OR REPLACE FUNCTION public.owner_ws_seed_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.asset_owner_workspace_members (workspace_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.owner_user_id, 'owner', 'active', now())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_workspaces_seed_owner_member
  AFTER INSERT ON public.asset_owner_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_seed_owner_member();

-- ─── 7. RLS bảng thành viên ─────────────────────────────────────────────────

ALTER TABLE public.asset_owner_workspace_members ENABLE ROW LEVEL SECURITY;

-- Thành viên đang hoạt động đọc được danh sách; ai cũng đọc được dòng của chính mình.
CREATE POLICY "asset_owner_workspace_members_read" ON public.asset_owner_workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY "asset_owner_workspace_members_insert" ON public.asset_owner_workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_members'));

CREATE POLICY "asset_owner_workspace_members_update" ON public.asset_owner_workspace_members
  FOR UPDATE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_members'))
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_members'));

CREATE POLICY "asset_owner_workspace_members_delete" ON public.asset_owner_workspace_members
  FOR DELETE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_members'));

-- ─── 8. Mở quyền ĐỌC cho thành viên (không đụng policy cũ) ──────────────────
-- Policy permissive cộng dồn bằng OR; quyền ghi vẫn chỉ qua policy owner_user_id cũ.

CREATE POLICY "asset_owner_workspaces_member_read" ON public.asset_owner_workspaces
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(id, 'read'));

CREATE POLICY "asset_owner_claims_member_read" ON public.asset_owner_claims
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY "workspace_branches_member_read" ON public.workspace_branches
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

-- ─── 9. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.asset_owner_workspaces w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.asset_owner_workspace_members m
        WHERE m.workspace_id = w.id AND m.role = 'owner' AND m.status = 'active'
     )
  ) THEN
    RAISE EXCEPTION 'owner_ws self-check: có không gian thiếu Trưởng đơn vị';
  END IF;

  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.asset_owner_workspace_members'::regclass) THEN
    RAISE EXCEPTION 'owner_ws self-check: bảng thành viên chưa bật RLS';
  END IF;

  IF has_function_privilege('anon', 'public.owner_ws_role(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_can(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_ws_branch_ok(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_ws self-check: helper đang mở cho anon';
  END IF;

  IF NOT (has_function_privilege('authenticated', 'public.owner_ws_role(uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.owner_ws_can(uuid, text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.owner_ws_branch_ok(uuid, uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'owner_ws self-check: authenticated không gọi được helper (policy sẽ vỡ)';
  END IF;
END;
$$;

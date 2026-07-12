-- Module "Quản trị" (RBAC cấp nền tảng) — phân quyền chi tiết cho tài khoản admin.
--
-- Bối cảnh:
--   • "Tài khoản quản trị" = user có dòng public.user_roles role='ADMIN'
--     (cổng admin nhị phân hiện có, GIỮ NGUYÊN — vẫn là cổng /admin + edge fn).
--   • Mỗi admin được gán MỘT/NHIỀU vai trò (admin_roles); quyền hiệu lực = hợp
--     các quyền (admin_role_permissions) của mọi vai trò được gán, HOẶC toàn
--     quyền nếu có vai trò hệ thống SUPER_ADMIN.
--   • KHÔNG liên quan bảng organization_roles (RBAC của công ty đấu giá).
--
-- Gồm: 3 bảng + helper SECURITY DEFINER (mô phỏng has_role) + RLS + trigger bảo
-- vệ vai trò hệ thống + RPC thay ma trận quyền (atomic) + seed để không admin
-- nào bị mất quyền khi bật RBAC.

-- ─── 1. Bảng ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, module, action)
);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role
  ON public.admin_role_permissions(role_id);

CREATE TABLE IF NOT EXISTS public.admin_role_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_user
  ON public.admin_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_role
  ON public.admin_role_assignments(role_id);

ALTER TABLE public.admin_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_assignments ENABLE ROW LEVEL SECURITY;

-- ─── 2. Helpers (mô phỏng has_role ↔ user_roles) ─────────────────────────────
-- SECURITY DEFINER ⇒ đọc nội bộ bỏ qua RLS ⇒ không đệ quy khi dùng trong policy.
CREATE OR REPLACE FUNCTION public.admin_is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_role_assignments a
    JOIN public.admin_roles r ON r.id = a.role_id
    WHERE a.user_id = _user_id AND r.code = 'SUPER_ADMIN'
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_has_permission(_module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN'::app_role)
     AND (
       public.admin_is_super_admin(auth.uid())
       OR EXISTS (
         SELECT 1
         FROM public.admin_role_assignments a
         JOIN public.admin_role_permissions p ON p.role_id = a.role_id
         WHERE a.user_id = auth.uid()
           AND p.module = _module
           AND p.action = _action
       )
     )
$$;

GRANT EXECUTE ON FUNCTION public.admin_is_super_admin(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(TEXT, TEXT) TO authenticated;

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
-- Đọc: mọi ADMIN đọc được toàn bộ (để dựng UI quản trị + nạp quyền hiệu lực).
DROP POLICY IF EXISTS "admin_roles_admin_read" ON public.admin_roles;
CREATE POLICY "admin_roles_admin_read" ON public.admin_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "admin_role_permissions_admin_read" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_admin_read" ON public.admin_role_permissions
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "admin_role_assignments_admin_read" ON public.admin_role_assignments;
CREATE POLICY "admin_role_assignments_admin_read" ON public.admin_role_assignments
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Ghi vai trò: gated theo quyền 'vai-tro' (super admin đi tắt trong helper).
DROP POLICY IF EXISTS "admin_roles_insert" ON public.admin_roles;
CREATE POLICY "admin_roles_insert" ON public.admin_roles
  FOR INSERT WITH CHECK (public.admin_has_permission('vai-tro', 'create'));

DROP POLICY IF EXISTS "admin_roles_update" ON public.admin_roles;
CREATE POLICY "admin_roles_update" ON public.admin_roles
  FOR UPDATE USING (public.admin_has_permission('vai-tro', 'update'))
             WITH CHECK (public.admin_has_permission('vai-tro', 'update'));

DROP POLICY IF EXISTS "admin_roles_delete" ON public.admin_roles;
CREATE POLICY "admin_roles_delete" ON public.admin_roles
  FOR DELETE USING (public.admin_has_permission('vai-tro', 'delete'));

-- Ghi ma trận quyền = sửa vai trò → 'vai-tro','update'.
DROP POLICY IF EXISTS "admin_role_permissions_write" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_write" ON public.admin_role_permissions
  FOR ALL USING (public.admin_has_permission('vai-tro', 'update'))
          WITH CHECK (public.admin_has_permission('vai-tro', 'update'));

-- Ghi gán vai trò (phân quyền tài khoản) → 'tai-khoan','update'.
DROP POLICY IF EXISTS "admin_role_assignments_write" ON public.admin_role_assignments;
CREATE POLICY "admin_role_assignments_write" ON public.admin_role_assignments
  FOR ALL USING (public.admin_has_permission('tai-khoan', 'update'))
          WITH CHECK (public.admin_has_permission('tai-khoan', 'update'));

-- ─── 4. Bảo vệ vai trò hệ thống + updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_roles_protect_system()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN RAISE EXCEPTION 'Không thể xóa vai trò hệ thống'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system AND (NEW.code <> OLD.code OR NEW.is_system <> OLD.is_system) THEN
    RAISE EXCEPTION 'Không thể đổi mã / trạng thái vai trò hệ thống';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_admin_roles_protect ON public.admin_roles;
CREATE TRIGGER trg_admin_roles_protect
  BEFORE UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.admin_roles_protect_system();

-- ─── 5. RPC: thay TOÀN BỘ ma trận quyền của một vai trò (atomic) ─────────────
CREATE OR REPLACE FUNCTION public.admin_set_role_permissions(_role_id UUID, _perms JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('vai-tro', 'update') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_roles WHERE id = _role_id AND code = 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'SUPER_ADMIN luôn có toàn quyền, không chỉnh ma trận';
  END IF;

  DELETE FROM public.admin_role_permissions WHERE role_id = _role_id;
  INSERT INTO public.admin_role_permissions (role_id, module, action)
  SELECT _role_id, elem->>'module', elem->>'action'
  FROM jsonb_array_elements(_perms) AS elem
  ON CONFLICT (role_id, module, action) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permissions(UUID, JSONB) TO authenticated;

-- ─── 6. Seed: SUPER_ADMIN + gán cho MỌI admin hiện tại ───────────────────────
INSERT INTO public.admin_roles (name, code, description, is_system)
VALUES ('Quản trị tối cao', 'SUPER_ADMIN', 'Toàn quyền hệ thống. Không thể xóa.', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.admin_role_assignments (user_id, role_id)
SELECT ur.user_id, r.id
FROM public.user_roles ur
JOIN public.admin_roles r ON r.code = 'SUPER_ADMIN'
WHERE ur.role = 'ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;

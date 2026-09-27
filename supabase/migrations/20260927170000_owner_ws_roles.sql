-- Vai trò tuỳ chỉnh của Trạm Điều Hành — BƯỚC A: chỉ THÊM, chưa đổi hành vi.
--
-- Trước đây một Trạm có 3 vai trò cố định (asset_owner_workspace_members.role =
-- owner/staff/viewer, docs/owner-control-tower-plan.md §A2). Từ đây mỗi Trạm có bộ
-- vai trò RIÊNG + ma trận quyền module × thao tác (theo mẫu org_roles của cổng tổ
-- chức: dòng membership CHÍNH LÀ dòng gán, không có bảng gán thứ ba).
--
-- Làm theo 3 bước để frontend đang chạy (và scripts/seed-owner-demo.py) không gãy:
--   A (file này)  bảng vai trò + quyền, seed 3 vai trò mặc định cho mọi Trạm, cột
--                 role_id backfill từ role, trigger đồng bộ 2 chiều role ⇄ role_id,
--                 helper owner_ws_has*. Quyền thật VẪN do owner_ws_can cũ quyết định.
--   B (…170100)   chuyển mọi điểm kiểm quyền ghi sang owner_ws_has(ws, module, action).
--   C (supabase/pending-migrations/) bỏ cột role + overload cũ, CHỈ sau khi frontend
--                 mới đã lên production.
--
-- Cột role từ đây là "tier" di sản do trigger tính: owner = vai trò hệ thống OWNER;
-- staff = vai trò có ít nhất một quyền khác 'view'; viewer = còn lại. KHÔNG hàm SQL
-- mới nào được đọc nó (self-check ở B).

LOCK TABLE public.asset_owner_workspaces,
           public.asset_owner_workspace_members,
           public.asset_owner_workspace_invites
  IN SHARE ROW EXCLUSIVE MODE;

-- ─── Danh mục quyền ─────────────────────────────────────────────────────────
-- BẢN GỐC của catalog; client giữ bản sao ở src/lib/ownerWorkspace/permissions.ts.
-- Đổi ở đây thì đổi cả ở đó. Mã module là KHOÁ LƯU TRONG DB — không đổi tên.

CREATE FUNCTION public.owner_ws_permission_catalog()
RETURNS TABLE (module TEXT, action TEXT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  VALUES
    ('chi-tieu', 'view'), ('chi-tieu', 'create'), ('chi-tieu', 'update'), ('chi-tieu', 'delete'),
    ('tai-san', 'view'), ('tai-san', 'update'),
    ('ket-qua', 'view'), ('ket-qua', 'update'), ('ket-qua', 'delete'),
    ('so-hoa', 'view'), ('so-hoa', 'create'), ('so-hoa', 'update'),
    ('ky-gui', 'view'), ('ky-gui', 'create'), ('ky-gui', 'update'),
    ('hop-dong-mua-ban', 'view'), ('hop-dong-mua-ban', 'update'),
    ('thu-tien', 'view'), ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
    ('phan-tich', 'view'),
    ('dong-tien', 'view'),
    ('bao-cao-dinh-ky', 'view'), ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'),
    ('bao-cao-dinh-ky', 'delete'), ('bao-cao-dinh-ky', 'finalize'), ('bao-cao-dinh-ky', 'share'),
    ('chi-nhanh', 'view'), ('chi-nhanh', 'update'),
    ('thanh-vien', 'view'), ('thanh-vien', 'create'), ('thanh-vien', 'update'), ('thanh-vien', 'delete'),
    ('vai-tro', 'view'), ('vai-tro', 'create'), ('vai-tro', 'update'), ('vai-tro', 'delete'),
    ('lien-ket', 'view'), ('lien-ket', 'update')
$$;

-- Quyền mặc định của 2 vai trò seed. STAFF = ĐÚNG quyền của 'staff' cũ ('read' +
-- 'write' dịch sang module) ⇒ ngày chuyển không ai được thêm hay mất quyền.
CREATE FUNCTION public.owner_ws_default_role_permissions(p_code TEXT)
RETURNS TABLE (module TEXT, action TEXT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT c.module, c.action
    FROM public.owner_ws_permission_catalog() c
   WHERE (p_code = 'VIEWER' AND c.action = 'view')
      OR (p_code = 'STAFF' AND (
            c.action = 'view'
         OR (c.module, c.action) IN (
              ('tai-san', 'update'),
              ('ket-qua', 'update'), ('ket-qua', 'delete'),
              ('so-hoa', 'create'), ('so-hoa', 'update'),
              ('ky-gui', 'create'), ('ky-gui', 'update'),
              ('hop-dong-mua-ban', 'update'),
              ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
              ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'), ('bao-cao-dinh-ky', 'delete'))))
$$;

-- ─── Bảng ───────────────────────────────────────────────────────────────────

CREATE TABLE public.owner_ws_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  code         TEXT NOT NULL CHECK (code ~ '^[A-Z0-9_]{2,40}$'),
  description  TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  -- Chỉ OWNER là vai trò hệ thống (toàn quyền, khoá). STAFF/VIEWER là vai trò seed thường.
  is_system    BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_ws_roles_code_key UNIQUE (workspace_id, code),
  CONSTRAINT owr_system_is_owner CHECK ((code = 'OWNER') = is_system)
);

CREATE UNIQUE INDEX owner_ws_roles_name_key
  ON public.owner_ws_roles (workspace_id, lower(btrim(name)));

CREATE TRIGGER owner_ws_roles_updated_at
  BEFORE UPDATE ON public.owner_ws_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_ws_role_permissions (
  role_id    UUID NOT NULL REFERENCES public.owner_ws_roles(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, module, action)
);

COMMENT ON TABLE public.owner_ws_roles IS
  'Vai trò của một Trạm Điều Hành. OWNER (is_system) = Trưởng đơn vị, toàn quyền, không có dòng quyền.';
COMMENT ON TABLE public.owner_ws_role_permissions IS
  'Ma trận quyền module × thao tác của vai trò. Danh mục hợp lệ: owner_ws_permission_catalog(). Chỉ ghi qua RPC.';

-- Chặn quyền ngoài danh mục và quyền cho vai trò hệ thống ngay ở DB (RPC cũng kiểm).
CREATE FUNCTION public.owner_ws_role_permissions_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.owner_ws_permission_catalog() c
                  WHERE c.module = NEW.module AND c.action = NEW.action) THEN
    RAISE EXCEPTION 'invalid_permission: % / %', NEW.module, NEW.action USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_ws_roles r WHERE r.id = NEW.role_id AND r.is_system) THEN
    RAISE EXCEPTION 'system_role: vai trò Trưởng đơn vị luôn toàn quyền' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_ws_role_permissions_guard
  BEFORE INSERT OR UPDATE ON public.owner_ws_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_role_permissions_guard();

-- ─── Seed vai trò mặc định ──────────────────────────────────────────────────

CREATE FUNCTION public.owner_ws_seed_default_roles(p_workspace_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.owner_ws_roles (workspace_id, name, code, description, is_system)
  VALUES (p_workspace_id, 'Trưởng đơn vị', 'OWNER',
          'Toàn quyền: quản lý thành viên, vai trò, chi nhánh và chốt báo cáo.', true)
  ON CONFLICT (workspace_id, code) DO NOTHING;

  INSERT INTO public.owner_ws_roles (workspace_id, name, code, description)
  VALUES (p_workspace_id, 'Cán bộ', 'STAFF',
          'Xử lý tài sản, kết quả phiên, thu tiền và lập báo cáo trong phạm vi được giao.')
  ON CONFLICT (workspace_id, code) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
    SELECT v_id, d.module, d.action FROM public.owner_ws_default_role_permissions('STAFF') d;
  END IF;

  v_id := NULL;
  INSERT INTO public.owner_ws_roles (workspace_id, name, code, description)
  VALUES (p_workspace_id, 'Người xem', 'VIEWER', 'Chỉ xem số liệu, không chỉnh sửa.')
  ON CONFLICT (workspace_id, code) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
    SELECT v_id, d.module, d.action FROM public.owner_ws_default_role_permissions('VIEWER') d;
  END IF;
END;
$$;

DO $$
BEGIN
  PERFORM public.owner_ws_seed_default_roles(w.id) FROM public.asset_owner_workspaces w;
END;
$$;

-- ─── Cột role_id (backfill ở dưới, sau trigger đồng bộ) ─────────────────────

ALTER TABLE public.asset_owner_workspace_members
  ADD COLUMN role_id UUID REFERENCES public.owner_ws_roles(id) ON DELETE SET NULL;
ALTER TABLE public.asset_owner_workspace_invites
  ADD COLUMN role_id UUID REFERENCES public.owner_ws_roles(id) ON DELETE SET NULL;

CREATE INDEX asset_owner_workspace_members_role_id_idx ON public.asset_owner_workspace_members (role_id);
CREATE INDEX asset_owner_workspace_invites_role_id_idx ON public.asset_owner_workspace_invites (role_id);

-- ─── Helper vai trò ─────────────────────────────────────────────────────────

CREATE FUNCTION public.owner_ws_role_is_owner(p_role_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT r.is_system FROM public.owner_ws_roles r WHERE r.id = p_role_id), false)
$$;

-- Tier di sản cho cột role (chỉ dùng tới bước C).
CREATE FUNCTION public.owner_ws_role_tier(p_role_id UUID)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
           WHEN r.is_system THEN 'owner'
           WHEN EXISTS (SELECT 1 FROM public.owner_ws_role_permissions p
                         WHERE p.role_id = r.id AND p.action <> 'view') THEN 'staff'
           ELSE 'viewer'
         END
    FROM public.owner_ws_roles r
   WHERE r.id = p_role_id
$$;

-- Quyền của MỘT người dùng bất kỳ (nội bộ — không cấp cho client). Chỉ thành viên
-- trực tiếp, đang hoạt động. Trưởng đơn vị trụ sở đã liên kết KHÔNG có quyền ghi nào.
CREATE FUNCTION public.owner_ws_user_has(p_workspace_id UUID, p_user_id UUID, p_module TEXT, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT r.is_system
           OR EXISTS (SELECT 1 FROM public.owner_ws_role_permissions p
                       WHERE p.role_id = r.id AND p.module = p_module AND p.action = p_action)
      FROM public.asset_owner_workspace_members m
      JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = p_user_id
       AND m.status = 'active'
  ), false)
$$;

CREATE FUNCTION public.owner_ws_has(p_workspace_id UUID, p_module TEXT, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_user_has(p_workspace_id, auth.uid(), p_module, p_action)
$$;

CREATE FUNCTION public.owner_ws_user_is_owner(p_workspace_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.asset_owner_workspace_members m
      JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = p_user_id
       AND m.status = 'active'
       AND r.is_system)
$$;

CREATE FUNCTION public.owner_ws_is_owner(p_workspace_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_user_is_owner(p_workspace_id, auth.uid())
$$;

-- ─── Đồng bộ 2 chiều role ⇄ role_id (tới bước C) ────────────────────────────

-- Đường cũ chỉ biết role text ⇒ suy role_id theo code; đường mới ghi role_id ⇒ tính
-- lại tier. Luôn chặn vai trò của Trạm khác. Tên bắt đầu bằng "a_" để chạy TRƯỚC
-- các trigger guard (trigger BEFORE chạy theo thứ tự tên).
CREATE FUNCTION public.owner_ws_sync_role_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.role_id IS NULL AND NEW.role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.role_id IS NOT DISTINCT FROM OLD.role_id
                          AND NEW.role IS DISTINCT FROM OLD.role) THEN
    NEW.role_id := (SELECT r.id FROM public.owner_ws_roles r
                     WHERE r.workspace_id = NEW.workspace_id AND r.code = upper(NEW.role));
  END IF;

  IF NEW.role_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.owner_ws_roles r
                    WHERE r.id = NEW.role_id AND r.workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'invalid_role: vai trò không thuộc không gian này' USING ERRCODE = '23514';
    END IF;
    NEW.role := public.owner_ws_role_tier(NEW.role_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_workspace_members_a_sync_role
  BEFORE INSERT OR UPDATE ON public.asset_owner_workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_sync_role_columns();
CREATE TRIGGER asset_owner_workspace_invites_a_sync_role
  BEFORE INSERT OR UPDATE ON public.asset_owner_workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_sync_role_columns();

-- Backfill: trigger đồng bộ tự suy role_id (role giữ nguyên nên guard/last-owner bỏ qua).
UPDATE public.asset_owner_workspace_members m
   SET role_id = r.id
  FROM public.owner_ws_roles r
 WHERE r.workspace_id = m.workspace_id AND r.code = upper(m.role);
UPDATE public.asset_owner_workspace_invites i
   SET role_id = r.id
  FROM public.owner_ws_roles r
 WHERE r.workspace_id = i.workspace_id AND r.code = upper(i.role);

-- Dòng đã gỡ / lời mời đã dùng hoặc thu hồi được phép mất vai trò (vai trò bị xoá).
ALTER TABLE public.asset_owner_workspace_members
  ADD CONSTRAINT aowm_role_required CHECK (status = 'removed' OR role_id IS NOT NULL);
ALTER TABLE public.asset_owner_workspace_invites
  ADD CONSTRAINT aowi_role_required
  CHECK (role_id IS NOT NULL OR accepted_at IS NOT NULL OR revoked_at IS NOT NULL);

-- Trạm mới: seed vai trò rồi mới thêm dòng Trưởng đơn vị (role giữ cho NOT NULL tới C).
CREATE OR REPLACE FUNCTION public.owner_ws_seed_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.owner_ws_seed_default_roles(NEW.id);
  INSERT INTO public.asset_owner_workspace_members (workspace_id, user_id, role, role_id, status, joined_at)
  SELECT NEW.id, NEW.owner_user_id, 'owner', r.id, 'active', now()
    FROM public.owner_ws_roles r
   WHERE r.workspace_id = NEW.id AND r.code = 'OWNER'
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Đọc: thành viên trực tiếp của Trạm. Ghi: KHÔNG có policy — chỉ qua RPC (bước B).

ALTER TABLE public.owner_ws_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_ws_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_ws_roles_member_read ON public.owner_ws_roles
  FOR SELECT TO authenticated
  USING (public.owner_ws_role(workspace_id) IS NOT NULL);

CREATE POLICY owner_ws_role_permissions_member_read ON public.owner_ws_role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.owner_ws_roles r
                  WHERE r.id = role_id AND public.owner_ws_role(r.workspace_id) IS NOT NULL));

REVOKE ALL ON public.owner_ws_roles, public.owner_ws_role_permissions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.owner_ws_roles, public.owner_ws_role_permissions FROM authenticated;
GRANT SELECT ON public.owner_ws_roles, public.owner_ws_role_permissions TO authenticated;

-- ─── Quyền thực thi ─────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.owner_ws_permission_catalog() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_default_role_permissions(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_role_permissions_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_seed_default_roles(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_role_is_owner(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_role_tier(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_user_has(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_user_is_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_has(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_is_owner(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_sync_role_columns() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.owner_ws_permission_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_default_role_permissions(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_role_is_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_has(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_is_owner(UUID) TO authenticated;

-- ─── Self-check ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF (SELECT count(*) FROM public.owner_ws_permission_catalog()) <> 41 THEN
    RAISE EXCEPTION 'self-check: catalog phải có 41 quyền';
  END IF;
  IF (SELECT count(*) FROM public.owner_ws_default_role_permissions('STAFF')) <> 28
     OR (SELECT count(*) FROM public.owner_ws_default_role_permissions('VIEWER')) <> 14 THEN
    RAISE EXCEPTION 'self-check: quyền mặc định STAFF=28 / VIEWER=14';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.asset_owner_workspaces w
     WHERE (SELECT count(*) FROM public.owner_ws_roles r
             WHERE r.workspace_id = w.id AND r.code IN ('OWNER', 'STAFF', 'VIEWER')) <> 3
  ) THEN
    RAISE EXCEPTION 'self-check: mỗi Trạm phải có đủ OWNER/STAFF/VIEWER';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.asset_owner_workspace_members m
      LEFT JOIN public.owner_ws_roles r ON r.id = m.role_id
     WHERE r.id IS NULL OR r.workspace_id <> m.workspace_id OR r.code <> upper(m.role)
  ) THEN
    RAISE EXCEPTION 'self-check: backfill role_id của thành viên sai';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.asset_owner_workspace_invites i
      LEFT JOIN public.owner_ws_roles r ON r.id = i.role_id
     WHERE r.id IS NULL OR r.workspace_id <> i.workspace_id OR r.code <> upper(i.role)
  ) THEN
    RAISE EXCEPTION 'self-check: backfill role_id của lời mời sai';
  END IF;
END;
$$;

-- RBAC cấp TỔ CHỨC cho portal công ty đấu giá (/portal).
--
-- Bối cảnh:
--   • Mô phỏng admin RBAC (20260713000010_admin_rbac.sql) nhưng phạm vi là TỪNG
--     tổ chức: mỗi organizations có bộ vai trò riêng, tự tạo được.
--   • KHÁC admin ở một điểm: KHÔNG có bảng gán vai trò riêng.
--     organization_memberships đã có role_id NOT NULL + UNIQUE(user_id,
--     organization_id) ⇒ mỗi user một vai trò mỗi tổ chức, chính dòng membership
--     LÀ dòng gán. Thêm bảng thứ ba sẽ tạo hai nguồn sự thật mâu thuẫn.
--     (Admin cần bảng riêng vì user_roles.ADMIN chỉ là cổng nhị phân.)
--   • Bảng organization_roles CŨ (CHECK name IN ('Owner','Manager','Agent'),
--     UNIQUE(name), permissions JSONB chưa từng được code nào đọc) bị thay thế.
--     FK organization_memberships.role_id được trỏ lại sang org_roles ở đây;
--     bảng cũ bị DROP ở migration riêng sau khi đã kiểm chứng.
--
-- Gồm: 2 bảng + hàm seed vai trò mặc định + backfill + trỏ lại FK + thay trigger
-- create_owner_membership + 2 helper SECURITY DEFINER + RLS + 2 trigger bảo vệ +
-- viết lại RLS organization_memberships/listings + RPC thay ma trận quyền.

-- ─── 1. Bảng ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL,
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_org_roles_org ON public.org_roles(organization_id);

CREATE TABLE IF NOT EXISTS public.org_role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, module, action)
);
CREATE INDEX IF NOT EXISTS idx_org_role_permissions_role
  ON public.org_role_permissions(role_id);

ALTER TABLE public.org_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_role_permissions ENABLE ROW LEVEL SECURITY;

-- ─── 2. Hàm seed vai trò mặc định (dùng chung backfill + trigger) ────────────
-- Mã module phải khớp src/lib/orgPermissions.ts. OWNER KHÔNG lưu dòng quyền nào
-- — toàn quyền đi tắt trong org_has_permission().
CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _owner_role_id UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, code, description, is_system)
  VALUES (_org_id, 'Chủ sở hữu', 'OWNER', 'Toàn quyền trong tổ chức. Không thể xóa.', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO _owner_role_id;

  INSERT INTO public.org_roles (organization_id, name, code, description, is_system) VALUES
    (_org_id, 'Quản lý',   'MANAGER', 'Quản lý hồ sơ năng lực, hồ sơ dự tuyển và thành viên.', false),
    (_org_id, 'Nhân viên', 'AGENT',   'Xem hồ sơ và lập hồ sơ dự tuyển.', false)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT r.id, v.module, v.action
  FROM public.org_roles r
  JOIN (VALUES
    ('MANAGER','tong-quan','view'),
    ('MANAGER','nl-thong-tin-chung','view'),   ('MANAGER','nl-thong-tin-chung','update'),
    ('MANAGER','nl-dau-gia-vien','view'),      ('MANAGER','nl-dau-gia-vien','create'),
    ('MANAGER','nl-dau-gia-vien','update'),    ('MANAGER','nl-dau-gia-vien','delete'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

-- ─── 3. Backfill: mọi tổ chức hiện có đều phải có bộ vai trò ─────────────────
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organizations LOOP
    PERFORM public.org_seed_default_roles(_org.id);
  END LOOP;
END $$;

-- ─── 4. Trỏ lại FK organization_memberships.role_id → org_roles ─────────────
-- Phải DROP CONSTRAINT trước khi UPDATE: id mới chưa tồn tại ở bảng cũ.
ALTER TABLE public.organization_memberships
  DROP CONSTRAINT IF EXISTS organization_memberships_role_id_fkey;

UPDATE public.organization_memberships m
   SET role_id = nr.id
  FROM public.organization_roles old, public.org_roles nr
 WHERE m.role_id = old.id
   AND nr.code = upper(old.name)
   AND nr.organization_id = m.organization_id;

-- Chốt chặn: một dòng remap hụt sẽ âm thầm tạo FK hỏng ⇒ abort cả migration.
DO $$
DECLARE _orphans INT;
BEGIN
  SELECT count(*) INTO _orphans
    FROM public.organization_memberships m
    LEFT JOIN public.org_roles r ON r.id = m.role_id
   WHERE r.id IS NULL;
  IF _orphans > 0 THEN
    RAISE EXCEPTION 'Còn % membership chưa remap được role_id — dừng migration', _orphans;
  END IF;
END $$;

ALTER TABLE public.organization_memberships
  ADD CONSTRAINT organization_memberships_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES public.org_roles(id) ON DELETE RESTRICT;

-- ─── 5. Thay trigger tạo membership Chủ sở hữu ──────────────────────────────
-- GIỮ NGUYÊN tên hàm để binding trigger trên organizations không phải đụng tới.
CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _owner_role_id UUID;
BEGIN
  _owner_role_id := public.org_seed_default_roles(NEW.id);

  INSERT INTO public.organization_memberships
    (user_id, organization_id, role_id, status, joined_at)
  VALUES (NEW.owner_id, NEW.id, _owner_role_id, 'ACTIVE', now())
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN NEW;
END; $$;

-- ─── 6. Helpers (mô phỏng admin_has_permission) ─────────────────────────────
-- SECURITY DEFINER ⇒ đọc organization_memberships/org_roles bỏ qua RLS ⇒ không
-- đệ quy khi dùng ngay trong policy của chính các bảng đó (thủ thuật is_org_member).
CREATE OR REPLACE FUNCTION public.org_is_owner(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.org_roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
      AND m.organization_id = _org_id
      AND m.status = 'ACTIVE'
      AND r.code = 'OWNER'
  )
$$;

CREATE OR REPLACE FUNCTION public.org_has_permission(_org_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    JOIN public.org_roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid()
      AND m.organization_id = _org_id
      AND m.status = 'ACTIVE'
      AND (
        r.code = 'OWNER'
        OR EXISTS (
          SELECT 1 FROM public.org_role_permissions p
          WHERE p.role_id = r.id AND p.module = _module AND p.action = _action
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_is_owner(UUID)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_permission(UUID, TEXT, TEXT)     TO authenticated;

-- ─── 7. RLS bảng mới ────────────────────────────────────────────────────────
-- Đọc vai trò: mọi thành viên (để dựng UI + chọn vai trò khi mời).
DROP POLICY IF EXISTS "org_roles_member_read" ON public.org_roles;
CREATE POLICY "org_roles_member_read" ON public.org_roles
  FOR SELECT USING (
    public.is_org_member(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

DROP POLICY IF EXISTS "org_roles_insert" ON public.org_roles;
CREATE POLICY "org_roles_insert" ON public.org_roles
  FOR INSERT WITH CHECK (public.org_has_permission(organization_id, 'vai-tro', 'create'));

DROP POLICY IF EXISTS "org_roles_update" ON public.org_roles;
CREATE POLICY "org_roles_update" ON public.org_roles
  FOR UPDATE USING (public.org_has_permission(organization_id, 'vai-tro', 'update'))
             WITH CHECK (public.org_has_permission(organization_id, 'vai-tro', 'update'));

DROP POLICY IF EXISTS "org_roles_delete" ON public.org_roles;
CREATE POLICY "org_roles_delete" ON public.org_roles
  FOR DELETE USING (public.org_has_permission(organization_id, 'vai-tro', 'delete'));

DROP POLICY IF EXISTS "org_roles_admin_all" ON public.org_roles;
CREATE POLICY "org_roles_admin_all" ON public.org_roles
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Đọc ma trận quyền: MỌI thành viên, KHÔNG gate theo quyền — mỗi người phải đọc
-- được ma trận của chính mình để dựng nav (cùng lý do admin_role_permissions_admin_read).
DROP POLICY IF EXISTS "org_role_permissions_member_read" ON public.org_role_permissions;
CREATE POLICY "org_role_permissions_member_read" ON public.org_role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id
        AND (
          public.is_org_member(auth.uid(), r.organization_id)
          OR public.has_role(auth.uid(), 'ADMIN'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "org_role_permissions_write" ON public.org_role_permissions;
CREATE POLICY "org_role_permissions_write" ON public.org_role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id AND public.org_has_permission(r.organization_id, 'vai-tro', 'update')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id AND public.org_has_permission(r.organization_id, 'vai-tro', 'update')
    )
  );

-- ─── 8. Trigger bảo vệ vai trò hệ thống + updated_at ────────────────────────
CREATE OR REPLACE FUNCTION public.org_roles_protect_system()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN RAISE EXCEPTION 'Không thể xóa vai trò hệ thống'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'Không thể chuyển vai trò sang tổ chức khác';
  END IF;
  IF OLD.is_system AND (NEW.code <> OLD.code OR NEW.is_system <> OLD.is_system) THEN
    RAISE EXCEPTION 'Không thể đổi mã / trạng thái vai trò hệ thống';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_org_roles_protect ON public.org_roles;
CREATE TRIGGER trg_org_roles_protect
  BEFORE UPDATE OR DELETE ON public.org_roles
  FOR EACH ROW EXECUTE FUNCTION public.org_roles_protect_system();

-- ─── 9. Trigger: tổ chức luôn còn ít nhất một Chủ sở hữu ────────────────────
-- RLS không diễn đạt được ràng buộc "dòng cuối cùng".
CREATE OR REPLACE FUNCTION public.org_protect_last_owner()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _was_owner BOOLEAN;
  _others    INT;
BEGIN
  SELECT (r.code = 'OWNER') INTO _was_owner
    FROM public.org_roles r WHERE r.id = OLD.role_id;

  -- Không phải Chủ sở hữu đang hoạt động ⇒ không liên quan.
  IF NOT COALESCE(_was_owner, false) OR OLD.status <> 'ACTIVE' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- UPDATE không đụng vai trò lẫn trạng thái ⇒ bỏ qua.
  IF TG_OP = 'UPDATE' AND NEW.role_id = OLD.role_id AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _others
    FROM public.organization_memberships m
    JOIN public.org_roles r ON r.id = m.role_id
   WHERE m.organization_id = OLD.organization_id
     AND m.status = 'ACTIVE'
     AND r.code = 'OWNER'
     AND m.id <> OLD.id;

  IF _others = 0 THEN
    RAISE EXCEPTION 'Tổ chức phải có ít nhất một Chủ sở hữu đang hoạt động';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

DROP TRIGGER IF EXISTS trg_org_protect_last_owner ON public.organization_memberships;
CREATE TRIGGER trg_org_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.org_protect_last_owner();

-- ─── 10. Viết lại RLS organization_memberships ──────────────────────────────
-- Bịt lỗ hổng 1: policy INSERT cũ chỉ kiểm tra has_org_role(...,['Owner','Manager'])
-- ⇒ một Manager chèn được membership vai trò Owner cho chính mình. Việc tạo lời
-- mời chuyển hết sang RPC create_org_invite (migration kế tiếp) có guard đầy đủ;
-- INSERT trực tiếp từ client không còn được phép.
DROP POLICY IF EXISTS "Owners and managers can invite members" ON public.organization_memberships;

-- Bịt lỗ hổng 2: trước đây KHÔNG có policy UPDATE nào cho phép đổi vai trò thành
-- viên (policy duy nhất là nhận lời mời, WITH CHECK ép user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can claim invites and accept invitations" ON public.organization_memberships;
DROP POLICY IF EXISTS "Users can accept or decline invitations"        ON public.organization_memberships;
DROP POLICY IF EXISTS "org_membership_manage_update"                   ON public.organization_memberships;
CREATE POLICY "org_membership_manage_update" ON public.organization_memberships
  FOR UPDATE TO authenticated
  USING (public.org_has_permission(organization_id, 'thanh-vien', 'update'))
  WITH CHECK (
    public.org_has_permission(organization_id, 'thanh-vien', 'update')
    -- Vai trò đích PHẢI thuộc đúng tổ chức này (lỗ hổng mới sinh ra do vai trò
    -- nay theo từng tổ chức — không có dòng này thì gán chéo tổ chức được).
    AND EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id AND r.organization_id = organization_memberships.organization_id
    )
    -- Chỉ Chủ sở hữu mới được trao vai trò Chủ sở hữu.
    AND (
      NOT EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND r.code = 'OWNER')
      OR public.org_is_owner(organization_id)
    )
  );

DROP POLICY IF EXISTS "Owners can remove any member except themselves" ON public.organization_memberships;
DROP POLICY IF EXISTS "Managers can remove agents and pending invites" ON public.organization_memberships;
DROP POLICY IF EXISTS "Owners can remove members"                      ON public.organization_memberships;
DROP POLICY IF EXISTS "Managers can remove agents"                     ON public.organization_memberships;
DROP POLICY IF EXISTS "org_membership_delete"                          ON public.organization_memberships;
CREATE POLICY "org_membership_delete" ON public.organization_memberships
  FOR DELETE TO authenticated
  USING (
    public.org_has_permission(organization_id, 'thanh-vien', 'delete')
    AND (user_id IS NULL OR user_id <> auth.uid())
    AND (
      NOT EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND r.code = 'OWNER')
      OR public.org_is_owner(organization_id)
    )
  );

-- Policy SELECT và "Admins can manage all memberships" GIỮ NGUYÊN.

-- ─── 11. Viết lại RLS listings ──────────────────────────────────────────────
-- Hai policy cũ so khớp CHUỖI r.name IN ('Owner','Manager') qua organization_roles.
-- Sau khi trỏ lại FK, join đó trả 0 dòng ⇒ quản lý tổ chức âm thầm mất quyền ghi.
DROP POLICY IF EXISTS "Organization owners and managers can update org listings" ON public.listings;
DROP POLICY IF EXISTS "org_listings_update" ON public.listings;
CREATE POLICY "org_listings_update" ON public.listings
  FOR UPDATE USING (
    organization_id IS NOT NULL
    AND public.org_has_permission(organization_id, 'tin-dang', 'update')
  );

DROP POLICY IF EXISTS "Organization owners and managers can delete org listings" ON public.listings;
DROP POLICY IF EXISTS "org_listings_delete" ON public.listings;
CREATE POLICY "org_listings_delete" ON public.listings
  FOR DELETE USING (
    organization_id IS NOT NULL
    AND public.org_has_permission(organization_id, 'tin-dang', 'delete')
  );

-- ─── 12. RPC: thay TOÀN BỘ ma trận quyền của một vai trò (atomic) ───────────
CREATE OR REPLACE FUNCTION public.org_set_role_permissions(_role_id UUID, _perms JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _org UUID; _code TEXT;
BEGIN
  SELECT organization_id, code INTO _org, _code
    FROM public.org_roles WHERE id = _role_id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'role_not_found';
  END IF;
  IF NOT public.org_has_permission(_org, 'vai-tro', 'update') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _code = 'OWNER' THEN
    RAISE EXCEPTION 'Chủ sở hữu luôn có toàn quyền, không chỉnh ma trận';
  END IF;

  DELETE FROM public.org_role_permissions WHERE role_id = _role_id;
  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT _role_id, elem->>'module', elem->>'action'
  FROM jsonb_array_elements(_perms) AS elem
  ON CONFLICT (role_id, module, action) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.org_set_role_permissions(UUID, JSONB) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Khách hàng CỦA TỔ CHỨC ĐẤU GIÁ (danh bạ riêng trong /portal/khach-hang).
--
-- NGUYÊN TẮC (quyết định 2026-09-12): SÀN KHÔNG CUNG CẤP DỮ LIỆU NGƯỜI MUA. Tổ
-- chức tự nhập / import khách của mình, tự chia nhóm, tự khai nhu cầu. Truy vấn
-- chọn người nhận khi tiếp thị phiên (org_session_audience, migration sau) chỉ
-- chạy trên danh bạ này.
--
-- ĐỒNG Ý NHẬN TIN: notifications_enabled mặc định FALSE — cùng ngữ nghĩa với
-- profiles.notifications_enabled (opt-in). Khách chưa đồng ý không bao giờ là
-- người nhận hợp lệ. consent_changed_at/by do trigger đóng dấu.
--
-- RLS theo QUYỀN TỔ CHỨC (module `khach-hang`), KHÔNG "own rows" và KHÔNG có
-- policy admin sàn: đây là dữ liệu cá nhân tổ chức tự thu thập.
--
-- Nhu cầu (org_contact_interests): NHIỀU dòng / khách. Trong một dòng các chiều
-- là AND; khách khớp khi BẤT KỲ dòng nào khớp.
--
-- Khoá ngoại ghép (id, organization_id) chặn việc gắn khách của tổ chức khác vào
-- nhóm / nhu cầu của mình — RLS chỉ lọc dòng đọc, không chặn được id lạ.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Chuẩn hoá tên tỉnh/thành ────────────────────────────────────────────
-- Tỉnh là TEXT tự do ở mọi bảng ("TP. Hồ Chí Minh", "Hồ Chí Minh", "TP.HCM").
-- Bỏ dấu qua normalize_org_name, rồi bỏ tiền tố hành chính và gom vài viết tắt.
-- LƯU Ý: province_keys là generated column dùng hàm này — sửa hàm thì phải
-- UPDATE lại cột nguồn (provinces = provinces) để tính lại giá trị đã lưu.
CREATE OR REPLACE FUNCTION public.normalize_province(_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE k
           WHEN 'hcm'     THEN 'ho chi minh'
           WHEN 'tphcm'   THEN 'ho chi minh'
           WHEN 'sai gon' THEN 'ho chi minh'
           WHEN 'hn'      THEN 'ha noi'
           WHEN 'thua thien hue' THEN 'hue'
           ELSE k
         END
  FROM (
    SELECT NULLIF(btrim(regexp_replace(
             COALESCE(public.normalize_org_name(_name), ''),
             '^(thanh pho|tp|tinh)\s+', '')), '') AS k
  ) s
$$;

CREATE OR REPLACE FUNCTION public.normalize_provinces(_names TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT k ORDER BY k), '{}'::TEXT[])
  FROM (SELECT public.normalize_province(x) AS k FROM unnest(COALESCE(_names, '{}'::TEXT[])) AS x) s
  WHERE k IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.normalize_province(TEXT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_provinces(TEXT[]) TO anon, authenticated;

-- ─── 2. org_contacts ────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.org_contact_code_seq;

CREATE TABLE IF NOT EXISTS public.org_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Trigger luôn cấp mã LH000001 khi INSERT; DEFAULT '' chỉ để client khỏi gửi.
  code             TEXT NOT NULL DEFAULT '',
  full_name        TEXT NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  contact_type     TEXT NOT NULL DEFAULT 'individual' CHECK (contact_type IN ('individual', 'company')),
  company_name     TEXT,
  phone            TEXT,
  -- Chỉ chữ số, +84 → 0. Bản sao client: src/lib/orgContacts/phone.ts.
  phone_digits     TEXT GENERATED ALWAYS AS (
                     NULLIF(regexp_replace(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'),
                                           '^84(\d{9,10})$', '0\1'), '')
                   ) STORED,
  email            TEXT,
  zalo             TEXT,
  province         TEXT,
  note             TEXT,
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  consent_changed_at    TIMESTAMPTZ,
  consent_changed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Không có kênh liên lạc nào thì khách vô dụng cho tiếp thị.
  CONSTRAINT org_contacts_reachable CHECK (
    NULLIF(btrim(COALESCE(phone, '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(email, '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(zalo, '')), '') IS NOT NULL
  ),
  CONSTRAINT org_contacts_id_org_key UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_code ON public.org_contacts (code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_phone
  ON public.org_contacts (organization_id, phone_digits)
  WHERE phone_digits IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_email
  ON public.org_contacts (organization_id, lower(btrim(email)))
  WHERE NULLIF(btrim(COALESCE(email, '')), '') IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_contacts_org
  ON public.org_contacts (organization_id, created_at DESC);

-- ─── 3. org_contact_interests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_contact_interests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID NOT NULL,
  organization_id  UUID NOT NULL,
  -- Slug cha HOẶC con trong ASSET_CATEGORIES (src/constants/category.constants.ts).
  categories       TEXT[] NOT NULL DEFAULT '{}',
  -- Tên hiển thị như người dùng chọn; so khớp qua province_keys.
  provinces        TEXT[] NOT NULL DEFAULT '{}',
  province_keys    TEXT[] GENERATED ALWAYS AS (public.normalize_provinces(provinces)) STORED,
  price_min        NUMERIC(18,0) CHECK (price_min IS NULL OR price_min >= 0),
  price_max        NUMERIC(18,0) CHECK (price_max IS NULL OR price_max >= 0),
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_contact_interests_contact_fk
    FOREIGN KEY (contact_id, organization_id)
    REFERENCES public.org_contacts (id, organization_id) ON DELETE CASCADE,
  -- Dòng không ràng buộc gì sẽ khớp MỌI lô — không cho lưu.
  CONSTRAINT org_contact_interests_has_dimension CHECK (
    cardinality(categories) > 0 OR cardinality(provinces) > 0
    OR price_min IS NOT NULL OR price_max IS NOT NULL
  ),
  CONSTRAINT org_contact_interests_price_order CHECK (
    price_min IS NULL OR price_max IS NULL OR price_min <= price_max
  )
);

CREATE INDEX IF NOT EXISTS idx_org_contact_interests_org ON public.org_contact_interests (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_contact_interests_contact ON public.org_contact_interests (contact_id);

-- ─── 4. Nhóm khách ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_contact_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (char_length(btrim(name)) >= 2),
  description      TEXT,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_contact_groups_id_org_key UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contact_groups_name
  ON public.org_contact_groups (organization_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.org_contact_group_members (
  group_id         UUID NOT NULL,
  contact_id       UUID NOT NULL,
  organization_id  UUID NOT NULL,
  added_by         UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, contact_id),
  CONSTRAINT org_contact_group_members_group_fk
    FOREIGN KEY (group_id, organization_id)
    REFERENCES public.org_contact_groups (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT org_contact_group_members_contact_fk
    FOREIGN KEY (contact_id, organization_id)
    REFERENCES public.org_contacts (id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_contact_group_members_contact ON public.org_contact_group_members (contact_id);
CREATE INDEX IF NOT EXISTS idx_org_contact_group_members_org ON public.org_contact_group_members (organization_id);

-- ─── 5. Trigger ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_contacts_fill()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.code := 'LH' || lpad(nextval('public.org_contact_code_seq')::TEXT, 6, '0');
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    IF NEW.notifications_enabled THEN
      NEW.consent_changed_at := now();
      NEW.consent_changed_by := auth.uid();
    ELSE
      NEW.consent_changed_at := NULL;
      NEW.consent_changed_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Không đổi được tổ chức sở hữu khách hàng.' USING ERRCODE = 'check_violation';
  END IF;
  NEW.code := OLD.code;
  NEW.created_by := OLD.created_by;
  IF NEW.notifications_enabled IS DISTINCT FROM OLD.notifications_enabled THEN
    NEW.consent_changed_at := now();
    NEW.consent_changed_by := auth.uid();
  ELSE
    NEW.consent_changed_at := OLD.consent_changed_at;
    NEW.consent_changed_by := OLD.consent_changed_by;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS org_contacts_fill ON public.org_contacts;
CREATE TRIGGER org_contacts_fill
  BEFORE INSERT OR UPDATE ON public.org_contacts
  FOR EACH ROW EXECUTE FUNCTION public.org_contacts_fill();

CREATE OR REPLACE FUNCTION public.org_contact_groups_fill()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    RETURN NEW;
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Không đổi được tổ chức sở hữu nhóm.' USING ERRCODE = 'check_violation';
  END IF;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS org_contact_groups_fill ON public.org_contact_groups;
CREATE TRIGGER org_contact_groups_fill
  BEFORE INSERT OR UPDATE ON public.org_contact_groups
  FOR EACH ROW EXECUTE FUNCTION public.org_contact_groups_fill();

DROP TRIGGER IF EXISTS org_contacts_updated_at ON public.org_contacts;
CREATE TRIGGER org_contacts_updated_at
  BEFORE UPDATE ON public.org_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS org_contact_interests_updated_at ON public.org_contact_interests;
CREATE TRIGGER org_contact_interests_updated_at
  BEFORE UPDATE ON public.org_contact_interests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS org_contact_groups_updated_at ON public.org_contact_groups;
CREATE TRIGGER org_contact_groups_updated_at
  BEFORE UPDATE ON public.org_contact_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 6. RLS ─────────────────────────────────────────────────────────────────
-- Khuôn can_manage_auction_sessions (20260911000003). Nhánh owner_id là lưới an
-- toàn cho tổ chức cũ chưa có dòng membership của chủ.
CREATE OR REPLACE FUNCTION public.can_manage_org_contacts(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'khach-hang', _action)
      OR EXISTS (SELECT 1 FROM public.organizations o
                  WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_org_contacts(UUID, TEXT) TO authenticated;

ALTER TABLE public.org_contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contact_interests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contact_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contact_group_members ENABLE ROW LEVEL SECURITY;

-- Khách hàng
DROP POLICY IF EXISTS "org_contacts_select" ON public.org_contacts;
CREATE POLICY "org_contacts_select" ON public.org_contacts
  FOR SELECT TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'view'));

DROP POLICY IF EXISTS "org_contacts_insert" ON public.org_contacts;
CREATE POLICY "org_contacts_insert" ON public.org_contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'create'));

DROP POLICY IF EXISTS "org_contacts_update" ON public.org_contacts;
CREATE POLICY "org_contacts_update" ON public.org_contacts
  FOR UPDATE TO authenticated
  USING      (public.can_manage_org_contacts(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'update'));

DROP POLICY IF EXISTS "org_contacts_delete" ON public.org_contacts;
CREATE POLICY "org_contacts_delete" ON public.org_contacts
  FOR DELETE TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'delete'));

-- Nhu cầu: thêm/sửa/xoá nhu cầu = SỬA khách ⇒ cả ba cần 'update'.
DROP POLICY IF EXISTS "org_contact_interests_select" ON public.org_contact_interests;
CREATE POLICY "org_contact_interests_select" ON public.org_contact_interests
  FOR SELECT TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'view'));

DROP POLICY IF EXISTS "org_contact_interests_insert" ON public.org_contact_interests;
CREATE POLICY "org_contact_interests_insert" ON public.org_contact_interests
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'update'));

DROP POLICY IF EXISTS "org_contact_interests_update" ON public.org_contact_interests;
CREATE POLICY "org_contact_interests_update" ON public.org_contact_interests
  FOR UPDATE TO authenticated
  USING      (public.can_manage_org_contacts(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'update'));

DROP POLICY IF EXISTS "org_contact_interests_delete" ON public.org_contact_interests;
CREATE POLICY "org_contact_interests_delete" ON public.org_contact_interests
  FOR DELETE TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'update'));

-- Nhóm
DROP POLICY IF EXISTS "org_contact_groups_select" ON public.org_contact_groups;
CREATE POLICY "org_contact_groups_select" ON public.org_contact_groups
  FOR SELECT TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'view'));

DROP POLICY IF EXISTS "org_contact_groups_insert" ON public.org_contact_groups;
CREATE POLICY "org_contact_groups_insert" ON public.org_contact_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'create'));

DROP POLICY IF EXISTS "org_contact_groups_update" ON public.org_contact_groups;
CREATE POLICY "org_contact_groups_update" ON public.org_contact_groups
  FOR UPDATE TO authenticated
  USING      (public.can_manage_org_contacts(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'update'));

DROP POLICY IF EXISTS "org_contact_groups_delete" ON public.org_contact_groups;
CREATE POLICY "org_contact_groups_delete" ON public.org_contact_groups
  FOR DELETE TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'delete'));

-- Thành viên nhóm: thêm/gỡ = SỬA nhóm.
DROP POLICY IF EXISTS "org_contact_group_members_select" ON public.org_contact_group_members;
CREATE POLICY "org_contact_group_members_select" ON public.org_contact_group_members
  FOR SELECT TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'view'));

DROP POLICY IF EXISTS "org_contact_group_members_insert" ON public.org_contact_group_members;
CREATE POLICY "org_contact_group_members_insert" ON public.org_contact_group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_contacts(organization_id, 'update'));

DROP POLICY IF EXISTS "org_contact_group_members_delete" ON public.org_contact_group_members;
CREATE POLICY "org_contact_group_members_delete" ON public.org_contact_group_members
  FOR DELETE TO authenticated
  USING (public.can_manage_org_contacts(organization_id, 'update'));

-- ─── 7. RPC ─────────────────────────────────────────────────────────────────
-- Import hàng loạt. Dòng trùng SĐT/email (kể cả trùng trong chính file) được bỏ
-- qua và báo lại; dòng vi phạm CHECK cũng bỏ qua thay vì làm hỏng cả lô.
-- _rows: [{row, full_name, contact_type, company_name, phone, email, zalo,
--          province, note, notifications_enabled, categories[], provinces[],
--          price_min, price_max, groups[]}]
CREATE OR REPLACE FUNCTION public.org_import_contacts(_org_id UUID, _rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _r        JSONB;
  _id       UUID;
  _gid      UUID;
  _gname    TEXT;
  _cats     TEXT[];
  _provs    TEXT[];
  _pmin     NUMERIC;
  _pmax     NUMERIC;
  _inserted INT := 0;
  _skipped  JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.can_manage_org_contacts(_org_id, 'create') THEN
    RAISE EXCEPTION 'Không có quyền thêm khách hàng.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'Dữ liệu import không hợp lệ.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(_rows) > 2000 THEN
    RAISE EXCEPTION 'Mỗi lần import tối đa 2,000 dòng.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR _r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    _id := NULL;
    BEGIN
      INSERT INTO public.org_contacts (
        organization_id, full_name, contact_type, company_name, phone, email, zalo,
        province, note, source, notifications_enabled
      ) VALUES (
        _org_id,
        btrim(COALESCE(_r->>'full_name', '')),
        COALESCE(NULLIF(_r->>'contact_type', ''), 'individual'),
        NULLIF(btrim(COALESCE(_r->>'company_name', '')), ''),
        NULLIF(btrim(COALESCE(_r->>'phone', '')), ''),
        NULLIF(btrim(COALESCE(_r->>'email', '')), ''),
        NULLIF(btrim(COALESCE(_r->>'zalo', '')), ''),
        NULLIF(btrim(COALESCE(_r->>'province', '')), ''),
        NULLIF(btrim(COALESCE(_r->>'note', '')), ''),
        'import',
        COALESCE((_r->>'notifications_enabled')::BOOLEAN, false)
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO _id;
    EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation THEN
      _skipped := _skipped || jsonb_build_object('row', _r->'row', 'reason', 'invalid');
      CONTINUE;
    END;

    IF _id IS NULL THEN
      _skipped := _skipped || jsonb_build_object('row', _r->'row', 'reason', 'duplicate');
      CONTINUE;
    END IF;
    _inserted := _inserted + 1;

    _cats  := ARRAY(SELECT jsonb_array_elements_text(COALESCE(_r->'categories', '[]'::JSONB)));
    _provs := ARRAY(SELECT jsonb_array_elements_text(COALESCE(_r->'provinces', '[]'::JSONB)));
    _pmin  := NULLIF(_r->>'price_min', '')::NUMERIC;
    _pmax  := NULLIF(_r->>'price_max', '')::NUMERIC;
    IF cardinality(_cats) > 0 OR cardinality(_provs) > 0 OR _pmin IS NOT NULL OR _pmax IS NOT NULL THEN
      INSERT INTO public.org_contact_interests (contact_id, organization_id, categories, provinces, price_min, price_max)
      VALUES (_id, _org_id, _cats, _provs, _pmin,
              CASE WHEN _pmin IS NOT NULL AND _pmax IS NOT NULL AND _pmax < _pmin THEN NULL ELSE _pmax END);
    END IF;

    FOR _gname IN
      SELECT DISTINCT btrim(g) FROM jsonb_array_elements_text(COALESCE(_r->'groups', '[]'::JSONB)) AS g
      WHERE char_length(btrim(g)) >= 2
    LOOP
      SELECT id INTO _gid FROM public.org_contact_groups
       WHERE organization_id = _org_id AND lower(btrim(name)) = lower(_gname);
      IF _gid IS NULL THEN
        INSERT INTO public.org_contact_groups (organization_id, name)
        VALUES (_org_id, _gname) RETURNING id INTO _gid;
      END IF;
      INSERT INTO public.org_contact_group_members (group_id, contact_id, organization_id)
      VALUES (_gid, _id, _org_id) ON CONFLICT DO NOTHING;
      _gid := NULL;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('inserted', _inserted, 'skipped', _skipped);
END; $$;

REVOKE ALL ON FUNCTION public.org_import_contacts(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_import_contacts(UUID, JSONB) TO authenticated;

-- "Lưu thành nhóm" từ danh sách người nhận của một phiên. Id khách của tổ chức
-- khác bị lọc bỏ im lặng (không lộ việc id đó tồn tại).
CREATE OR REPLACE FUNCTION public.org_create_contact_group(
  _org_id UUID, _name TEXT, _description TEXT, _contact_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _gid UUID;
BEGIN
  IF NOT public.can_manage_org_contacts(_org_id, 'create') THEN
    RAISE EXCEPTION 'Không có quyền tạo nhóm khách hàng.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.org_contact_groups (organization_id, name, description)
  VALUES (_org_id, btrim(COALESCE(_name, '')), NULLIF(btrim(COALESCE(_description, '')), ''))
  RETURNING id INTO _gid;

  INSERT INTO public.org_contact_group_members (group_id, contact_id, organization_id)
  SELECT _gid, c.id, _org_id
    FROM public.org_contacts c
   WHERE c.organization_id = _org_id
     AND c.id = ANY (COALESCE(_contact_ids, '{}'::UUID[]))
  ON CONFLICT DO NOTHING;

  RETURN _gid;
END; $$;

REVOKE ALL ON FUNCTION public.org_create_contact_group(UUID, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_create_contact_group(UUID, TEXT, TEXT, UUID[]) TO authenticated;

-- ─── 8. Mã quyền tổ chức `khach-hang` ───────────────────────────────────────
-- Trùng mã với module admin "khach-hang" nhưng nằm ở bảng khác
-- (org_role_permissions vs admin_role_permissions) nên không đụng nhau.
-- Backfill CẢ MANAGER lẫn AGENT (bài học 20260906100002). OWNER không cần dòng.
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'khach-hang', v.action
FROM public.org_roles r
JOIN (VALUES
  ('MANAGER', 'view'), ('MANAGER', 'create'), ('MANAGER', 'update'),
  ('MANAGER', 'delete'), ('MANAGER', 'export'),
  ('AGENT',   'view')
) AS v(code, action) ON v.code = r.code
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Preset cho tổ chức tạo mới — chép nguyên bản 20260911000005, chỉ thêm khach-hang.
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
    ('MANAGER','nhan-su','view'),              ('MANAGER','nhan-su','update'),
    ('MANAGER','nhan-su','export'),
    ('MANAGER','boi-duong','view'),            ('MANAGER','boi-duong','create'),
    ('MANAGER','boi-duong','update'),          ('MANAGER','boi-duong','delete'),
    ('MANAGER','boi-duong','export'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','yeu-cau-ky-gui','view'),       ('MANAGER','yeu-cau-ky-gui','update'),
    ('MANAGER','phien-dau-gia','view'),        ('MANAGER','phien-dau-gia','create'),
    ('MANAGER','phien-dau-gia','update'),      ('MANAGER','phien-dau-gia','delete'),
    ('MANAGER','ho-so-tham-gia','view'),       ('MANAGER','ho-so-tham-gia','update'),
    ('MANAGER','khach-hang','view'),           ('MANAGER','khach-hang','create'),
    ('MANAGER','khach-hang','update'),         ('MANAGER','khach-hang','delete'),
    ('MANAGER','khach-hang','export'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nhan-su','view'),                ('AGENT','nhan-su','export'),
    ('AGENT','boi-duong','view'),              ('AGENT','boi-duong','export'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','yeu-cau-ky-gui','view'),
    ('AGENT','phien-dau-gia','view'),
    ('AGENT','ho-so-tham-gia','view'),
    ('AGENT','khach-hang','view'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;

-- ─── 9. Kiểm chứng ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF public.normalize_province('TP. Hồ Chí Minh') <> 'ho chi minh'
     OR public.normalize_province('Thành phố Hồ Chí Minh') <> 'ho chi minh'
     OR public.normalize_province('HỒ CHÍ MINH') <> 'ho chi minh'
     OR public.normalize_province('TP.HCM') <> 'ho chi minh'
     OR public.normalize_province('Tỉnh Đồng Nai') <> 'dong nai'
     OR public.normalize_province('ĐÀ NẴNG') <> 'da nang'
     OR public.normalize_province('') IS NOT NULL THEN
    RAISE EXCEPTION 'normalize_province sai kết quả mong đợi';
  END IF;
  IF public.normalize_provinces(ARRAY['Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Hà Nội']) <> ARRAY['ha noi', 'ho chi minh'] THEN
    RAISE EXCEPTION 'normalize_provinces sai kết quả mong đợi';
  END IF;
END $$;

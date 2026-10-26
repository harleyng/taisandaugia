-- ─────────────────────────────────────────────────────────────────────────────
-- Đơn vị hành chính sau sáp nhập 2025 (`admin_units`)
-- Phase 1 của docs/owner-auction-planning-plan.md (mục A3), quyết định D2.
--
-- Từ 01/07/2025 bộ máy địa phương còn HAI cấp: tỉnh/thành phố → xã/phường/đặc
-- khu (Nghị quyết 202/2025/QH15). Bảng này là SỔ GỐC DUY NHẤT của danh mục đó
-- cho mọi kế hoạch đấu giá, chi nhánh và không gian chủ tài sản — thay cho việc
-- so khớp tên tự do.
--
-- Phạm vi có chủ đích:
--   • `src/constants/vietnam-locations.ts` (3 tỉnh, quận/phường TRƯỚC sáp nhập)
--     và các trường địa chỉ của wizard số hoá KHÔNG đổi trong phase này.
--   • `admin_unit_resolve` chỉ ĐỌC: nó không bao giờ ghi vào `asset_postings`.
--     Địa chỉ cũ trong hồ sơ là văn bản 3 cấp, tỉ lệ khớp không thể 100%.
-- ─────────────────────────────────────────────────────────────────────────────

-- DDL trên hai bảng nóng (asset_owner_workspaces / workspace_branches): khoá cả
-- hai NGAY trong một câu ở đầu giao dịch để không deadlock với truy vấn app
-- (xem common-pitfalls.md, 2026-09-26 P4).
LOCK TABLE public.asset_owner_workspaces, public.workspace_branches IN ACCESS EXCLUSIVE MODE;

-- ─── 1. Chuẩn hoá tên đơn vị hành chính ──────────────────────────────────────
-- Cùng họ với `normalize_province` (20260912000010): bỏ dấu + hạ chữ qua
-- `normalize_org_name`, rồi bỏ TIỀN TỐ hành chính để "Xã Tân Dĩnh" ≡ "Tân Dĩnh"
-- và "Tỉnh Bắc Ninh" ≡ "Bắc Ninh". Thêm "thị xã"/"thị trấn" so với danh sách ở
-- A3 vì địa chỉ cũ trong `asset_postings.ward` thường ghi "Thị trấn …".
--
-- ⚠️ Hàm này nằm trong GENERATED column `admin_units.normalized_name` (STORED):
-- sửa hàm KHÔNG tự tính lại giá trị đã lưu — phải `UPDATE admin_units SET name = name`
-- (cùng bẫy với `org_contact_interests.province_keys`).
-- ⚠️ Không thêm `SET search_path` cho hàm SQL IMMUTABLE này: mệnh đề SET chặn
-- inline, làm mất khả năng dùng index khi so khớp.
CREATE OR REPLACE FUNCTION public.normalize_admin_name(_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE k
           WHEN 'hcm'     THEN 'ho chi minh'
           WHEN 'tphcm'   THEN 'ho chi minh'
           WHEN 'sai gon' THEN 'ho chi minh'
           WHEN 'hn'      THEN 'ha noi'
           ELSE k
         END
  FROM (
    SELECT NULLIF(btrim(regexp_replace(
             COALESCE(public.normalize_org_name(_name), ''),
             '^(thanh pho|tp|tinh|thi xa|thi tran|xa|phuong|dac khu)\s+', '')), '') AS k
  ) s
$$;

COMMENT ON FUNCTION public.normalize_admin_name(TEXT) IS
  'Chuẩn hoá tên ĐVHC: bỏ dấu, hạ chữ, bỏ tiền tố tỉnh/thành phố/xã/phường/đặc khu/thị xã/thị trấn. Dùng cho generated column admin_units.normalized_name và admin_unit_resolve.';

GRANT EXECUTE ON FUNCTION public.normalize_admin_name(TEXT) TO anon, authenticated;

-- ─── 2. Bảng danh mục ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_units (
  code            TEXT PRIMARY KEY,                       -- mã chính thức (Danh mục mã ĐVHC 2025)
  name            TEXT NOT NULL,                          -- "Phường Tân Định", "Xã Tân Dĩnh", "Đặc khu Phú Quốc"
  level           TEXT NOT NULL CHECK (level IN ('province','commune')),
  unit_type       TEXT NOT NULL CHECK (unit_type IN ('tinh','thanh_pho','xa','phuong','dac_khu')),
  parent_code     TEXT REFERENCES public.admin_units(code),  -- NULL với cấp tỉnh
  legacy_names    TEXT[] NOT NULL DEFAULT '{}',            -- tên TRƯỚC sáp nhập nay thuộc đơn vị này
  normalized_name TEXT GENERATED ALWAYS AS (public.normalize_admin_name(name)) STORED,
  effective_from  DATE NOT NULL DEFAULT '2025-07-01',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT au_parent_level CHECK ((level = 'province') = (parent_code IS NULL))
);

COMMENT ON TABLE public.admin_units IS
  'Danh mục đơn vị hành chính 2 cấp sau sáp nhập 01/07/2025 (NQ 202/2025/QH15). Sổ gốc của mọi mã ĐVHC: kế hoạch đấu giá, chi nhánh, không gian chủ tài sản. Nguồn: docs/admin-units/.';
COMMENT ON COLUMN public.admin_units.legacy_names IS
  'Tên trước sáp nhập nay ánh xạ về đây (cấp tỉnh: 63 → 34 theo NQ 202/2025/QH15; cấp xã để trống ở v1). Chỉ dùng để so khớp văn bản cũ.';
COMMENT ON COLUMN public.admin_units.is_active IS
  'Sáp nhập còn tiếp diễn: ngưng dùng một đơn vị bằng cách đặt false, KHÔNG xoá dòng (mọi FK là RESTRICT).';

CREATE INDEX IF NOT EXISTS idx_admin_units_parent      ON public.admin_units (parent_code);
CREATE INDEX IF NOT EXISTS idx_admin_units_level_norm  ON public.admin_units (level, normalized_name);
CREATE INDEX IF NOT EXISTS idx_admin_units_parent_norm ON public.admin_units (parent_code, normalized_name);

-- ─── 3. RLS: ai cũng ĐỌC được, chỉ ADMIN ghi ─────────────────────────────────
-- Danh mục ĐVHC là dữ liệu công khai (bộ chọn tỉnh/xã dùng cả ở trang ẩn danh).
-- Policy ghi để `TO authenticated`: policy `TO public` gọi hàm mà anon không có
-- EXECUTE sẽ làm MỌI truy vấn đọc của anon hỏng (common-pitfalls.md, P4).
ALTER TABLE public.admin_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_units_public_read ON public.admin_units;
CREATE POLICY admin_units_public_read ON public.admin_units
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS admin_units_admin_write ON public.admin_units;
CREATE POLICY admin_units_admin_write ON public.admin_units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

GRANT SELECT                   ON public.admin_units TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE   ON public.admin_units TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_units FROM anon;

-- ─── 4. Bộ giải mã văn bản tự do → mã ĐVHC ───────────────────────────────────
-- CHỈ ĐỌC. Trả về mã CỤ THỂ NHẤT giải được:
--   • mã cấp xã khi tỉnh giải được VÀ tên xã khớp đúng MỘT đơn vị trong tỉnh;
--   • mã cấp tỉnh khi chỉ giải được tỉnh (thiếu xã, không khớp, hoặc KHỚP NHIỀU);
--   • NULL khi không giải được tỉnh.
-- Khớp nhiều là chuyện thật: 10 cặp (tỉnh, tên xã chuẩn hoá) trong danh mục
-- 2025 trùng nhau sau khi bỏ dấu + bỏ tiền tố (vd. "Xã Văn Lăng" ~ "Phường Văn
-- Lang" ở Thái Nguyên). Trả về tỉnh thay vì đoán — bên gọi thấy mã 2 chữ số là
-- biết chưa xuống được cấp xã.
CREATE OR REPLACE FUNCTION public.admin_unit_resolve(p_province TEXT, p_ward TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prov_key TEXT := public.normalize_admin_name(p_province);
  v_ward_key TEXT := public.normalize_admin_name(p_ward);
  v_prov     TEXT;
  v_code     TEXT;
  v_n        INT;
BEGIN
  IF v_prov_key IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. tên tỉnh hiện hành
  SELECT u.code INTO v_prov
    FROM public.admin_units u
   WHERE u.level = 'province' AND u.is_active AND u.normalized_name = v_prov_key
   ORDER BY u.code
   LIMIT 1;

  -- 2. tên tỉnh trước sáp nhập
  IF v_prov IS NULL THEN
    SELECT u.code INTO v_prov
      FROM public.admin_units u
     WHERE u.level = 'province' AND u.is_active
       AND EXISTS (
             SELECT 1 FROM unnest(u.legacy_names) AS ln
              WHERE public.normalize_admin_name(ln) = v_prov_key
           )
     ORDER BY u.code
     LIMIT 1;
  END IF;

  IF v_prov IS NULL OR v_ward_key IS NULL THEN
    RETURN v_prov;
  END IF;

  -- 3. tên xã/phường hiện hành trong tỉnh đã giải
  SELECT count(*), min(u.code) INTO v_n, v_code
    FROM public.admin_units u
   WHERE u.level = 'commune' AND u.is_active
     AND u.parent_code = v_prov
     AND u.normalized_name = v_ward_key;
  IF v_n = 1 THEN RETURN v_code; END IF;
  IF v_n > 1 THEN RETURN v_prov; END IF;

  -- 4. tên xã/phường trước sáp nhập trong tỉnh đã giải
  SELECT count(*), min(u.code) INTO v_n, v_code
    FROM public.admin_units u
   WHERE u.level = 'commune' AND u.is_active
     AND u.parent_code = v_prov
     AND EXISTS (
           SELECT 1 FROM unnest(u.legacy_names) AS ln
            WHERE public.normalize_admin_name(ln) = v_ward_key
         );
  IF v_n = 1 THEN RETURN v_code; END IF;

  RETURN v_prov;
END;
$$;

COMMENT ON FUNCTION public.admin_unit_resolve(TEXT, TEXT) IS
  'So khớp best-effort văn bản tự do (tỉnh, xã/phường) → mã ĐVHC cụ thể nhất: tên hiện hành trước, rồi legacy_names, trong phạm vi tỉnh đã giải. CHỈ ĐỌC — không bao giờ ghi vào asset_postings.';

GRANT EXECUTE ON FUNCTION public.admin_unit_resolve(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_unit_resolve(TEXT, TEXT) FROM PUBLIC, anon;

-- ─── 5. Gắn mã ĐVHC vào không gian & chi nhánh ───────────────────────────────
-- Tỉnh ⇒ mã tỉnh trên `asset_owner_workspaces`; xã/phường ⇒ mã xã trên
-- `workspace_branches` (hình A) hoặc trên không gian con (hình B) — mục A2.
-- FK là RESTRICT chứ không SET NULL: SET NULL là một UPDATE, mà cả hai bảng đều
-- có trigger `owner_audit` + guard; và danh mục phải ngưng dùng bằng `is_active`
-- chứ không xoá dòng.
ALTER TABLE public.asset_owner_workspaces
  ADD COLUMN IF NOT EXISTS admin_unit_code TEXT
  REFERENCES public.admin_units(code) ON DELETE RESTRICT;

ALTER TABLE public.workspace_branches
  ADD COLUMN IF NOT EXISTS admin_unit_code TEXT
  REFERENCES public.admin_units(code) ON DELETE RESTRICT;

COMMENT ON COLUMN public.asset_owner_workspaces.admin_unit_code IS
  'Mã ĐVHC của Trạm (cấp tỉnh với UBND tỉnh, cấp xã với không gian của xã/phường). NULL = chưa gắn.';
COMMENT ON COLUMN public.workspace_branches.admin_unit_code IS
  'Mã ĐVHC cấp xã của chi nhánh (hình A: mỗi xã/phường là một chi nhánh của Trạm tỉnh). NULL = chưa gắn.';

CREATE INDEX IF NOT EXISTS idx_aow_admin_unit_code ON public.asset_owner_workspaces (admin_unit_code);
CREATE INDEX IF NOT EXISTS idx_wb_admin_unit_code  ON public.workspace_branches (admin_unit_code);

-- Quyền GHI cột: đúng bằng nhóm đã được sửa hai bảng này (`chi-nhanh:update`
-- gác ở RLS). `asset_owner_workspaces` chỉ có GRANT UPDATE theo CỘT (3 cột) nên
-- cột mới PHẢI được cấp tường minh, nếu không client gửi kèm nó sẽ bị
-- "permission denied for table" — lỗi nhắc BẢNG, dễ tưởng là RLS.
GRANT UPDATE (admin_unit_code) ON public.asset_owner_workspaces TO authenticated;
GRANT UPDATE (admin_unit_code) ON public.workspace_branches      TO authenticated;
GRANT INSERT (admin_unit_code) ON public.workspace_branches      TO authenticated;

-- ─── 6. Tự kiểm ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- anon đọc được, KHÔNG ghi được
  IF NOT has_table_privilege('anon', 'public.admin_units', 'SELECT') THEN
    RAISE EXCEPTION 'admin_units: anon phải SELECT được';
  END IF;
  IF has_table_privilege('anon', 'public.admin_units', 'INSERT')
     OR has_table_privilege('anon', 'public.admin_units', 'UPDATE')
     OR has_table_privilege('anon', 'public.admin_units', 'DELETE') THEN
    RAISE EXCEPTION 'admin_units: anon KHÔNG được ghi';
  END IF;
  -- cột mới phải ghi được bởi authenticated (RLS mới là cổng thật)
  IF NOT has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'admin_unit_code', 'UPDATE') THEN
    RAISE EXCEPTION 'asset_owner_workspaces.admin_unit_code: thiếu GRANT UPDATE';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.workspace_branches', 'admin_unit_code', 'UPDATE') THEN
    RAISE EXCEPTION 'workspace_branches.admin_unit_code: thiếu GRANT UPDATE';
  END IF;
  -- bộ giải mã không phơi cho anon
  IF has_function_privilege('anon', 'public.admin_unit_resolve(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'admin_unit_resolve: phải REVOKE khỏi anon';
  END IF;
  -- chuẩn hoá tên hoạt động đúng
  IF public.normalize_admin_name('Tỉnh Bắc Ninh') <> 'bac ninh'
     OR public.normalize_admin_name('Xã Tân Dĩnh') <> 'tan dinh'
     OR public.normalize_admin_name('TP. Hồ Chí Minh') <> 'ho chi minh'
     OR public.normalize_admin_name('Đặc khu Phú Quốc') <> 'phu quoc' THEN
    RAISE EXCEPTION 'normalize_admin_name: kết quả chuẩn hoá sai';
  END IF;
END $$;

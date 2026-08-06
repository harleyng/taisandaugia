-- ─────────────────────────────────────────────────────────────────────────────
-- Số hoá hồ sơ đấu giá viên / lãnh đạo — Migration C
--
--  1. RPC công khai cho mục "Đội ngũ đấu giá viên" trên /auction-org/:id
--  2. Seed biến thể dịch vụ cho việc XUẤT hồ sơ (1 credit / hồ sơ / lần)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. RPC công khai ───────────────────────────────────────────────────────
-- VÌ SAO LÀ RPC CHỨ KHÔNG PHẢI POLICY public-read:
-- RLS của Postgres là ROW-level, không phải COLUMN-level. Một policy
-- `USING (is_public_profile)` sẽ cho client anon gõ `select *` và nhận CẢ DÒNG
-- — gồm id_number (CCCD), email, phone, internal_notes, permanent_address.
-- Việc chọn 5 cột ở phía React không bảo vệ được gì. Hàm này khoá cứng đúng
-- những cột được phép lộ, và org_auctioneers KHÔNG có policy public-read nào.
CREATE OR REPLACE FUNCTION public.public_org_auctioneers(_auction_org_id UUID)
RETURNS TABLE (
  id                  UUID,
  full_name           TEXT,
  title               TEXT,
  license_number      TEXT,
  license_issued_date DATE,
  years_of_experience INT,
  portrait_url        TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id,
    a.full_name,
    COALESCE(
      NULLIF(a.public_title, ''),
      CASE a.position
        WHEN 'DIRECTOR'        THEN 'Giám đốc'
        WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc'
        ELSE 'Đấu giá viên'
      END
    ) AS title,
    a.license_number,
    a.license_issued_date,
    GREATEST(0, EXTRACT(YEAR FROM age(now(), a.license_issued_date))::int) AS years_of_experience,
    a.portrait_url
  FROM public.org_auctioneers a
  WHERE a.auction_org_id = _auction_org_id
    AND a.is_public_profile
    AND a.is_active
  ORDER BY
    CASE a.position WHEN 'DIRECTOR' THEN 0 WHEN 'DEPUTY_DIRECTOR' THEN 1 ELSE 2 END,
    a.license_issued_date;
$$;

GRANT EXECUTE ON FUNCTION public.public_org_auctioneers(UUID) TO anon, authenticated;

-- ─── 2. Catalog: xuất hồ sơ đấu giá viên ────────────────────────────────────
-- Giá là NGUỒN SỰ THẬT ở DB; code chỉ có hằng số fallback. Admin sửa được ở
-- /admin/dich-vu. Idempotent: services không unique theo name nên phải guard.
INSERT INTO public.services (name, kind, category, audience, credit_feature_key, price, credit_cost, sort_order)
SELECT 'Xuất hồ sơ đấu giá viên', 'credit', 'feature', 'company', 'export_personnel_dossier', 0, NULL, 34
WHERE NOT EXISTS (
  SELECT 1 FROM public.services WHERE name = 'Xuất hồ sơ đấu giá viên'
);

INSERT INTO public.service_variants
  (service_id, variant_key, name, price, base_credits, credits, credit_cost, sort_order)
SELECT s.id, 'export_personnel_dossier', 'Xuất hồ sơ đấu giá viên', 0, NULL, NULL, 1, 1
FROM public.services s
WHERE s.name = 'Xuất hồ sơ đấu giá viên'
ON CONFLICT (variant_key) DO NOTHING;

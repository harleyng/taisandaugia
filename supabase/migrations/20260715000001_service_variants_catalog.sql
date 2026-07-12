-- Catalog Dịch vụ 2 cấp: services (nhóm) → service_variants (biến thể, chứa giá).
-- Biến catalog thành NGUỒN SỰ THẬT cho giá gói credit + chi phí tính năng.
--
-- - services thêm `audience` (buyer|owner|company|all) trên NHÓM.
-- - service_variants: mỗi biến thể chứa price (VND, gói) hoặc credit_cost (tier/feature).
-- - Public read (is_active) cho services + service_variants: trang mua credit + hàm
--   unlock (non-admin) phải đọc được giá. Admin vẫn full CRUD.
-- - orders + credit_transactions thêm liên kết variant để quy doanh thu bền vững.

-- ─── services: thêm audience + public read ───────────────────────────────────

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('buyer', 'owner', 'company', 'all'));

DROP POLICY IF EXISTS "services_public_read" ON public.services;
CREATE POLICY "services_public_read"
  ON public.services FOR SELECT
  USING (is_active = true);

-- ─── service_variants (biến thể — chứa giá) ──────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.service_variant_code_seq START 1;

CREATE TABLE public.service_variants (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   UUID          NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  code         TEXT          UNIQUE,                        -- 'BV000001'
  variant_key  TEXT          NOT NULL UNIQUE,               -- khóa máy ổn định
  name         TEXT          NOT NULL,
  price        NUMERIC(12,0) NOT NULL DEFAULT 0,            -- VND (gói); 0 với tier/feature
  base_credits INTEGER,                                     -- credit trả tiền (gói)
  credits      INTEGER,                                     -- tổng credit nhận (gói)
  credit_cost  INTEGER,                                     -- credit trừ (tier/feature)
  is_popular   BOOLEAN       NOT NULL DEFAULT false,
  is_best      BOOLEAN       NOT NULL DEFAULT false,
  sort_order   INTEGER       NOT NULL DEFAULT 0,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_by   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_variants_service ON public.service_variants (service_id, sort_order);
CREATE INDEX idx_service_variants_active  ON public.service_variants (is_active);

ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_variants_public_read"
  ON public.service_variants FOR SELECT
  USING (is_active = true);

CREATE POLICY "service_variants_admin_all"
  ON public.service_variants FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_service_variant_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'BV' || lpad(nextval('public.service_variant_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_variants_set_code
  BEFORE INSERT ON public.service_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_service_variant_code();

CREATE TRIGGER service_variants_updated_at
  BEFORE UPDATE ON public.service_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── orders + credit_transactions: liên kết biến thể ─────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_variant_id UUID REFERENCES public.service_variants(id) ON DELETE SET NULL;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS service_variant_id UUID REFERENCES public.service_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_key TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_tx_variant
  ON public.credit_transactions (variant_key) WHERE variant_key IS NOT NULL;

-- ─── Re-seed catalog: xóa các dịch vụ credit phẳng cũ, giữ 'Quảng cáo' direct ──
-- An toàn: trigger orders_require_direct_service chặn đơn vào dịch vụ credit nên
-- không có FK orders trỏ vào các dòng credit này.

DELETE FROM public.services WHERE kind = 'credit';
UPDATE public.services SET audience = 'all' WHERE kind = 'direct';

-- Nhóm dịch vụ (kind='credit'); giá nằm ở biến thể (group price=0).
WITH g AS (
  INSERT INTO public.services (name, kind, category, audience, credit_feature_key, price, credit_cost, sort_order) VALUES
    ('Gói credit Người mua',        'credit', 'package', 'buyer',   NULL,                  0, NULL, 10),
    ('Gói credit Chủ tài sản',      'credit', 'package', 'owner',   NULL,                  0, NULL, 11),
    ('Gói credit Công ty đấu giá',  'credit', 'package', 'company', NULL,                  0, NULL, 12),
    ('Theo dõi chủ tài sản',        'credit', 'unlock',  'all',     'unlock_owner',        0, NULL, 20),
    ('Theo dõi công ty',            'credit', 'unlock',  'all',     'unlock_company',      0, NULL, 21),
    ('Mở khóa tài sản',             'credit', 'unlock',  'all',     'unlock_asset',        0, NULL, 22),
    ('Mở khóa báo cáo chuyên sâu',  'credit', 'unlock',  'all',     'unlock_deep_report',  0, NULL, 23),
    ('Báo cáo cơ hội',              'credit', 'feature', 'buyer',   'unlock_opp_report',   0, NULL, 30),
    ('Báo cáo danh mục',            'credit', 'feature', 'owner',   'owner_report_view',   0, NULL, 31),
    ('Xuất hồ sơ dự tuyển',         'credit', 'feature', 'company', 'export_profile',      0, NULL, 32)
  RETURNING id, name
)
INSERT INTO public.service_variants
  (service_id, variant_key, name, price, base_credits, credits, credit_cost, is_popular, is_best, sort_order)
SELECT g.id, v.variant_key, v.name,
       v.price::numeric, v.base_credits::int, v.credits::int, v.credit_cost::int,
       v.is_popular::bool, v.is_best::bool, v.sort_order::int
FROM g JOIN (VALUES
  -- Gói credit NGƯỜI MUA (base_credits, credits set; credit_cost NULL)
  ('Gói credit Người mua',       'buyer_nhap_mon',         'Nhập Môn',                 200000,    8,    8, NULL, false, false, 1),
  ('Gói credit Người mua',       'buyer_ts_thuc_tap',      'Thợ Săn Thực Tập',         500000,   20,   22, NULL, false, false, 2),
  ('Gói credit Người mua',       'buyer_ts_nghiep_du',     'Thợ Săn Nghiệp Dư',       1000000,   40,   44, NULL, false, false, 3),
  ('Gói credit Người mua',       'buyer_ts_chuyen_nghiep', 'Thợ Săn Chuyên Nghiệp',   2300000,   92,   96, NULL, false, false, 4),
  ('Gói credit Người mua',       'buyer_ts_cao_cap',       'Thợ Săn Cao Cấp',         2500000,  100,  116, NULL, true,  false, 5),
  ('Gói credit Người mua',       'buyer_trum_san',         'Trùm Săn Tài Sản',        5000000,  200,  250, NULL, false, true,  6),
  -- Gói credit CHỦ TÀI SẢN
  ('Gói credit Chủ tài sản',     'owner_dung_thu',         'Dùng Thử',                 500000,   20,   20, NULL, false, false, 1),
  ('Gói credit Chủ tài sản',     'owner_khoi_dong',        'Khởi Động',               1000000,   40,   44, NULL, false, false, 2),
  ('Gói credit Chủ tài sản',     'owner_tang_truong',      'Tăng Trưởng',             2500000,  100,  112, NULL, true,  false, 3),
  ('Gói credit Chủ tài sản',     'owner_but_pha',          'Bứt Phá',                 5000000,  200,  240, NULL, false, true,  4),
  -- Gói credit CÔNG TY ĐẤU GIÁ
  ('Gói credit Công ty đấu giá', 'company_khoi_dau',       'Khởi Đầu',                1500000,   60,   60, NULL, false, false, 1),
  ('Gói credit Công ty đấu giá', 'company_chuyen_nghiep',  'Chuyên Nghiệp',           3000000,  120,  150, NULL, true,  false, 2),
  ('Gói credit Công ty đấu giá', 'company_cao_cap',        'Cao Cấp',                 6000000,  240,  300, NULL, false, false, 3),
  ('Gói credit Công ty đấu giá', 'company_doanh_nghiep',   'Doanh Nghiệp',           12000000,  480,  600, NULL, false, false, 4),
  ('Gói credit Công ty đấu giá', 'company_tap_doan',       'Tập Đoàn',               24000000,  960, 1320, NULL, false, true,  5),
  -- Theo dõi chủ tài sản (credit_cost)
  ('Theo dõi chủ tài sản',       'track_owner_7d',         '7 ngày',                        0, NULL, NULL,   49, false, false, 1),
  ('Theo dõi chủ tài sản',       'track_owner_30d',        '30 ngày',                       0, NULL, NULL,  149, false, false, 2),
  ('Theo dõi chủ tài sản',       'track_owner_1y',         '1 năm',                         0, NULL, NULL,  995, false, false, 3),
  -- Theo dõi công ty
  ('Theo dõi công ty',           'track_company_7d',       '7 ngày',                        0, NULL, NULL,   99, false, false, 1),
  ('Theo dõi công ty',           'track_company_30d',      '30 ngày',                       0, NULL, NULL,  299, false, false, 2),
  ('Theo dõi công ty',           'track_company_1y',       '1 năm',                         0, NULL, NULL, 1990, false, false, 3),
  -- Mở khóa báo cáo chuyên sâu
  ('Mở khóa báo cáo chuyên sâu', 'deep_report_month',      'Tháng',                         0, NULL, NULL,  990, false, false, 1),
  ('Mở khóa báo cáo chuyên sâu', 'deep_report_quarter',    'Quý',                           0, NULL, NULL, 2490, false, false, 2),
  ('Mở khóa báo cáo chuyên sâu', 'deep_report_year',       'Năm',                           0, NULL, NULL, 8900, false, false, 3),
  -- Mở khóa tài sản
  ('Mở khóa tài sản',            'asset_unlock',           'Mở khóa tài sản',               0, NULL, NULL,   59, false, false, 1),
  -- Tính năng theo lượt (reprice)
  ('Báo cáo cơ hội',             'report_opp_buyer',       'Báo cáo cơ hội',                0, NULL, NULL,    1, false, false, 1),
  ('Báo cáo danh mục',           'report_portfolio_owner', 'Báo cáo danh mục',              0, NULL, NULL,    4, false, false, 1),
  ('Xuất hồ sơ dự tuyển',        'export_profile_company', 'Xuất hồ sơ dự tuyển',           0, NULL, NULL,   30, false, false, 1)
) AS v(group_name, variant_key, name, price, base_credits, credits, credit_cost, is_popular, is_best, sort_order)
  ON v.group_name = g.name;

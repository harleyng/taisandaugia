-- Seed demo cho tab "Chi nhánh / AMC": dữ liệu thật chỉ có 1 quan hệ mẹ–con nên
-- màn hình gần như trống. Thêm chi nhánh + công ty AMC cho vài pháp nhân sẵn có.
--
-- Bộ tên được chọn để CHẠM đúng các nhánh của infer_org_parents():
--   • ACB → token cha chỉ còn {chau} (1 token, dài 4) — luật "đủ đặc trưng".
--   • "Miền Nam tại Cần Thơ" khớp cả {dau,gia,hop,danh} lẫn {dau,gia,hop,danh,
--     mien,nam} — luật "cha cụ thể nhất thắng".
-- Idempotent: name là UNIQUE ở cả hai bảng, tin đấu giá gắn cờ seed_batch.

-- ─── 1. Chi nhánh / AMC của chủ tài sản ──────────────────────────────────────

INSERT INTO public.asset_owners (name, address, owner_kind) VALUES
  ('Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội',
   'Số 344 Bà Triệu, Hai Bà Trưng, Hà Nội', 'bank_credit'),
  ('Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hồ Chí Minh',
   'Số 5 Công Trường Mê Linh, Quận 1, TP. Hồ Chí Minh', 'bank_credit'),
  ('Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Ngoại thương Việt Nam',
   'Số 198 Trần Quang Khải, Hoàn Kiếm, Hà Nội', 'amc'),
  ('Ngân hàng TMCP Công Thương Việt Nam - Chi nhánh Đống Đa',
   'Số 187 Nguyễn Lương Bằng, Đống Đa, Hà Nội', 'bank_credit'),
  ('Ngân hàng TMCP Công Thương Việt Nam - Chi nhánh Thanh Xuân',
   'Số 275 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'bank_credit'),
  ('Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Công Thương Việt Nam',
   'Số 108 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', 'amc'),
  ('Ngân hàng TMCP Đầu tư và Phát triển Việt Nam - Chi nhánh Cầu Giấy',
   'Số 106 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 'bank_credit'),
  ('Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
   'Tháp BIDV, 194 Trần Quang Khải, Hoàn Kiếm, Hà Nội', 'amc'),
  ('Ngân hàng TMCP Á Châu - Chi nhánh Bình Thạnh',
   'Số 30 Phan Đăng Lưu, Bình Thạnh, TP. Hồ Chí Minh', 'bank_credit')
ON CONFLICT (name) DO NOTHING;

-- ─── 2. Chi nhánh của tổ chức đấu giá ────────────────────────────────────────

INSERT INTO public.auction_organizations (name, address, province, phone, email, org_type) VALUES
  ('Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Đà Nẵng',
   'Số 45 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Đà Nẵng', '02363888999',
   'danang@dgvietnam.vn', 11),
  ('Chi nhánh Công ty Đấu giá Hợp danh Miền Nam tại Cần Thơ',
   'Số 12 Trần Hưng Đạo, Ninh Kiều, Cần Thơ', 'Cần Thơ', '02923777888',
   'cantho@dgmiennam.vn', 11),
  ('Chi nhánh Trung tâm Dịch vụ Đấu giá Tài sản Hà Nội tại Long Biên',
   'Số 8 Ngô Gia Tự, Long Biên, Hà Nội', 'Hà Nội', '02438777666',
   'longbien@dgtshanoi.vn', 11)
ON CONFLICT (name) DO NOTHING;

-- ─── 3. Tin đấu giá cho các đơn vị mới ───────────────────────────────────────

-- Không dùng random(): migration phải cho cùng kết quả ở mọi lần chạy lại. Mọi
-- giá trị suy ra từ chỉ số dòng nên vẫn đủ đa dạng mà tất định.
WITH seeded_owner AS (
  SELECT o.id, o.name, row_number() OVER (ORDER BY o.name) AS rn
  FROM public.asset_owners o
  WHERE o.name IN (
    'Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hà Nội',
    'Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hồ Chí Minh',
    'Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Ngoại thương Việt Nam',
    'Ngân hàng TMCP Công Thương Việt Nam - Chi nhánh Đống Đa',
    'Ngân hàng TMCP Công Thương Việt Nam - Chi nhánh Thanh Xuân',
    'Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Công Thương Việt Nam',
    'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam - Chi nhánh Cầu Giấy',
    'Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    'Ngân hàng TMCP Á Châu - Chi nhánh Bình Thạnh'
  )
),
org_pool AS (
  SELECT a.id, row_number() OVER (ORDER BY a.name) - 1 AS idx, count(*) OVER () AS total
  FROM public.auction_organizations a
  WHERE a.org_type IS DISTINCT FROM 11
),
plan AS (
  SELECT
    o.id AS owner_id, o.name AS owner_name, o.rn,
    g.i,
    (o.rn * 7 + g.i * 3) AS seed
  FROM seeded_owner o
  -- 3–6 tin mỗi đơn vị, xoay theo thứ tự tên để số liệu không đều nhau.
  CROSS JOIN LATERAL generate_series(1, 3 + (o.rn % 4)) AS g(i)
),
prepared AS (
  SELECT
    p.*,
    (ARRAY['Hà Nội','TP. Hồ Chí Minh','Đà Nẵng','Cần Thơ','Hải Phòng',
           'Bình Dương','Đồng Nai','Khánh Hòa'])[(p.seed % 8) + 1] AS province,
    (ARRAY['dat-o','nha-rieng','can-ho','kho-xuong','van-phong',
           'nha-pho','dat-nen','biet-thu'])[(p.seed % 8) + 1] AS ptype,
    (ARRAY['ACTIVE','ACTIVE','ACTIVE','INACTIVE','SOLD_RENTED'])[(p.seed % 5) + 1] AS st,
    (ARRAY['Sổ đỏ','Sổ hồng','Hợp đồng mua bán','Đang chờ cấp sổ'])[(p.seed % 4) + 1] AS legal,
    (120 + (p.seed % 17) * 45)::NUMERIC AS area_val,
    (2500000000 + (p.seed % 23) * 1850000000)::NUMERIC AS price_val,
    (SELECT op.id FROM org_pool op WHERE op.idx = p.seed % op.total LIMIT 1) AS org_id
  FROM plan p
)
INSERT INTO public.listings (
  title, description, purpose, property_type_slug, price, price_unit, area,
  status, legal_status, address, asset_owner_id, auction_org_id,
  custom_attributes, created_at, updated_at
)
SELECT
  'Tài sản đấu giá ' || pr.ptype || ' ' || pr.area_val || 'm² tại ' || pr.province,
  'Tài sản bảo đảm do ' || pr.owner_name || ' phát mại theo quy định pháp luật.',
  'FOR_SALE',
  pr.ptype,
  pr.price_val,
  'TOTAL',
  pr.area_val,
  pr.st::listing_status,
  pr.legal,
  jsonb_build_object('province', pr.province, 'district', 'Trung tâm',
                     'ward', 'Phường ' || ((pr.seed % 12) + 1), 'street', 'Đường số ' || pr.seed),
  pr.owner_id,
  pr.org_id,
  jsonb_build_object('seed_batch', 'prospect_branches',
                     'asset_owner_name', pr.owner_name),
  now() - ((pr.seed % 300) || ' days')::INTERVAL,
  now() - ((pr.seed % 300) || ' days')::INTERVAL
FROM prepared pr
WHERE NOT EXISTS (
  SELECT 1 FROM public.listings l
  WHERE l.asset_owner_id = pr.owner_id
    AND l.custom_attributes->>'seed_batch' = 'prospect_branches'
);

-- Tin cho 3 chi nhánh tổ chức đấu giá (gắn vào auction_org_id, chủ tài sản là
-- các pháp nhân gốc sẵn có) — để cột "Tài sản" của chi nhánh không bằng 0.
WITH seeded_org AS (
  SELECT a.id, a.name, a.province, row_number() OVER (ORDER BY a.name) AS rn
  FROM public.auction_organizations a
  WHERE a.name IN (
    'Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Đà Nẵng',
    'Chi nhánh Công ty Đấu giá Hợp danh Miền Nam tại Cần Thơ',
    'Chi nhánh Trung tâm Dịch vụ Đấu giá Tài sản Hà Nội tại Long Biên'
  )
),
owner_pool AS (
  SELECT o.id, row_number() OVER (ORDER BY o.name) - 1 AS idx, count(*) OVER () AS total
  FROM public.asset_owners o
  WHERE o.owner_kind <> 'individual'
),
plan AS (
  SELECT s.id AS org_id, s.name AS org_name, s.province, s.rn, g.i,
         (s.rn * 11 + g.i * 5) AS seed
  FROM seeded_org s
  CROSS JOIN LATERAL generate_series(1, 3 + s.rn) AS g(i)
),
prepared AS (
  SELECT p.*,
    (ARRAY['dat-o','nha-rieng','can-ho','kho-xuong','van-phong',
           'nha-pho','dat-nen','biet-thu'])[(p.seed % 8) + 1] AS ptype,
    (ARRAY['ACTIVE','ACTIVE','INACTIVE','SOLD_RENTED'])[(p.seed % 4) + 1] AS st,
    (ARRAY['Sổ đỏ','Sổ hồng','Hợp đồng mua bán'])[(p.seed % 3) + 1] AS legal,
    (90 + (p.seed % 13) * 60)::NUMERIC AS area_val,
    (1800000000 + (p.seed % 19) * 2100000000)::NUMERIC AS price_val,
    (SELECT ow.id FROM owner_pool ow WHERE ow.idx = p.seed % ow.total LIMIT 1) AS owner_id
  FROM plan p
)
INSERT INTO public.listings (
  title, description, purpose, property_type_slug, price, price_unit, area,
  status, legal_status, address, asset_owner_id, auction_org_id,
  custom_attributes, created_at, updated_at
)
SELECT
  'Đấu giá ' || pr.ptype || ' ' || pr.area_val || 'm² tại ' || pr.province,
  'Tài sản do ' || pr.org_name || ' tổ chức đấu giá.',
  'FOR_SALE', pr.ptype, pr.price_val, 'TOTAL', pr.area_val,
  pr.st::listing_status, pr.legal,
  jsonb_build_object('province', pr.province, 'district', 'Trung tâm',
                     'ward', 'Phường ' || ((pr.seed % 9) + 1), 'street', 'Đường số ' || pr.seed),
  pr.owner_id, pr.org_id,
  jsonb_build_object('seed_batch', 'prospect_branches'),
  now() - ((pr.seed % 240) || ' days')::INTERVAL,
  now() - ((pr.seed % 240) || ' days')::INTERVAL
FROM prepared pr
WHERE NOT EXISTS (
  SELECT 1 FROM public.listings l
  WHERE l.auction_org_id = pr.org_id
    AND l.custom_attributes->>'seed_batch' = 'prospect_branches'
);

-- ─── 4. Nối quan hệ mẹ–con ───────────────────────────────────────────────────

SELECT public.infer_org_parents();

-- Một vài quan hệ đánh dấu đã xác nhận để màn hình thấy được cả hai badge
-- ("Hệ thống suy ra" vs "Đã xác nhận").
UPDATE public.asset_owners SET parent_source = 'confirmed'
 WHERE parent_owner_id IS NOT NULL
   AND name IN (
     'Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Ngoại thương Việt Nam',
     'Ngân hàng TMCP Công Thương Việt Nam - Chi nhánh Đống Đa'
   );

UPDATE public.auction_organizations SET parent_source = 'confirmed'
 WHERE parent_org_id IS NOT NULL
   AND name = 'Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Đà Nẵng';

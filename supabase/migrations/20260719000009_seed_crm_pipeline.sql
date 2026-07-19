-- Seed phễu CRM: khách hàng · khách hàng tiềm năng · cơ hội · đơn chốt được.
--
-- Hình dạng phễu theo ảnh 3 (Bán hàng / Chờ xét duyệt / Bị từ chối / Thành công
-- / Thất bại) = 16 / 6 / 4 / 38 / 8 = 72 cơ hội.
--
-- Ngữ nghĩa gán chủ thể:
--   cơ hội đang mở & thua sớm  → còn ở lead_id (chưa chuyển đổi)
--   cơ hội thắng               → ở customer_id (chốt thắng luôn chuyển đổi lead)
--
-- BẤT BIẾN SEED: chèn cơ hội thắng TRỰC TIẾP ở stage='won' — trigger
-- opportunities_guard_won chỉ chặn UPDATE, không chặn INSERT, nên seed không
-- cần set_config nào. won_order_id gán ở bước sau (stage vẫn 'won' ⇒ guard
-- không kích). KHÔNG set amount cho đơn hoa hồng (trigger sở hữu).
--
-- Sentinel: customers ccc00002… · leads 1ead0001… · opportunities 0bb00001…
--           orders d40b0002…

-- ─── Dọn seed cũ (ngược thứ tự FK) ───────────────────────────────────────────

DELETE FROM public.orders        WHERE id::text LIKE 'd40b0002%';
DELETE FROM public.opportunities WHERE id::text LIKE '0bb00001%';
UPDATE public.leads SET status = 'new', converted_customer_id = NULL, converted_at = NULL
 WHERE id::text LIKE '1ead0001%';
DELETE FROM public.leads         WHERE id::text LIKE '1ead0001%';
DELETE FROM public.customers     WHERE id::text LIKE 'ccc00002%';

-- ─── 22 khách hàng (bên đã chốt được) ────────────────────────────────────────

INSERT INTO public.customers (id, name, customer_type, segment, contact_name, phone, email, tax_code, address, status, note)
SELECT
  ('ccc00002-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (ARRAY[
    'Công ty Đấu giá Hợp danh Bảo Tín','Công ty Đấu giá Hợp danh Minh Khang',
    'Ngân hàng TMCP Phương Đông','Công ty CP Đầu tư Tân Thịnh Phát',
    'Công ty Đấu giá Tài sản Trường An','Chi cục Thi hành án dân sự Bình Dương',
    'Công ty TNHH Quản lý Tài sản Việt Tín','Công ty CP Địa ốc Hoàng Gia',
    'Ngân hàng TMCP Bắc Á','Công ty Đấu giá Hợp danh Thành Đạt',
    'Công ty CP Xây dựng Sông Hồng','Quỹ Đầu tư Phát triển Đà Nẵng',
    'Công ty TNHH Thương mại Nam Việt','Công ty CP Bất động sản An Cư',
    'Ngân hàng TMCP Hàng Hải','Công ty Đấu giá Tài sản Phú Quý',
    'Công ty CP Đầu tư Đại Dương','Tổng công ty Xi măng Việt Nam',
    'Công ty TNHH Vạn Xuân Land','Công ty CP Chứng khoán Rồng Việt',
    'Ông Trần Đình Khoa','Bà Nguyễn Thị Thu Hằng'
  ])[g],
  CASE WHEN g >= 21 THEN 'individual' ELSE 'company' END,
  (ARRAY['auction_company','auction_company','bank','investor','auction_company','other',
         'other','broker','bank','auction_company','other','investor','other','broker',
         'bank','auction_company','investor','other','broker','investor','investor','asset_owner'])[g],
  (ARRAY[
    'Nguyễn Văn Thành','Trần Thị Bích Ngọc','Lê Hoàng Nam','Phạm Quang Huy',
    'Vũ Thị Hồng Nhung','Đỗ Trung Kiên','Bùi Thanh Sơn','Ngô Minh Tuấn',
    'Hoàng Thị Lan Anh','Đặng Văn Cường','Lý Thị Kim Chi','Trịnh Bá Long',
    'Mai Xuân Hòa','Chu Thị Thanh Vân','Phan Đức Thắng','Dương Hải Yến',
    'Tạ Quang Vinh','Lâm Ngọc Bích','Hồ Sỹ Đạt','Cao Thị Mỹ Linh',
    'Trần Đình Khoa','Nguyễn Thị Thu Hằng'
  ])[g],
  '09' || lpad((((g * 7919) % 100000000))::text, 8, '0'),
  'kh' || lpad(g::text, 2, '0') || '@example.com',
  CASE WHEN g >= 21 THEN NULL ELSE '03' || lpad((((g * 3571) % 100000000))::text, 8, '0') END,
  (ARRAY['Hà Nội','TP. Hồ Chí Minh','Đà Nẵng','Hải Phòng','Cần Thơ','Bình Dương'])[1 + (g % 6)],
  'active', '[crm-seed]'
FROM generate_series(1, 22) AS g;

-- ─── 64 khách hàng tiềm năng ─────────────────────────────────────────────────
-- 18 đã chuyển đổi (gắn 18 khách đầu) · 46 còn trong phễu.

INSERT INTO public.leads (id, name, contact_name, phone, email, company_name, lead_type, source, status, province, note, converted_customer_id, converted_at)
SELECT
  ('1ead0001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (ARRAY['Công ty','Văn phòng','Chi nhánh','Trung tâm'])[1 + (g % 4)] || ' '
    || (ARRAY['Đấu giá','Thẩm định','Đầu tư','Bất động sản','Tài chính','Xây dựng','Thương mại','Dịch vụ'])[1 + (g % 8)]
    || ' ' || (ARRAY['Bình Minh','Hoàng Long','Đại Nam','Thái Sơn','Kim Cương','Phú Thịnh','An Khang','Tân Tiến','Vĩnh Phát','Hưng Thịnh'])[1 + (g % 10)],
  (ARRAY['Nguyễn Văn An','Trần Thị Bình','Lê Minh Cường','Phạm Thu Dung','Vũ Đức Em',
         'Hoàng Thị Giang','Đỗ Văn Hải','Bùi Thị Hoa','Ngô Quang Ích','Đặng Thị Kim'])[1 + (g % 10)],
  '09' || lpad((((g * 6151) % 100000000))::text, 8, '0'),
  'lead' || lpad(g::text, 2, '0') || '@example.com',
  CASE WHEN g % 5 = 0 THEN NULL ELSE 'Công ty TNHH ' || (ARRAY['Bình Minh','Hoàng Long','Đại Nam','Thái Sơn','Kim Cương'])[1 + (g % 5)] END,
  (ARRAY['auction_company','asset_owner','bank','investor','broker','other'])[1 + (g % 6)],
  (ARRAY['contact_form','partnership_form','hotline','email','referral','event','ads','other'])[1 + (g % 8)],
  CASE
    WHEN g <= 18 THEN 'converted'
    WHEN g <= 42 THEN 'new'
    WHEN g <= 54 THEN 'contacted'
    WHEN g <= 62 THEN 'qualified'
    ELSE 'disqualified'
  END,
  (ARRAY['Hà Nội','TP. Hồ Chí Minh','Đà Nẵng','Hải Phòng','Cần Thơ','Bình Dương','Đồng Nai','Khánh Hòa'])[1 + (g % 8)],
  '[crm-seed]',
  CASE WHEN g <= 18 THEN ('ccc00002-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid END,
  CASE WHEN g <= 18 THEN now() - (((g * 13) % 200) || ' days')::interval END
FROM generate_series(1, 64) AS g;

-- Khách hàng ghi ngược nguồn gốc lead (đúng như RPC chuyển đổi vẫn làm).
UPDATE public.customers c
   SET source_lead_id = l.id
  FROM public.leads l
 WHERE l.converted_customer_id = c.id AND c.id::text LIKE 'ccc00002%';

-- ─── 72 cơ hội ───────────────────────────────────────────────────────────────
-- 1..38  Thành công (trên khách hàng)
-- 39..54 Bán hàng (16 — trên lead đang mở)
-- 55..60 Chờ xét duyệt (6 — trên lead)
-- 61..64 Bị từ chối (4 — trên lead)
-- 65..72 Thất bại (8 — trên lead)
--
-- Cơ hội 35..38 là bán GÓI CREDIT: thắng nhưng KHÔNG sinh đơn
-- (revenue_mode='credit_ledger') — đơn chỉ ra đời khi khách nạp thật.

INSERT INTO public.opportunities (
  id, name, lead_id, customer_id, opportunity_type, stage,
  service_id, service_variant_id, service_kind,
  amount, gross_amount, commission_type, commission_value,
  expected_close_at, lost_reason, revenue_mode, sort_order, note, created_at
)
SELECT
  ('0bb00001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (ARRAY['Hợp đồng mới','Gia hạn dịch vụ','Nâng cấp gói','Bán thêm dịch vụ','Hợp đồng môi giới'])[1 + (g % 5)],
  -- Thắng → gắn khách hàng; còn lại → gắn lead đang trong phễu (19..64).
  CASE WHEN g > 38 THEN ('1ead0001-0000-4000-8000-' || lpad((19 + ((g - 39) % 44))::text, 12, '0'))::uuid END,
  CASE WHEN g <= 38 THEN ('ccc00002-0000-4000-8000-' || lpad((1 + ((g - 1) % 22))::text, 12, '0'))::uuid END,
  (ARRAY['new_business','renewal','upsell','cross_sell','referral'])[1 + (g % 5)],
  CASE
    WHEN g <= 38 THEN 'won'
    WHEN g <= 54 THEN 'selling'
    WHEN g <= 60 THEN 'pending_approval'
    WHEN g <= 64 THEN 'rejected'
    ELSE 'lost'
  END,
  v.service_id, v.variant_id, v.kind,
  v.amount, v.gross, v.ctype, v.cvalue,
  now() + (((g * 17) % 60) - 25 || ' days')::interval,   -- một số đã quá hạn
  CASE WHEN g > 60 THEN (ARRAY['Giá cao hơn đối thủ','Khách hoãn ngân sách','Không đủ hồ sơ pháp lý','Chọn nhà cung cấp khác'])[1 + (g % 4)] END,
  CASE WHEN g <= 34 THEN 'order' WHEN g <= 38 THEN 'credit_ledger' ELSE 'none' END,
  g,
  '[crm-seed]',
  now() - (((g * 29) % 300) || ' days')::interval
FROM generate_series(1, 72) AS g
CROSS JOIN LATERAL (
  -- Chọn vòng tròn theo SỐ DÒNG THỰC TẾ (row_number % total), KHÔNG dùng
  -- OFFSET hằng: nhóm 'direct' chỉ có đúng một dịch vụ nên OFFSET 1 sẽ trả
  -- rỗng và CROSS JOIN LATERAL lặng lẽ nuốt mất dòng đó.
  SELECT
    s.id AS service_id,
    sv.id AS variant_id,
    s.kind AS kind,
    CASE
      WHEN s.kind = 'commission' AND sv.commission_type = 'percent'
        THEN round(((300 + ((g * 41) % 1500)) * 1000000)::numeric * sv.commission_value / 100)
      WHEN s.kind = 'commission'
        THEN sv.commission_value
      WHEN s.kind = 'credit' THEN COALESCE(sv.price, 2500000)
      ELSE ((20 + ((g * 7) % 80)) * 1000000)::numeric
    END AS amount,
    CASE
      WHEN s.kind = 'commission' THEN ((300 + ((g * 41) % 1500)) * 1000000)::numeric
      WHEN s.kind = 'credit' THEN COALESCE(sv.price, 2500000)
      ELSE ((20 + ((g * 7) % 80)) * 1000000)::numeric
    END AS gross,
    CASE WHEN s.kind = 'commission' THEN sv.commission_type END AS ctype,
    CASE WHEN s.kind = 'commission' THEN sv.commission_value END AS cvalue
  FROM (
    SELECT s0.*,
           row_number() OVER (ORDER BY s0.sort_order, s0.id) AS rn,
           count(*)     OVER ()                              AS total
      FROM public.services s0
     WHERE s0.is_active
       AND s0.kind = CASE
         WHEN g BETWEEN 35 AND 38 THEN 'credit'       -- 4 cơ hội bán gói credit
         WHEN g % 3 = 0            THEN 'commission'
         ELSE 'direct'
       END
       AND (s0.kind <> 'credit' OR s0.category = 'package')
  ) s
  LEFT JOIN LATERAL (
    SELECT x.id, x.price, x.commission_type, x.commission_value
      FROM (
        SELECT x0.*,
               row_number() OVER (ORDER BY x0.sort_order, x0.id) AS rn,
               count(*)     OVER ()                              AS total
          FROM public.service_variants x0
         WHERE x0.service_id = s.id AND x0.is_active
      ) x
     WHERE x.rn = 1 + (g % x.total)
  ) sv ON true
  WHERE s.rn = 1 + (g % s.total)
) AS v;

-- ─── Đơn hàng cho 34 cơ hội thắng có sinh doanh thu ──────────────────────────
-- Cơ hội 35..38 (gói credit) cố ý KHÔNG có đơn.
-- KHÔNG truyền amount cho đơn hoa hồng — trigger tự tính từ gross × tỷ lệ.

INSERT INTO public.orders (
  id, customer_id, service_id, service_variant_id, opportunity_id,
  quantity, amount, gross_amount, commission_type, commission_value,
  fulfillment_status, ordered_at, note
)
SELECT
  ('d40b0002-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  o.customer_id, o.service_id, o.service_variant_id, o.id,
  1,
  CASE WHEN o.service_kind = 'commission' THEN 0 ELSE o.amount END,
  o.gross_amount, o.commission_type, o.commission_value,
  CASE WHEN g % 7 = 0 THEN 'pending' ELSE 'fulfilled' END,
  COALESCE(o.closed_at, now()),
  '[crm-seed] Chốt từ cơ hội ' || o.code
FROM generate_series(1, 34) AS g
JOIN public.opportunities o
  ON o.id = ('0bb00001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid;

-- Gắn ngược đơn vào cơ hội. stage vẫn 'won' nên guard không kích.
UPDATE public.opportunities o
   SET won_order_id = ord.id
  FROM public.orders ord
 WHERE ord.opportunity_id = o.id AND o.id::text LIKE '0bb00001%';

-- ─── Kiểm chứng hình dạng phễu + tính nhất quán ──────────────────────────────
DO $$
DECLARE
  v_total INTEGER; v_won INTEGER; v_no_order INTEGER; v_xor INTEGER; v_credit INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM public.opportunities WHERE id::text LIKE '0bb00001%';
  IF v_total <> 72 THEN RAISE EXCEPTION 'Seed cơ hội: mong 72, có %', v_total; END IF;

  SELECT count(*) INTO v_won FROM public.opportunities WHERE id::text LIKE '0bb00001%' AND stage='won';
  IF v_won <> 38 THEN RAISE EXCEPTION 'Seed: mong 38 cơ hội thắng, có %', v_won; END IF;

  -- Thắng + revenue_mode='order' thì BẮT BUỘC có đơn.
  SELECT count(*) INTO v_no_order FROM public.opportunities
   WHERE id::text LIKE '0bb00001%' AND stage='won' AND revenue_mode='order' AND won_order_id IS NULL;
  IF v_no_order > 0 THEN RAISE EXCEPTION 'Seed: % cơ hội thắng thiếu đơn', v_no_order; END IF;

  -- Gói credit thắng thì KHÔNG được có đơn.
  SELECT count(*) INTO v_credit FROM public.opportunities
   WHERE id::text LIKE '0bb00001%' AND revenue_mode='credit_ledger' AND won_order_id IS NOT NULL;
  IF v_credit > 0 THEN RAISE EXCEPTION 'Seed: % cơ hội credit không được sinh đơn', v_credit; END IF;

  SELECT count(*) INTO v_xor FROM public.opportunities
   WHERE id::text LIKE '0bb00001%' AND num_nonnulls(lead_id, customer_id) <> 1;
  IF v_xor > 0 THEN RAISE EXCEPTION 'Seed: % cơ hội vi phạm xor lead/customer', v_xor; END IF;
END $$;

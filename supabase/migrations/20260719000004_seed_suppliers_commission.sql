-- Seed dữ liệu thử cho Nhà cung cấp + dịch vụ hoa hồng + đơn hoa hồng.
--
-- Idempotent: xoá theo TIỀN TỐ UUID sentinel (không theo `note` — người dùng sửa
-- được note), thứ tự ngược FK. Marker text '[crm-seed]' — cố ý KHÔNG dùng
-- '[demo]' vì 20260715000002 xoá bằng LIKE '%[demo]%' wildcard.
--
-- Xác định (deterministic): số học nguyên tố-modulo, KHÔNG random()/setseed()
-- để chạy lại cho cùng kết quả và Gate B đối chiếu được.
--
-- Sentinel: suppliers 50cc… · services 5e4c… · variants bbaa… · customers ccc0…
--           orders d40b0001…
--
-- BẤT BIẾN SEED: không set `amount` và `service_kind` cho đơn hoa hồng — trigger
-- orders_sync_kind_and_commission sở hữu hai cột đó, và để nó tự tính CHÍNH LÀ
-- phép thử. Không set advertisement_id (orders_fulfill_on_link sẽ đóng dấu
-- fulfilled_at = now() lên đơn lùi ngày). Không hardcode `code`.

-- ─── Dọn dữ liệu seed cũ (ngược thứ tự FK) ───────────────────────────────────

DELETE FROM public.orders           WHERE id::text LIKE 'd40b0001%';
DELETE FROM public.service_variants WHERE id::text LIKE 'bbaa0001%';
DELETE FROM public.services         WHERE id::text LIKE '5e4c0001%';
DELETE FROM public.suppliers        WHERE id::text LIKE '50cc0001%';
DELETE FROM public.customers        WHERE id::text LIKE 'ccc00001%'
  AND NOT EXISTS (SELECT 1 FROM public.orders o
                   WHERE o.customer_id = customers.id AND o.id::text NOT LIKE 'd40b0001%');

-- ─── Nhà cung cấp ────────────────────────────────────────────────────────────
-- 1 NCC gắn thẻ partners sẵn có (nhánh "hiển thị trên sàn"), 5 quan hệ ngầm.

INSERT INTO public.suppliers
  (id, name, supplier_type, contact_name, phone, email, tax_code, address,
   bank_name, bank_account, default_commission_type, default_commission_rate,
   partner_id, status, note)
VALUES
  ('50cc0001-0000-4000-8000-000000000001', 'Antiquorum', 'company',
   'Nguyễn Thanh Hà', '0903112233', 'hopgtac@antiquorum.example', '0301234567',
   'Quận 1, TP. Hồ Chí Minh', 'Vietcombank', '0071000123456', 'percent', 12.00,
   'face0001-0000-4000-8000-000000000001', 'active', '[crm-seed] Đối tác hiển thị trên sàn'),

  ('50cc0001-0000-4000-8000-000000000002', 'Công ty CP Thẩm định giá Miền Nam', 'company',
   'Trần Quốc Bảo', '0912445566', 'bao.tran@tdgmiennam.example', '0302345678',
   'Quận Bình Thạnh, TP. Hồ Chí Minh', 'Techcombank', '19033445566012', 'percent', 15.00,
   NULL, 'active', '[crm-seed] Quan hệ ngầm'),

  ('50cc0001-0000-4000-8000-000000000003', 'Văn phòng Công chứng Trường Sơn', 'company',
   'Lê Thị Mai Hương', '0987334455', 'huong.le@vpcctruongson.example', '0303456789',
   'Quận Cầu Giấy, Hà Nội', 'BIDV', '21010004455667', 'fixed', 3000000,
   NULL, 'active', '[crm-seed] Quan hệ ngầm'),

  ('50cc0001-0000-4000-8000-000000000004', 'Công ty TNHH Vận chuyển & Kho vận Bắc Hà', 'company',
   'Phạm Văn Dũng', '0938776655', 'dung.pham@bacha-logistics.example', '0304567890',
   'Quận Long Biên, Hà Nội', 'MB Bank', '0999112233445', 'percent', 8.00,
   NULL, 'active', '[crm-seed] Quan hệ ngầm'),

  ('50cc0001-0000-4000-8000-000000000005', 'Tổng công ty Bảo hiểm An Tín', 'company',
   'Vũ Ngọc Lan', '0356889900', 'lan.vu@baohiemantin.example', '0305678901',
   'Quận Hải Châu, Đà Nẵng', 'VietinBank', '10200055667788', 'percent', 18.00,
   NULL, 'active', '[crm-seed] Quan hệ ngầm'),

  ('50cc0001-0000-4000-8000-000000000006', 'Chuyên viên định giá độc lập — Đỗ Minh Khoa', 'individual',
   'Đỗ Minh Khoa', '0779223344', 'khoa.do@dinhgia.example', NULL,
   'Quận Ninh Kiều, Cần Thơ', 'ACB', '2299887766', 'fixed', 2000000,
   NULL, 'inactive', '[crm-seed] Quan hệ ngầm, tạm ngưng');

-- ─── Nhóm dịch vụ hoa hồng (category bắt buộc = 'brokerage') ─────────────────

INSERT INTO public.services
  (id, name, kind, category, audience, price, supplier_id, description, is_active, sort_order)
VALUES
  ('5e4c0001-0000-4000-8000-000000000001', 'Thẩm định giá tài sản', 'commission', 'brokerage', 'all', 0,
   '50cc0001-0000-4000-8000-000000000002',
   '[crm-seed] Môi giới dịch vụ thẩm định giá cho tài sản chuẩn bị đấu giá', true, 40),

  ('5e4c0001-0000-4000-8000-000000000002', 'Công chứng & pháp lý hồ sơ', 'commission', 'brokerage', 'all', 0,
   '50cc0001-0000-4000-8000-000000000003',
   '[crm-seed] Môi giới dịch vụ công chứng, soát xét pháp lý hồ sơ tài sản', true, 41),

  ('5e4c0001-0000-4000-8000-000000000003', 'Vận chuyển & kho bãi', 'commission', 'brokerage', 'all', 0,
   '50cc0001-0000-4000-8000-000000000004',
   '[crm-seed] Môi giới vận chuyển, lưu kho tài sản sau đấu giá', true, 42),

  ('5e4c0001-0000-4000-8000-000000000004', 'Bảo hiểm tài sản đấu giá', 'commission', 'brokerage', 'all', 0,
   '50cc0001-0000-4000-8000-000000000005',
   '[crm-seed] Môi giới gói bảo hiểm cho tài sản trúng đấu giá', true, 43);

-- ─── Biến thể: trộn percent 8–18% và fixed 2–5tr ─────────────────────────────

INSERT INTO public.service_variants
  (id, service_id, variant_key, name, price, commission_type, commission_value, sort_order, is_active)
VALUES
  ('bbaa0001-0000-4000-8000-000000000001', '5e4c0001-0000-4000-8000-000000000001',
   'brokerage_tdg_co_ban',     'Thẩm định cơ bản',        0, 'percent', 10.00, 1, true),
  ('bbaa0001-0000-4000-8000-000000000002', '5e4c0001-0000-4000-8000-000000000001',
   'brokerage_tdg_chuyen_sau', 'Thẩm định chuyên sâu',    0, 'percent', 15.00, 2, true),
  ('bbaa0001-0000-4000-8000-000000000003', '5e4c0001-0000-4000-8000-000000000001',
   'brokerage_tdg_tron_goi',   'Thẩm định trọn gói',      0, 'percent', 18.00, 3, true),

  ('bbaa0001-0000-4000-8000-000000000004', '5e4c0001-0000-4000-8000-000000000002',
   'brokerage_cc_ho_so',       'Công chứng hồ sơ',        0, 'fixed',  3000000, 1, true),
  ('bbaa0001-0000-4000-8000-000000000005', '5e4c0001-0000-4000-8000-000000000002',
   'brokerage_cc_soat_xet',    'Soát xét pháp lý',        0, 'fixed',  5000000, 2, true),
  ('bbaa0001-0000-4000-8000-000000000006', '5e4c0001-0000-4000-8000-000000000002',
   'brokerage_cc_tu_van',      'Tư vấn pháp lý trọn gói', 0, 'percent', 12.00, 3, true),

  ('bbaa0001-0000-4000-8000-000000000007', '5e4c0001-0000-4000-8000-000000000003',
   'brokerage_vc_noi_tinh',    'Vận chuyển nội tỉnh',     0, 'fixed',  2000000, 1, true),
  ('bbaa0001-0000-4000-8000-000000000008', '5e4c0001-0000-4000-8000-000000000003',
   'brokerage_vc_lien_tinh',   'Vận chuyển liên tỉnh',    0, 'percent',  8.00, 2, true),

  ('bbaa0001-0000-4000-8000-000000000009', '5e4c0001-0000-4000-8000-000000000004',
   'brokerage_bh_co_ban',      'Bảo hiểm cơ bản',         0, 'percent', 14.00, 1, true),
  ('bbaa0001-0000-4000-8000-000000000010', '5e4c0001-0000-4000-8000-000000000004',
   'brokerage_bh_toan_dien',   'Bảo hiểm toàn diện',      0, 'percent', 18.00, 2, true);

-- ─── Khách hàng B2B (bên trả tiền cho đơn hoa hồng) ─────────────────────────

INSERT INTO public.customers
  (id, name, customer_type, contact_name, phone, email, tax_code, address, status, note)
VALUES
  ('ccc00001-0000-4000-8000-000000000001', 'Công ty Đấu giá Hợp danh Bảo Tín', 'company',
   'Nguyễn Văn Thành', '0901234567', 'thanh.nguyen@baotin.example', '0310001111',
   'Quận Đống Đa, Hà Nội', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000002', 'Công ty Đấu giá Hợp danh Minh Khang', 'company',
   'Trần Thị Bích Ngọc', '0912345678', 'ngoc.tran@minhkhang.example', '0310002222',
   'Quận 3, TP. Hồ Chí Minh', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000003', 'Ngân hàng TMCP Phương Đông — Khối xử lý nợ', 'company',
   'Lê Hoàng Nam', '0923456789', 'nam.le@pdbank.example', '0310003333',
   'Quận 1, TP. Hồ Chí Minh', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000004', 'Công ty CP Đầu tư Tân Thịnh Phát', 'company',
   'Phạm Quang Huy', '0934567890', 'huy.pham@tanthinhphat.example', '0310004444',
   'Quận Hải Châu, Đà Nẵng', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000005', 'Công ty Đấu giá Tài sản Trường An', 'company',
   'Vũ Thị Hồng Nhung', '0945678901', 'nhung.vu@truongan.example', '0310005555',
   'Quận Ngô Quyền, Hải Phòng', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000006', 'Chi cục Thi hành án dân sự tỉnh Bình Dương', 'company',
   'Đỗ Trung Kiên', '0956789012', 'kien.do@thads-bd.example', '0310006666',
   'TP. Thủ Dầu Một, Bình Dương', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000007', 'Ông Hoàng Minh Tuấn', 'individual',
   'Hoàng Minh Tuấn', '0967890123', 'tuan.hoang@example.com', NULL,
   'Quận Ninh Kiều, Cần Thơ', 'active', '[crm-seed]'),
  ('ccc00001-0000-4000-8000-000000000008', 'Công ty TNHH Quản lý Tài sản Việt Tín', 'company',
   'Bùi Thanh Sơn', '0978901234', 'son.bui@viettin-am.example', '0310008888',
   'Quận Thanh Xuân, Hà Nội', 'active', '[crm-seed]');

-- ─── 26 đơn hoa hồng trải 420 ngày ───────────────────────────────────────────
-- gross = (200 + (g*37 % 1800)) triệu → 26 giá trị phân biệt, trải 200tr–2.000tr
-- (37 nguyên tố, không chia hết 1800). Ngày = (g*137 % 420) ngày trước.
-- amount + service_kind do trigger tính — seed CỐ Ý không truyền.

INSERT INTO public.orders
  (id, customer_id, service_id, service_variant_id,
   quantity, gross_amount, commission_type, commission_value,
   fulfillment_status, ordered_at, note)
SELECT
  ('d40b0001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  cus.id,
  v.service_id,
  v.id,
  CASE WHEN v.commission_type = 'fixed' THEN 1 + (g % 3) ELSE 1 END,
  ((200 + ((g * 37) % 1800)) * 1000000)::numeric,
  v.commission_type,
  v.commission_value,
  CASE WHEN g % 9 = 0 THEN 'cancelled'
       WHEN g % 4 = 0 THEN 'pending'
       ELSE 'fulfilled' END,
  now() - (((g * 137) % 420) || ' days')::interval,
  '[crm-seed] Đơn môi giới dịch vụ'
FROM generate_series(1, 26) AS g
CROSS JOIN LATERAL (
  SELECT sv.id, sv.service_id, sv.commission_type, sv.commission_value
    FROM public.service_variants sv
   WHERE sv.id::text LIKE 'bbaa0001%'
   ORDER BY sv.variant_key
   OFFSET (g * 7) % 10 LIMIT 1
) AS v
CROSS JOIN LATERAL (
  SELECT c.id FROM public.customers c
   WHERE c.id::text LIKE 'ccc00001%'
   ORDER BY c.code
   OFFSET (g * 3) % 8 LIMIT 1
) AS cus;

-- ─── Kiểm chứng: trigger tính hoa hồng đúng công thức ────────────────────────
DO $$
DECLARE
  v_bad   INTEGER;
  v_kind  INTEGER;
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM public.orders WHERE id::text LIKE 'd40b0001%';
  IF v_count <> 26 THEN
    RAISE EXCEPTION 'Seed hoa hồng: mong 26 đơn, có %', v_count;
  END IF;

  SELECT count(*) INTO v_kind
    FROM public.orders WHERE id::text LIKE 'd40b0001%' AND service_kind <> 'commission';
  IF v_kind > 0 THEN
    RAISE EXCEPTION 'Seed hoa hồng: % đơn sai service_kind', v_kind;
  END IF;

  SELECT count(*) INTO v_bad
    FROM public.orders
   WHERE id::text LIKE 'd40b0001%'
     AND amount <> round(CASE WHEN commission_type = 'percent'
                              THEN gross_amount * commission_value / 100
                              ELSE commission_value * quantity END);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Seed hoa hồng sai công thức ở % đơn', v_bad;
  END IF;
END $$;

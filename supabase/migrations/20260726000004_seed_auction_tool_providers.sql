-- Seed provider + supplier + dịch vụ + showcase cho 4 công cụ đấu giá.
--
-- Idempotent theo TIỀN TỐ UUID sentinel, xoá ngược thứ tự FK. Marker '[tools-seed]'.
-- Sentinel: suppliers 50cc0002… · services 5e4c0002… · variants bbaa0002…
--           providers a70d0001… · showcases a70e0001…
--
-- Điều khoản hoa hồng ở biến thể là PLACEHOLDER — admin chỉnh lại theo hợp đồng.
-- SSCorp = công cụ nhà (is_own): dịch vụ 'direct' (không hoa hồng).

-- ─── Dọn seed cũ (ngược thứ tự FK) ───────────────────────────────────────────

DELETE FROM public.auction_tool_showcases  WHERE id::text LIKE 'a70e0001%';
DELETE FROM public.auction_tool_providers  WHERE id::text LIKE 'a70d0001%';
DELETE FROM public.service_variants        WHERE id::text LIKE 'bbaa0002%';
DELETE FROM public.services                WHERE id::text LIKE '5e4c0002%';
DELETE FROM public.suppliers               WHERE id::text LIKE '50cc0002%';

-- ─── Nhà cung cấp ────────────────────────────────────────────────────────────

INSERT INTO public.suppliers
  (id, name, supplier_type, contact_name, email, tax_code, address,
   default_commission_type, default_commission_rate, status, note)
VALUES
  ('50cc0002-0000-4000-8000-000000000001', 'Silvermedia', 'company',
   NULL, 'contact@silvermedia.example', NULL, 'TP. Hồ Chí Minh',
   'percent', 15.00, 'active', '[tools-seed] Đối tác số hoá 3D'),
  ('50cc0002-0000-4000-8000-000000000002', 'SSCorp', 'company',
   NULL, 'contact@sscorp.example', NULL, 'TP. Hồ Chí Minh',
   NULL, NULL, 'active', '[tools-seed] Công cụ nhà (SSCorp)'),
  ('50cc0002-0000-4000-8000-000000000003', 'DVL Auction', 'company',
   NULL, 'contact@dvl.example', NULL, 'Hà Nội',
   'percent', 12.00, 'active', '[tools-seed] Định giá & pháp lý'),
  ('50cc0002-0000-4000-8000-000000000004', 'Ngân hàng BIDV', 'company',
   NULL, 'sme@bidv.example', NULL, 'Hà Nội',
   'fixed', 3000000, 'active', '[tools-seed] Hỗ trợ vay vốn'),
  ('50cc0002-0000-4000-8000-000000000005', 'Ngân hàng Vietcombank', 'company',
   NULL, 'sme@vcb.example', NULL, 'Hà Nội',
   'fixed', 3000000, 'active', '[tools-seed] Hỗ trợ vay vốn'),
  ('50cc0002-0000-4000-8000-000000000006', 'Ngân hàng Agribank', 'company',
   NULL, 'sme@agribank.example', NULL, 'Hà Nội',
   'fixed', 3000000, 'active', '[tools-seed] Hỗ trợ vay vốn');

-- ─── Dịch vụ (commission cho đối tác ngoài, direct cho SSCorp) ───────────────

INSERT INTO public.services
  (id, name, kind, category, audience, price, supplier_id, description, is_active, sort_order)
VALUES
  ('5e4c0002-0000-4000-8000-000000000001', 'Số hoá tài sản – Silvermedia', 'commission', 'brokerage', 'all', 0,
   '50cc0002-0000-4000-8000-000000000001', '[tools-seed]', true, 50),
  ('5e4c0002-0000-4000-8000-000000000002', 'Số hoá tài sản – SSCorp', 'direct', 'feature', 'all', 0,
   '50cc0002-0000-4000-8000-000000000002', '[tools-seed]', true, 51),
  ('5e4c0002-0000-4000-8000-000000000003', 'Định giá tài sản – DVL Auction', 'commission', 'brokerage', 'all', 0,
   '50cc0002-0000-4000-8000-000000000003', '[tools-seed]', true, 52),
  ('5e4c0002-0000-4000-8000-000000000004', 'Tư vấn pháp lý – DVL Auction', 'commission', 'brokerage', 'all', 0,
   '50cc0002-0000-4000-8000-000000000003', '[tools-seed]', true, 53),
  ('5e4c0002-0000-4000-8000-000000000005', 'Hỗ trợ vay vốn – BIDV', 'commission', 'brokerage', 'all', 0,
   '50cc0002-0000-4000-8000-000000000004', '[tools-seed]', true, 54),
  ('5e4c0002-0000-4000-8000-000000000006', 'Hỗ trợ vay vốn – Vietcombank', 'commission', 'brokerage', 'all', 0,
   '50cc0002-0000-4000-8000-000000000005', '[tools-seed]', true, 55),
  ('5e4c0002-0000-4000-8000-000000000007', 'Hỗ trợ vay vốn – Agribank', 'commission', 'brokerage', 'all', 0,
   '50cc0002-0000-4000-8000-000000000006', '[tools-seed]', true, 56);

-- ─── Biến thể (điều khoản hoa hồng placeholder; SSCorp direct không có hoa hồng) ─

INSERT INTO public.service_variants
  (id, service_id, variant_key, name, price, commission_type, commission_value, sort_order, is_active)
VALUES
  ('bbaa0002-0000-4000-8000-000000000001', '5e4c0002-0000-4000-8000-000000000001',
   'tool_so_hoa_silvermedia', 'Gói số hoá tiêu chuẩn', 0, 'percent', 15.00, 1, true),
  ('bbaa0002-0000-4000-8000-000000000002', '5e4c0002-0000-4000-8000-000000000002',
   'tool_so_hoa_sscorp', 'Gói số hoá SSCorp', 0, NULL, NULL, 1, true),
  ('bbaa0002-0000-4000-8000-000000000003', '5e4c0002-0000-4000-8000-000000000003',
   'tool_dinh_gia_dvl', 'Thẩm định giá tài sản', 0, 'percent', 12.00, 1, true),
  ('bbaa0002-0000-4000-8000-000000000004', '5e4c0002-0000-4000-8000-000000000004',
   'tool_phap_ly_dvl', 'Tư vấn pháp lý hồ sơ', 0, 'fixed', 5000000, 1, true),
  ('bbaa0002-0000-4000-8000-000000000005', '5e4c0002-0000-4000-8000-000000000005',
   'tool_vay_von_bidv', 'Giới thiệu gói vay BIDV', 0, 'fixed', 3000000, 1, true),
  ('bbaa0002-0000-4000-8000-000000000006', '5e4c0002-0000-4000-8000-000000000006',
   'tool_vay_von_vcb', 'Giới thiệu gói vay Vietcombank', 0, 'fixed', 3000000, 1, true),
  ('bbaa0002-0000-4000-8000-000000000007', '5e4c0002-0000-4000-8000-000000000007',
   'tool_vay_von_agribank', 'Giới thiệu gói vay Agribank', 0, 'fixed', 3000000, 1, true);

-- ─── Provider (gắn tool ↔ supplier ↔ service ↔ variant) ──────────────────────

INSERT INTO public.auction_tool_providers
  (id, tool_id, name, slug, is_own, supplier_id, service_id, service_variant_id,
   tagline, description, website, price_label, sort_order, status)
SELECT p.id, t.id, p.name, p.slug, p.is_own, p.supplier_id, p.service_id, p.service_variant_id,
       p.tagline, p.description, p.website, p.price_label, p.sort_order, 'active'
FROM (VALUES
  ('a70d0001-0000-4000-8000-000000000001'::uuid, 'so-hoa',
   'Silvermedia', 'silvermedia', false,
   '50cc0002-0000-4000-8000-000000000001'::uuid,
   '5e4c0002-0000-4000-8000-000000000001'::uuid,
   'bbaa0002-0000-4000-8000-000000000001'::uuid,
   'Chuyên gia số hoá không gian 3D & tour thực tế ảo',
   'Silvermedia cung cấp dịch vụ quét và dựng tour 3D chất lượng cao cho bất động sản, giúp người mua khảo sát tài sản từ xa trước phiên đấu giá.',
   'https://silvermedia.example', 'Liên hệ báo giá', 1),

  ('a70d0001-0000-4000-8000-000000000002'::uuid, 'so-hoa',
   'SSCorp', 'sscorp-so-hoa', true,
   '50cc0002-0000-4000-8000-000000000002'::uuid,
   '5e4c0002-0000-4000-8000-000000000002'::uuid,
   'bbaa0002-0000-4000-8000-000000000002'::uuid,
   'Đội ngũ số hoá nội bộ của Tài Sản Đấu Giá',
   'SSCorp là đơn vị số hoá trực thuộc sàn, cung cấp giải pháp tour 3D và ảnh 360° tối ưu cho quy trình đấu giá.',
   NULL, 'Liên hệ báo giá', 2),

  ('a70d0001-0000-4000-8000-000000000003'::uuid, 'dinh-gia',
   'DVL Auction', 'dvl-dinh-gia', false,
   '50cc0002-0000-4000-8000-000000000003'::uuid,
   '5e4c0002-0000-4000-8000-000000000003'::uuid,
   'bbaa0002-0000-4000-8000-000000000003'::uuid,
   'Thẩm định giá tài sản độc lập, chuẩn hồ sơ đấu giá',
   'DVL Auction cung cấp dịch vụ thẩm định giá chuyên nghiệp, xác định giá khởi điểm và giá trị thị trường cho tài sản chuẩn bị đưa ra đấu giá.',
   'https://dvl.example', 'Liên hệ báo giá', 1),

  ('a70d0001-0000-4000-8000-000000000004'::uuid, 'phap-ly',
   'DVL Auction', 'dvl-phap-ly', false,
   '50cc0002-0000-4000-8000-000000000003'::uuid,
   '5e4c0002-0000-4000-8000-000000000004'::uuid,
   'bbaa0002-0000-4000-8000-000000000004'::uuid,
   'Tư vấn & soát xét pháp lý hồ sơ tài sản',
   'DVL Auction hỗ trợ rà soát tình trạng pháp lý, thủ tục chuyển nhượng và cảnh báo rủi ro pháp lý cho tài sản đấu giá.',
   'https://dvl.example', 'Liên hệ báo giá', 1),

  ('a70d0001-0000-4000-8000-000000000005'::uuid, 'vay-von',
   'BIDV', 'bidv-vay-von', false,
   '50cc0002-0000-4000-8000-000000000004'::uuid,
   '5e4c0002-0000-4000-8000-000000000005'::uuid,
   'bbaa0002-0000-4000-8000-000000000005'::uuid,
   'Gói vay ưu đãi cho khách tham gia đấu giá',
   'BIDV cung cấp gói tín dụng ưu đãi giúp người mua chuẩn bị tài chính tham gia và thanh toán tài sản trúng đấu giá.',
   'https://bidv.com.vn', 'Lãi suất ưu đãi', 1),

  ('a70d0001-0000-4000-8000-000000000006'::uuid, 'vay-von',
   'Vietcombank', 'vcb-vay-von', false,
   '50cc0002-0000-4000-8000-000000000005'::uuid,
   '5e4c0002-0000-4000-8000-000000000006'::uuid,
   'bbaa0002-0000-4000-8000-000000000006'::uuid,
   'Gói vay linh hoạt cho tài sản đấu giá',
   'Vietcombank hỗ trợ khách hàng vay vốn với thủ tục nhanh gọn để tham gia các phiên đấu giá tài sản.',
   'https://vietcombank.com.vn', 'Lãi suất ưu đãi', 2),

  ('a70d0001-0000-4000-8000-000000000007'::uuid, 'vay-von',
   'Agribank', 'agribank-vay-von', false,
   '50cc0002-0000-4000-8000-000000000006'::uuid,
   '5e4c0002-0000-4000-8000-000000000007'::uuid,
   'bbaa0002-0000-4000-8000-000000000007'::uuid,
   'Gói vay cho tài sản đấu giá, mạng lưới toàn quốc',
   'Agribank cung cấp gói vay với mạng lưới rộng khắp, phù hợp tài sản đấu giá tại mọi tỉnh thành.',
   'https://agribank.com.vn', 'Lãi suất ưu đãi', 3)
) AS p(id, tool_key, name, slug, is_own, supplier_id, service_id, service_variant_id,
       tagline, description, website, price_label, sort_order)
JOIN public.auction_tools t ON t.key = p.tool_key;

-- ─── Showcase (chỉ công cụ Số hoá — link 3DNest người dùng cung cấp) ─────────
-- Mật khẩu placeholder cho showcase 'password' — admin đổi lại.

INSERT INTO public.auction_tool_showcases
  (id, provider_id, title, kind, url, visibility, access_password, sort_order, is_active)
VALUES
  ('a70e0001-0000-4000-8000-000000000001', 'a70d0001-0000-4000-8000-000000000001',
   'Tour 3D mẫu — Căn hộ', 'tour_3d',
   'https://beyond.3dnest.biz/play/?m=f4be88c2_Hnu8_b6f9_2', 'public', NULL, 1, true),
  ('a70e0001-0000-4000-8000-000000000002', 'a70d0001-0000-4000-8000-000000000001',
   'Tour 3D (bảo mật) — Dự án nội bộ', 'tour_3d',
   'https://beyond.3dnest.cn/lookhouse/?m=d583bbfe_mcqj_b6f9', 'password', 'taisandaugia', 2, true),
  ('a70e0001-0000-4000-8000-000000000003', 'a70d0001-0000-4000-8000-000000000002',
   'Tour 3D mẫu — Nhà phố', 'tour_3d',
   'https://beyond.3dnest.biz/play/?m=a55150cc_XB7v_b6f9', 'public', NULL, 1, true),
  ('a70e0001-0000-4000-8000-000000000004', 'a70d0001-0000-4000-8000-000000000002',
   'Tour 3D (bảo mật) — Biệt thự', 'tour_3d',
   'https://beyond.3dnest.biz/play/?m=ad8b2884_6Yz8_b6f9', 'password', 'taisandaugia', 2, true);

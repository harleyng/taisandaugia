-- Dữ liệu mẫu RIÊNG TƯ cho danh bạ khách hàng của Bảo Tín
-- (org c9d00002-0000-4000-8000-000000000001, owner harleyngx). Chỉ thành viên
-- Bảo Tín đọc được (RLS theo module khach-hang) — không lộ ra sàn.
--
-- SĐT 09000001xx và email @example.com là GIẢ. Xoá được an toàn:
--   DELETE FROM org_contacts WHERE id::text LIKE 'c0a70000-%';
--   DELETE FROM org_contact_groups WHERE id::text LIKE 'c0a7a000-%';
--
-- Bộ mẫu phủ các nhánh của truy vấn chọn người nhận: danh mục cha/con, tỉnh viết
-- không tiền tố ("Hồ Chí Minh", "TP.HCM"), khoảng giá, khách 2 dòng nhu cầu, khách
-- chưa đồng ý / đã ngừng nhận tin, khách ngừng theo dõi (inactive).

DO $$
DECLARE _org CONSTANT UUID := 'c9d00002-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org) THEN
    RAISE NOTICE 'Bỏ qua seed danh bạ: không có tổ chức Bảo Tín';
    RETURN;
  END IF;

  INSERT INTO public.org_contacts
    (id, organization_id, full_name, contact_type, company_name, phone, email, zalo, province, note, source, notifications_enabled, status)
  VALUES
    ('c0a70000-0000-4000-8000-000000000001', _org, 'Nguyễn Văn An',     'individual', NULL, '0900000101', 'an.nguyen@example.com',   NULL,         'TP. Hồ Chí Minh', 'Dữ liệu mẫu', 'manual', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000002', _org, 'Trần Thị Bình',     'individual', NULL, '0900000102', 'binh.tran@example.com',   NULL,         'Hồ Chí Minh',     'Dữ liệu mẫu', 'manual', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000003', _org, 'Lê Hoàng Cường',    'individual', NULL, '0900000103', NULL,                      '0900000103', 'Bình Dương',      'Dữ liệu mẫu', 'manual', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000004', _org, 'Phạm Minh Đức',     'individual', NULL, '0900000104', 'duc.pham@example.com',    NULL,         'Hà Nội',          'Dữ liệu mẫu', 'import', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000005', _org, 'Hoàng Thu Hà',      'individual', NULL, '0900000105', 'ha.hoang@example.com',    NULL,         'Hà Nội',          'Dữ liệu mẫu', 'import', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000006', _org, 'Võ Quốc Khánh',     'individual', NULL, '0900000106', 'khanh.vo@example.com',    NULL,         'TP. Hồ Chí Minh', 'Dữ liệu mẫu — đã ngừng nhận tin', 'manual', false, 'active'),
    ('c0a70000-0000-4000-8000-000000000007', _org, 'Đặng Mỹ Linh',      'individual', NULL, '0900000107', 'linh.dang@example.com',   NULL,         'TP. Hồ Chí Minh', 'Dữ liệu mẫu — ngừng theo dõi', 'manual', true,  'inactive'),
    ('c0a70000-0000-4000-8000-000000000008', _org, 'Bùi Văn Minh',      'company',    'Công ty TNHH Đầu tư Phúc Thịnh', '0900000108', 'minh.bui@example.com', NULL, 'Bình Dương', 'Dữ liệu mẫu', 'manual', true, 'active'),
    ('c0a70000-0000-4000-8000-000000000009', _org, 'Ngô Thanh Nam',     'individual', NULL, '0900000109', NULL,                      NULL,         'Bình Dương',      'Dữ liệu mẫu', 'import', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000010', _org, 'Dương Kim Oanh',    'individual', NULL, NULL,         'oanh.duong@example.com',  NULL,         'Hà Nội',          'Dữ liệu mẫu', 'import', true,  'active'),
    ('c0a70000-0000-4000-8000-000000000011', _org, 'Lý Gia Phát',       'individual', NULL, NULL,         NULL,                      '0900000111', 'Đồng Nai',        'Dữ liệu mẫu — chỉ có Zalo', 'manual', true, 'active'),
    ('c0a70000-0000-4000-8000-000000000012', _org, 'Mai Anh Quân',      'individual', NULL, '0900000112', 'quan.mai@example.com',    NULL,         'TP.HCM',          'Dữ liệu mẫu — chưa đồng ý nhận tin', 'import', false, 'active')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.org_contact_interests
    (id, contact_id, organization_id, categories, provinces, price_min, price_max, note)
  VALUES
    ('c0a71000-0000-4000-8000-000000000001', 'c0a70000-0000-4000-8000-000000000001', _org, '{bat-dong-san}',          '{"TP. Hồ Chí Minh"}', NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000002', 'c0a70000-0000-4000-8000-000000000002', _org, '{nha-pho}',               '{"Hồ Chí Minh"}',     10000000000,  15000000000,   'Nhà phố nội thành'),
    ('c0a71000-0000-4000-8000-000000000003', 'c0a70000-0000-4000-8000-000000000003', _org, '{xe-co}',                 '{}',                  NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000004', 'c0a70000-0000-4000-8000-000000000004', _org, '{}',                      '{}',                  NULL,         2000000000,    'Chỉ quan tâm giá dưới 2 tỷ'),
    ('c0a71000-0000-4000-8000-000000000005', 'c0a70000-0000-4000-8000-000000000005', _org, '{can-ho}',                '{"Hà Nội"}',          NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000006', 'c0a70000-0000-4000-8000-000000000005', _org, '{dat-o}',                 '{"Đồng Nai"}',        500000000,    NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000007', 'c0a70000-0000-4000-8000-000000000006', _org, '{bat-dong-san}',          '{}',                  NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000008', 'c0a70000-0000-4000-8000-000000000007', _org, '{bat-dong-san}',          '{}',                  NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000009', 'c0a70000-0000-4000-8000-000000000008', _org, '{bat-dong-san,may-moc}',  '{"Bình Dương","TP. Hồ Chí Minh"}', NULL, NULL,        NULL),
    ('c0a71000-0000-4000-8000-000000000010', 'c0a70000-0000-4000-8000-000000000009', _org, '{may-moc}',               '{"Bình Dương"}',      NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000011', 'c0a70000-0000-4000-8000-000000000010', _org, '{thu-cong-my-nghe,co-vat-suu-tam}', '{}',        NULL,         NULL,          NULL),
    ('c0a71000-0000-4000-8000-000000000012', 'c0a70000-0000-4000-8000-000000000011', _org, '{o-to}',                  '{}',                  NULL,         800000000,     NULL),
    ('c0a71000-0000-4000-8000-000000000013', 'c0a70000-0000-4000-8000-000000000012', _org, '{nha-pho}',               '{"TP.HCM"}',          NULL,         NULL,          NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.org_contact_groups (id, organization_id, name, description)
  VALUES
    ('c0a7a000-0000-4000-8000-000000000001', _org, 'Nhà đầu tư BĐS HCM', 'Dữ liệu mẫu'),
    ('c0a7a000-0000-4000-8000-000000000002', _org, 'Khách mua xe',       'Dữ liệu mẫu')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.org_contact_group_members (group_id, contact_id, organization_id)
  VALUES
    ('c0a7a000-0000-4000-8000-000000000001', 'c0a70000-0000-4000-8000-000000000001', _org),
    ('c0a7a000-0000-4000-8000-000000000001', 'c0a70000-0000-4000-8000-000000000002', _org),
    ('c0a7a000-0000-4000-8000-000000000001', 'c0a70000-0000-4000-8000-000000000008', _org),
    ('c0a7a000-0000-4000-8000-000000000001', 'c0a70000-0000-4000-8000-000000000012', _org),
    ('c0a7a000-0000-4000-8000-000000000002', 'c0a70000-0000-4000-8000-000000000003', _org),
    ('c0a7a000-0000-4000-8000-000000000002', 'c0a70000-0000-4000-8000-000000000011', _org)
  ON CONFLICT DO NOTHING;
END $$;

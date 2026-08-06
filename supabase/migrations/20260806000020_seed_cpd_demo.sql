-- ─────────────────────────────────────────────────────────────────────────────
-- Dữ liệu mẫu để kiểm thử module Bồi dưỡng chuyên môn đấu giá viên.
--
-- Vì sao cần: trước migration này chỉ MỘT tổ chức có đấu giá viên, và KHÔNG
-- khách hàng nào có con trỏ `prospect_id`, nên tab "Đấu giá viên" bên
-- /admin/khach-hang và /admin/khach-hang-tiem-nang luôn ra empty state — không
-- kiểm chứng được gì.
--
-- Làm ba việc:
--   1. Nối 5 khách hàng phân khúc `auction_company` với tổ chức trong danh bạ
--      (`customers.prospect_id`) — đây là SỬA DỮ LIỆU THẬT, không phải seed.
--   2. Dựng roster đấu giá viên cho các tổ chức đó.
--   3. Seed bản ghi bồi dưỡng phủ ĐỦ mọi trạng thái của engine, cho cả năm
--      2025 (đã đóng) lẫn 2026 (đang chạy).
--
-- Idempotent: mọi INSERT đều ON CONFLICT DO NOTHING/UPDATE trên khoá xác định.
-- UUID sentinel viết bằng hex hợp lệ (chỉ 0-9a-f).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Tổ chức trong danh bạ cho các khách hàng chưa có ────────────────────
INSERT INTO public.auction_organizations (id, name, province, org_type, tax_code, phone)
VALUES
  ('a0d90002-0000-4000-8000-000000000002', 'Công ty Đấu giá Hợp danh Minh Khang', 'Hà Nội',        2, '0109223344', '02438887766'),
  ('a0d90002-0000-4000-8000-000000000010', 'Công ty Đấu giá Hợp danh Thành Đạt',  'TP. Hồ Chí Minh', 2, '0316554433', '02839995544'),
  ('a0d90002-0000-4000-8000-000000000016', 'Công ty Đấu giá Tài sản Phú Quý',     'Đà Nẵng',       2, '0401778899', '02363884455'),
  ('a0d90002-0000-4000-8000-000000000005', 'Công ty Đấu giá Tài sản Trường An',   'Hải Phòng',     2, '0201667788', '02253776655')
ON CONFLICT (id) DO NOTHING;

-- Tổ chức đã có sẵn trong danh bạ nhưng thiếu tỉnh ⇒ rơi vào nhóm "Không rõ"
-- trên biểu đồ. Điền để biểu đồ theo tỉnh có ý nghĩa.
UPDATE public.auction_organizations
   SET province = 'Hà Nội'
 WHERE id = 'a2222222-2222-2222-2222-222222222222' AND COALESCE(province, '') = '';

-- ─── 2. Nối khách hàng ↔ tổ chức ────────────────────────────────────────────
-- Không có bước này thì useAdminOrgAuctioneers không resolve ra tổ chức nào.
UPDATE public.customers c
   SET prospect_kind = 'auction_org',
       prospect_id   = v.aoid
FROM (VALUES
  ('ccc00002-0000-4000-8000-000000000001'::uuid, 'a2222222-2222-2222-2222-222222222222'::uuid),
  ('ccc00002-0000-4000-8000-000000000002'::uuid, 'a0d90002-0000-4000-8000-000000000002'::uuid),
  ('ccc00002-0000-4000-8000-000000000010'::uuid, 'a0d90002-0000-4000-8000-000000000010'::uuid),
  ('ccc00002-0000-4000-8000-000000000016'::uuid, 'a0d90002-0000-4000-8000-000000000016'::uuid),
  ('ccc00002-0000-4000-8000-000000000005'::uuid, 'a0d90002-0000-4000-8000-000000000005'::uuid)
) AS v(cid, aoid)
WHERE c.id = v.cid AND c.prospect_id IS NULL;

-- ─── 3. Tenant KYC cho từng tổ chức ─────────────────────────────────────────
-- org_auctioneers.organization_id NOT NULL nên phải có bản ghi tenant. owner_id
-- mượn một chủ sở hữu có thật để không tạo user rác.
INSERT INTO public.organizations (id, name, owner_id, kyc_status, license_info)
SELECT v.oid, v.nm, (SELECT owner_id FROM public.organizations ORDER BY created_at LIMIT 1),
       'APPROVED'::kyc_status, jsonb_build_object('auction_org_id', v.aoid)
FROM (VALUES
  ('c9d00002-0000-4000-8000-000000000001'::uuid, 'Công ty Đấu giá Hợp danh Bảo Tín',    'a2222222-2222-2222-2222-222222222222'::uuid),
  ('c9d00002-0000-4000-8000-000000000002'::uuid, 'Công ty Đấu giá Hợp danh Minh Khang', 'a0d90002-0000-4000-8000-000000000002'::uuid),
  ('c9d00002-0000-4000-8000-000000000010'::uuid, 'Công ty Đấu giá Hợp danh Thành Đạt',  'a0d90002-0000-4000-8000-000000000010'::uuid),
  ('c9d00002-0000-4000-8000-000000000016'::uuid, 'Công ty Đấu giá Tài sản Phú Quý',     'a0d90002-0000-4000-8000-000000000016'::uuid),
  ('c9d00002-0000-4000-8000-000000000005'::uuid, 'Công ty Đấu giá Tài sản Trường An',   'a0d90002-0000-4000-8000-000000000005'::uuid)
) AS v(oid, nm, aoid)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Roster đấu giá viên ─────────────────────────────────────────────────
-- license_expiry_date rải có chủ ý: một vài thẻ sắp hết hạn (<60 ngày) để kiểm
-- luôn cảnh báo hết hạn thẻ chạy SONG SONG cảnh báo bồi dưỡng.
INSERT INTO public.org_auctioneers (
  id, organization_id, auction_org_id, source, full_name, date_of_birth, gender,
  position, contract_type, license_number, license_issued_date, license_expiry_date,
  professional_cert_number, professional_cert_issued_date, practice_start_date,
  joined_date, is_active, email, phone
)
VALUES
  -- Bảo Tín (Hà Nội) — 4 người
  ('d9a00001-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000001','a2222222-2222-2222-2222-222222222222','MANUAL','Nguyễn Thị Bảo Ngân','1981-04-12','FEMALE','DIRECTOR','OFFICIAL','BT-2018-0101','2018-03-05',NULL,'CCHN-BT-101','2017-11-20','2012-06-01','2018-03-10',true,'ngan.nguyen@baotin.vn','0912000101'),
  ('d9a00001-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000001','a2222222-2222-2222-2222-222222222222','MANUAL','Trần Quốc Bảo','1986-09-30','MALE','DEPUTY_DIRECTOR','OFFICIAL','BT-2019-0102','2019-07-15',CURRENT_DATE + 40,'CCHN-BT-102','2019-02-11','2015-01-15','2019-08-01',true,'bao.tran@baotin.vn','0912000102'),
  ('d9a00001-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000001','a2222222-2222-2222-2222-222222222222','MANUAL','Lê Thị Mai Hương','1992-02-18','FEMALE','AUCTIONEER','OFFICIAL','BT-2021-0103','2021-05-20',NULL,'CCHN-BT-103','2021-01-08','2021-05-20','2021-06-01',true,'huong.le@baotin.vn','0912000103'),
  ('d9a00001-0000-4000-8000-000000000004','c9d00002-0000-4000-8000-000000000001','a2222222-2222-2222-2222-222222222222','MANUAL','Phạm Văn Cường','1989-12-02','MALE','AUCTIONEER','COLLABORATOR','BT-2022-0104','2022-09-01',NULL,'CCHN-BT-104','2022-04-19','2022-09-01','2022-10-01',true,'cuong.pham@baotin.vn','0912000104'),

  -- Minh Khang (Hà Nội) — 3 người
  ('d9a00002-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000002','a0d90002-0000-4000-8000-000000000002','MANUAL','Đỗ Minh Khang','1978-07-07','MALE','DIRECTOR','OFFICIAL','MK-2017-0201','2017-08-10',NULL,'CCHN-MK-201','2017-03-15','2009-04-01','2017-08-15',true,'khang.do@minhkhang.vn','0913000201'),
  ('d9a00002-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000002','a0d90002-0000-4000-8000-000000000002','MANUAL','Vũ Thị Thu Hà','1990-11-25','FEMALE','AUCTIONEER','OFFICIAL','MK-2020-0202','2020-06-18',CURRENT_DATE + 25,'CCHN-MK-202','2020-01-30','2020-06-18','2020-07-01',true,'ha.vu@minhkhang.vn','0913000202'),
  ('d9a00002-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000002','a0d90002-0000-4000-8000-000000000002','MANUAL','Hoàng Anh Tuấn','1985-03-14','MALE','AUCTIONEER','OFFICIAL','MK-2019-0203','2019-10-02',NULL,'CCHN-MK-203','2019-05-22','2016-02-01','2019-10-10',true,'tuan.hoang@minhkhang.vn','0913000203'),

  -- Thành Đạt (TP.HCM) — 4 người, có 1 người đã nghỉ
  ('d9a00010-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000010','a0d90002-0000-4000-8000-000000000010','MANUAL','Trương Thành Đạt','1975-01-20','MALE','DIRECTOR','OFFICIAL','TD-2017-1001','2017-07-01',NULL,'CCHN-TD-1001','2017-02-08','2006-09-01','2017-07-05',true,'dat.truong@thanhdat.vn','0914001001'),
  ('d9a00010-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000010','a0d90002-0000-4000-8000-000000000010','MANUAL','Nguyễn Thị Kim Chi','1988-06-11','FEMALE','AUCTIONEER','OFFICIAL','TD-2020-1002','2020-04-14',NULL,'CCHN-TD-1002','2019-12-01','2018-03-01','2020-05-01',true,'chi.nguyen@thanhdat.vn','0914001002'),
  ('d9a00010-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000010','a0d90002-0000-4000-8000-000000000010','MANUAL','Lý Gia Huy','1993-08-08','MALE','AUCTIONEER','OFFICIAL','TD-2022-1003','2022-11-30',NULL,'CCHN-TD-1003','2022-07-12','2022-11-30','2022-12-15',true,'huy.ly@thanhdat.vn','0914001003'),
  ('d9a00010-0000-4000-8000-000000000004','c9d00002-0000-4000-8000-000000000010','a0d90002-0000-4000-8000-000000000010','MANUAL','Bùi Thanh Sơn','1983-05-05','MALE','AUCTIONEER','COLLABORATOR','TD-2018-1004','2018-02-20',NULL,'CCHN-TD-1004','2017-09-09','2014-01-01','2018-03-01',false,'son.bui@thanhdat.vn','0914001004'),

  -- Phú Quý (Đà Nẵng) — 3 người
  ('d9a00016-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000016','a0d90002-0000-4000-8000-000000000016','MANUAL','Ngô Phú Quý','1980-10-10','MALE','DIRECTOR','OFFICIAL','PQ-2018-1601','2018-05-25',NULL,'CCHN-PQ-1601','2018-01-16','2011-03-01','2018-06-01',true,'quy.ngo@phuquy.vn','0915001601'),
  ('d9a00016-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000016','a0d90002-0000-4000-8000-000000000016','MANUAL','Đặng Thị Lan Anh','1991-01-29','FEMALE','AUCTIONEER','OFFICIAL','PQ-2021-1602','2021-09-08',NULL,'CCHN-PQ-1602','2021-04-05','2021-09-08','2021-10-01',true,'lananh.dang@phuquy.vn','0915001602'),
  ('d9a00016-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000016','a0d90002-0000-4000-8000-000000000016','MANUAL','Cao Hữu Nghĩa','1987-04-04','MALE','AUCTIONEER','OFFICIAL','PQ-2019-1603','2019-12-12',CURRENT_DATE + 15,'CCHN-PQ-1603','2019-08-27','2017-05-01','2020-01-05',true,'nghia.cao@phuquy.vn','0915001603'),

  -- Trường An (Hải Phòng) — 2 người
  ('d9a00005-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000005','a0d90002-0000-4000-8000-000000000005','MANUAL','Phan Trường An','1979-03-03','MALE','DIRECTOR','OFFICIAL','TA-2017-0501','2017-06-14',NULL,'CCHN-TA-501','2017-01-25','2008-07-01','2017-06-20',true,'an.phan@truongan.vn','0916000501'),
  ('d9a00005-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000005','a0d90002-0000-4000-8000-000000000005','MANUAL','Tạ Thị Ngọc Diệp','1994-07-19','FEMALE','AUCTIONEER','OFFICIAL','TA-2023-0502','2023-03-21',NULL,'CCHN-TA-502','2022-10-30','2023-03-21','2023-04-01',true,'diep.ta@truongan.vn','0916000502')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Bản ghi bồi dưỡng — phủ đủ mọi nhánh của engine ─────────────────────
-- Năm tính nghĩa vụ dùng biến để seed không "hết hạn" khi sang năm sau.
DO $$
DECLARE
  y  INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;   -- năm đang chạy
  py INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT-1; -- năm đã đóng
BEGIN

INSERT INTO public.org_auctioneer_events (
  id, auctioneer_id, organization_id, event_type, title, organization_name,
  started_on, hours, outcome, reference_no, cpd_year, cpd_kind,
  is_accredited_provider, attachments
)
VALUES
  -- ── ĐẠT vì đủ 8 giờ, có minh chứng ────────────────────────────────────────
  ('e0d00001-0000-4000-8000-000000000001','d9a00001-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000001','TRAINING',
   'Bồi dưỡng chuyên môn, nghiệp vụ đấu giá viên năm ' || y, 'Học viện Tư pháp',
   make_date(y,3,18), 8, 'Đạt', 'HVTP-' || y || '/0182', y, 'COURSE', true, ARRAY['seed/chung-nhan-hvtp.pdf']),

  ('e0d00002-0000-4000-8000-000000000001','d9a00002-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000002','TRAINING',
   'Bồi dưỡng chuyên môn, nghiệp vụ đấu giá viên năm ' || y, 'Cục Bổ trợ tư pháp',
   make_date(y,4,9), 8, 'Đạt', 'BTTP-' || y || '/0447', y, 'COURSE', true, ARRAY['seed/chung-nhan-bttp.pdf']),

  ('e0d00010-0000-4000-8000-000000000001','d9a00010-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000010','TRAINING',
   'Bồi dưỡng chuyên môn, nghiệp vụ đấu giá viên năm ' || y, 'Hiệp hội Đấu giá viên Việt Nam',
   make_date(y,2,25), 8, 'Đạt', 'HHDGV-' || y || '/0091', y, 'COURSE', true, ARRAY['seed/chung-nhan-hhdgv.pdf']),

  -- ĐẠT nhưng cộng dồn từ HAI buổi 4 giờ — kiểm tổng giờ, không phải một dòng
  ('e0d00016-0000-4000-8000-000000000001','d9a00016-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000016','TRAINING',
   'Toạ đàm cập nhật pháp luật đấu giá (buổi 1)', 'Sở Tư pháp Đà Nẵng',
   make_date(y,5,6), 4, 'Đạt', 'STP-DN-' || y || '/12', y, 'COURSE', true, ARRAY['seed/xac-nhan-buoi1.pdf']),
  ('e0d00016-0000-4000-8000-000000000002','d9a00016-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000016','TRAINING',
   'Toạ đàm cập nhật pháp luật đấu giá (buổi 2)', 'Sở Tư pháp Đà Nẵng',
   make_date(y,5,7), 4, 'Đạt', 'STP-DN-' || y || '/13', y, 'COURSE', true, ARRAY['seed/xac-nhan-buoi2.pdf']),

  -- ── ĐẠT qua HÌNH THỨC THAY THẾ (Điều 26.2) — 0 giờ vẫn đạt ────────────────
  ('e0d00001-0000-4000-8000-000000000002','d9a00001-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000001','TRAINING',
   'Chuyên đề: Xử lý vướng mắc khi đấu giá quyền sử dụng đất', 'Học viện Tư pháp',
   make_date(y,6,20), NULL, NULL, 'HVTP-BCV-' || y || '/07', y, 'SPEAKER', true, ARRAY['seed/giay-moi-bao-cao-vien.pdf']),

  ('e0d00002-0000-4000-8000-000000000002','d9a00002-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000002','TRAINING',
   'Bài viết: Định giá khởi điểm tài sản thi hành án', 'Tạp chí Dân chủ và Pháp luật',
   make_date(y,4,1), NULL, NULL, 'Số 4/' || y, y, 'PUBLICATION', false, ARRAY['seed/ban-chup-tap-chi.pdf']),

  -- ĐẠT qua thay thế NHƯNG THIẾU MINH CHỨNG — cờ phụ, không đổi trạng thái
  ('e0d00010-0000-4000-8000-000000000002','d9a00010-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000010','TRAINING',
   'Giảng dạy lớp đào tạo nghề đấu giá khoá 12', 'Học viện Tư pháp',
   make_date(y,3,2), NULL, NULL, NULL, y, 'TEACHING', true, '{}'),

  ('e0d00005-0000-4000-8000-000000000001','d9a00005-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000005','TRAINING',
   'Khoá bồi dưỡng đấu giá tài sản công tại Singapore', 'Singapore Academy of Law',
   make_date(y,7,15), NULL, NULL, NULL, y, 'OVERSEAS_COURSE', false, ARRAY['seed/certificate-sal.pdf']),

  -- ── CHƯA ĐỦ — mới 4/8 giờ ─────────────────────────────────────────────────
  ('e0d00001-0000-4000-8000-000000000003','d9a00001-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000001','TRAINING',
   'Tập huấn quy tắc đạo đức nghề nghiệp đấu giá viên', 'Hiệp hội Đấu giá viên Việt Nam',
   make_date(y,8,12), 4, 'Đạt', 'HHDGV-' || y || '/0233', y, 'COURSE', true, ARRAY['seed/xac-nhan-tap-huan.pdf']),

  -- CHƯA ĐỦ + đơn vị tổ chức CHƯA ĐƯỢC CÔNG NHẬN (ngoài Điều 25) + thiếu minh chứng
  ('e0d00010-0000-4000-8000-000000000003','d9a00010-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000010','TRAINING',
   'Hội thảo nghiệp vụ đấu giá do doanh nghiệp tự tổ chức', 'Công ty CP Đào tạo ABC',
   make_date(y,6,3), 6, NULL, NULL, y, 'COURSE', false, '{}'),

  -- ── NĂM TRƯỚC đã đóng: một người đạt, một người quá hạn ───────────────────
  ('e0d00001-0000-4000-8000-000000000011','d9a00001-0000-4000-8000-000000000001','c9d00002-0000-4000-8000-000000000001','TRAINING',
   'Bồi dưỡng chuyên môn, nghiệp vụ đấu giá viên năm ' || py, 'Học viện Tư pháp',
   make_date(py,4,22), 8, 'Đạt', 'HVTP-' || py || '/0155', py, 'COURSE', true, ARRAY['seed/chung-nhan-hvtp-' || py || '.pdf']),

  ('e0d00002-0000-4000-8000-000000000011','d9a00002-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000002','TRAINING',
   'Bồi dưỡng chuyên môn, nghiệp vụ đấu giá viên năm ' || py, 'Cục Bổ trợ tư pháp',
   make_date(py,10,5), 4, NULL, NULL, py, 'COURSE', true, '{}'),

  -- ── Bản ghi đào tạo KHÔNG thuộc diện bồi dưỡng bắt buộc (cpd_kind = NULL) ──
  -- Phải KHÔNG được đếm vào nghĩa vụ hằng năm.
  ('e0d00005-0000-4000-8000-000000000011','d9a00005-0000-4000-8000-000000000002','c9d00002-0000-4000-8000-000000000005','TRAINING',
   'Tốt nghiệp lớp đào tạo nghề đấu giá', 'Học viện Tư pháp',
   make_date(2022,11,30), 480, 'Giỏi', 'CC-2022/3391', NULL, NULL, false, ARRAY['seed/chung-chi-dao-tao-nghe.pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── 6. Diện miễn (Điều 26.3) ────────────────────────────────────────────────
INSERT INTO public.org_auctioneer_cpd_exemptions
  (id, auctioneer_id, organization_id, year, reason, note, filed_at, attachments)
VALUES
  ('c00e0001-0000-4000-8000-000000000001','d9a00001-0000-4000-8000-000000000004','c9d00002-0000-4000-8000-000000000001',
   y, 'MATERNITY', 'Nghỉ thai sản từ tháng 2, con sinh tháng 4.', make_date(y,11,28),
   ARRAY['seed/giay-khai-sinh.pdf']),
  ('c00e0016-0000-4000-8000-000000000001','d9a00016-0000-4000-8000-000000000003','c9d00002-0000-4000-8000-000000000016',
   y, 'LONG_ILLNESS', 'Điều trị nội trú 4 tháng, có xác nhận của Bệnh viện Đà Nẵng.', NULL,
   ARRAY['seed/xac-nhan-benh-vien.pdf'])
ON CONFLICT (auctioneer_id, year) DO NOTHING;

END $$;

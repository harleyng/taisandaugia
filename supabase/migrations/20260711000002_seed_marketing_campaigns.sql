-- DEMO / TEST DATA — 8 sample Email Marketing campaigns + recipients.
-- Depends on 20260711000001_marketing_campaigns.sql. Safe to delete (fixed ids
-- prefixed aa000000-…). created_by / user_id left NULL so no auth.users dependency.

INSERT INTO public.marketing_campaigns
  (id, name, notes, status, subject, preview_text, content_html, cta_label, cta_url,
   audience_spec, schedule_type, scheduled_at, eligible_count, recipient_count,
   sent_count, opened_count, clicked_count, sent_at, created_at)
VALUES
  ('aa000000-0000-4000-8000-000000000001',
   'Thông báo lịch đấu giá quyền sử dụng đất Quý III/2026', NULL, 'draft',
   'Lịch đấu giá đất Quý III/2026 sắp mở',
   'Xem ngay danh sách 12 phiên đấu giá đất nền sắp diễn ra.',
   '<p>Kính gửi Quý khách hàng,</p><p>Nền tảng Tài Sản Đấu Giá trân trọng thông báo lịch các phiên đấu giá quyền sử dụng đất trong Quý III/2026.</p><ul><li>12 phiên đấu giá đất nền tại Hà Nội và các tỉnh lân cận</li><li>Hồ sơ pháp lý và giá khởi điểm đầy đủ</li></ul><p>Trân trọng.</p>',
   'Xem lịch đấu giá', 'https://taisandaugia.vn/lich-dau-gia',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":["buyer"],"kycStatuses":[],"credit":null,"provinces":[],"includeNullProvince":true},"userIds":[],"emails":[]}'::jsonb,
   'immediate', NULL, NULL, 0, 0, 0, 0, NULL, now() - interval '2 hours'),

  ('aa000000-0000-4000-8000-000000000002',
   'Chăm sóc khách hàng thân thiết tháng 7', 'Danh sách VIP nhập từ file', 'draft',
   'Ưu đãi riêng cho khách hàng thân thiết',
   'Cảm ơn Quý khách đã đồng hành. Nhận ngay ưu đãi tháng 7.',
   '<p>Kính gửi Quý khách hàng thân thiết,</p><p>Chúng tôi gửi tới Quý khách nhiều ưu đãi riêng trong tháng 7.</p>',
   'Nhận ưu đãi', 'https://taisandaugia.vn/uu-dai',
   '{"modes":{"criteria":false,"import":true,"specific":false},"criteria":{"registration":null,"accountTypes":[],"kycStatuses":[],"credit":null,"provinces":[],"includeNullProvince":true},"userIds":[],"emails":["vip1@example.com","vip2@example.com","vip3@example.com","vip4@example.com","vip5@example.com"]}'::jsonb,
   'immediate', NULL, NULL, 0, 0, 0, 0, NULL, now() - interval '1 day'),

  ('aa000000-0000-4000-8000-000000000003',
   'Nhắc lịch phiên đấu giá xe thanh lý 20/07', NULL, 'scheduled',
   'Nhắc lịch: Phiên đấu giá xe thanh lý 20/07',
   'Đăng ký tham gia trước 18/07 để không bỏ lỡ.',
   '<p>Kính gửi Quý khách,</p><p>Phiên đấu giá xe ô tô thanh lý sẽ diễn ra vào ngày 20/07/2026. Vui lòng đăng ký tham gia trước ngày 18/07.</p>',
   'Đăng ký tham gia', 'https://taisandaugia.vn/dau-gia-xe',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":["buyer","company_rep"],"kycStatuses":["APPROVED"],"credit":null,"provinces":[],"includeNullProvince":true},"userIds":[],"emails":[]}'::jsonb,
   'scheduled', now() + interval '3 days', 6, 6, 0, 0, 0, NULL, now() - interval '6 hours'),

  ('aa000000-0000-4000-8000-000000000004',
   'Bản tin thị trường bất động sản đấu giá tuần 28', NULL, 'sending',
   'Bản tin BĐS đấu giá — Tuần 28/2026',
   'Điểm tin thị trường và các tài sản đáng chú ý tuần này.',
   '<p>Bản tin thị trường bất động sản đấu giá tuần này:</p><ul><li>Giá trúng đấu giá đất nền tăng nhẹ tại khu vực phía Tây</li><li>Nhiều tài sản ngân hàng được đưa ra đấu giá</li></ul>',
   'Đọc bản tin', 'https://taisandaugia.vn/ban-tin',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":[],"kycStatuses":[],"credit":null,"provinces":["Hà Nội"],"includeNullProvince":true},"userIds":[],"emails":[]}'::jsonb,
   'immediate', NULL, 8, 8, 5, 0, 0, NULL, now() - interval '40 minutes'),

  ('aa000000-0000-4000-8000-000000000005',
   'Kết quả phiên đấu giá quyền sử dụng đất ngày 05/07', NULL, 'sent',
   'Kết quả đấu giá đất ngày 05/07/2026',
   'Danh sách tài sản trúng đấu giá và mức giá trúng.',
   '<p>Kết quả phiên đấu giá quyền sử dụng đất ngày 05/07/2026 đã được công bố.</p><p>Xem chi tiết danh sách tài sản trúng đấu giá và mức giá trúng trên nền tảng.</p>',
   'Xem kết quả', 'https://taisandaugia.vn/ket-qua',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":["buyer"],"kycStatuses":[],"credit":null,"provinces":["Hà Nội"],"includeNullProvince":true},"userIds":[],"emails":[]}'::jsonb,
   'immediate', NULL, 10, 10, 10, 6, 3, now() - interval '5 days', now() - interval '5 days'),

  ('aa000000-0000-4000-8000-000000000006',
   'Mời tham gia phiên đấu giá tài sản ngân hàng', NULL, 'sent',
   'Mời tham gia đấu giá tài sản NH — nhiều BĐS giá tốt',
   'Nhiều bất động sản giá trị được đưa ra đấu giá.',
   '<p>Kính mời Quý tổ chức tham gia phiên đấu giá tài sản bảo đảm của ngân hàng với nhiều bất động sản giá trị.</p>',
   'Xem tài sản', 'https://taisandaugia.vn/tai-san-ngan-hang',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":["company_rep","owner_org"],"kycStatuses":["APPROVED","PENDING_KYC"],"credit":null,"provinces":[],"includeNullProvince":true},"userIds":[],"emails":[]}'::jsonb,
   'immediate', NULL, 7, 7, 7, 4, 1, now() - interval '10 days', now() - interval '10 days'),

  ('aa000000-0000-4000-8000-000000000007',
   'Giới thiệu nền tảng tới tổ chức đấu giá', 'Chiến dịch đã kết thúc', 'ended',
   'Giới thiệu Tài Sản Đấu Giá tới các tổ chức',
   'Giải pháp kết nối tổ chức đấu giá với khách hàng tiềm năng.',
   '<p>Nền tảng Tài Sản Đấu Giá trân trọng giới thiệu giải pháp kết nối tổ chức đấu giá với khách hàng tiềm năng trên toàn quốc.</p>',
   'Tìm hiểu thêm', 'https://taisandaugia.vn/gioi-thieu',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":["company_rep"],"kycStatuses":[],"credit":null,"provinces":[],"includeNullProvince":true},"userIds":[],"emails":[]}'::jsonb,
   'immediate', NULL, 5, 5, 5, 3, 2, now() - interval '30 days', now() - interval '31 days'),

  ('aa000000-0000-4000-8000-000000000008',
   'Tái kích hoạt khách hàng có số dư credit cao', NULL, 'draft',
   'Ưu đãi dành cho khách hàng thân thiết',
   'Tri ân khách hàng có số dư credit từ 100 trở lên.',
   '<p>Cảm ơn Quý khách đã tin tưởng nền tảng. Nhân dịp này, chúng tôi gửi tới Quý khách ưu đãi đặc biệt.</p>',
   'Nhận ưu đãi', 'https://taisandaugia.vn/tri-an',
   '{"modes":{"criteria":true,"import":false,"specific":false},"criteria":{"registration":null,"accountTypes":[],"kycStatuses":[],"credit":{"min":100,"max":null},"provinces":["TP. Hồ Chí Minh","Hà Nội"],"includeNullProvince":false},"userIds":[],"emails":[]}'::jsonb,
   'immediate', NULL, NULL, 0, 0, 0, 0, NULL, now() - interval '3 hours')
ON CONFLICT (id) DO NOTHING;

-- Recipient snapshots for the scheduled / sending / sent / ended campaigns.
INSERT INTO public.campaign_recipients
  (campaign_id, email, name, status, sent_at, opened_at, clicked_at)
VALUES
  -- c3 scheduled: 6 pending
  ('aa000000-0000-4000-8000-000000000003','an.nguyen@example.com','Nguyễn Văn An','pending',NULL,NULL,NULL),
  ('aa000000-0000-4000-8000-000000000003','binh.tran@example.com','Trần Thị Bình','pending',NULL,NULL,NULL),
  ('aa000000-0000-4000-8000-000000000003','cuong.le@example.com','Lê Hoàng Cường','pending',NULL,NULL,NULL),
  ('aa000000-0000-4000-8000-000000000003','dung.pham@example.com','Phạm Thu Dung','pending',NULL,NULL,NULL),
  ('aa000000-0000-4000-8000-000000000003','duc.hoang@example.com','Hoàng Minh Đức','pending',NULL,NULL,NULL),
  ('aa000000-0000-4000-8000-000000000003','ha.vu@example.com','Vũ Thị Hà','pending',NULL,NULL,NULL),
  -- c4 sending: 5 sent + 3 pending
  ('aa000000-0000-4000-8000-000000000004','khoa.dang@example.com','Đặng Văn Khoa','sent', now() - interval '35 minutes', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','lan.bui@example.com','Bùi Thị Lan','sent', now() - interval '35 minutes', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','minh.ngo@example.com','Ngô Quang Minh','sent', now() - interval '34 minutes', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','nga.do@example.com','Đỗ Thị Nga','sent', now() - interval '34 minutes', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','phong.ly@example.com','Lý Thanh Phong','sent', now() - interval '33 minutes', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','quan.trinh@example.com','Trịnh Văn Quân','pending', NULL, NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','quyen.mai@example.com','Mai Thị Quyên','pending', NULL, NULL, NULL),
  ('aa000000-0000-4000-8000-000000000004','son.dinh@example.com','Đinh Hoàng Sơn','pending', NULL, NULL, NULL),
  -- c5 sent: 3 clicked + 3 opened + 4 sent
  ('aa000000-0000-4000-8000-000000000005','tam.nguyen@example.com','Nguyễn Văn Tâm','clicked', now() - interval '5 days', now() - interval '5 days' + interval '3 hours', now() - interval '5 days' + interval '4 hours'),
  ('aa000000-0000-4000-8000-000000000005','uyen.tran@example.com','Trần Thị Uyên','clicked', now() - interval '5 days', now() - interval '5 days' + interval '2 hours', now() - interval '5 days' + interval '3 hours'),
  ('aa000000-0000-4000-8000-000000000005','vinh.le@example.com','Lê Quang Vinh','clicked', now() - interval '5 days', now() - interval '5 days' + interval '5 hours', now() - interval '5 days' + interval '6 hours'),
  ('aa000000-0000-4000-8000-000000000005','xuan.pham@example.com','Phạm Thị Xuân','opened', now() - interval '5 days', now() - interval '5 days' + interval '2 hours', NULL),
  ('aa000000-0000-4000-8000-000000000005','yen.hoang@example.com','Hoàng Thị Yến','opened', now() - interval '5 days', now() - interval '5 days' + interval '4 hours', NULL),
  ('aa000000-0000-4000-8000-000000000005','bao.vu@example.com','Vũ Gia Bảo','opened', now() - interval '5 days', now() - interval '5 days' + interval '6 hours', NULL),
  ('aa000000-0000-4000-8000-000000000005','chi.dang@example.com','Đặng Linh Chi','sent', now() - interval '5 days', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000005','dat.bui@example.com','Bùi Tiến Đạt','sent', now() - interval '5 days', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000005','giang.ngo@example.com','Ngô Thu Giang','sent', now() - interval '5 days', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000005','hung.do@example.com','Đỗ Mạnh Hùng','sent', now() - interval '5 days', NULL, NULL),
  -- c6 sent: 1 clicked + 3 opened + 3 sent
  ('aa000000-0000-4000-8000-000000000006','khanh.ly@example.com','Lý Bảo Khánh','clicked', now() - interval '10 days', now() - interval '10 days' + interval '2 hours', now() - interval '10 days' + interval '3 hours'),
  ('aa000000-0000-4000-8000-000000000006','linh.trinh@example.com','Trịnh Mỹ Linh','opened', now() - interval '10 days', now() - interval '10 days' + interval '1 hour', NULL),
  ('aa000000-0000-4000-8000-000000000006','nam.mai@example.com','Mai Hoài Nam','opened', now() - interval '10 days', now() - interval '10 days' + interval '3 hours', NULL),
  ('aa000000-0000-4000-8000-000000000006','oanh.dinh@example.com','Đinh Kiều Oanh','opened', now() - interval '10 days', now() - interval '10 days' + interval '5 hours', NULL),
  ('aa000000-0000-4000-8000-000000000006','phuc.nguyen@example.com','Nguyễn Hồng Phúc','sent', now() - interval '10 days', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000006','quynh.tran@example.com','Trần Như Quỳnh','sent', now() - interval '10 days', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000006','tuan.le@example.com','Lê Anh Tuấn','sent', now() - interval '10 days', NULL, NULL),
  -- c7 ended: 2 clicked + 1 opened + 2 sent
  ('aa000000-0000-4000-8000-000000000007','viet.pham@example.com','Phạm Quốc Việt','clicked', now() - interval '30 days', now() - interval '30 days' + interval '2 hours', now() - interval '30 days' + interval '3 hours'),
  ('aa000000-0000-4000-8000-000000000007','anhtuan.hoang@example.com','Hoàng Tuấn Anh','clicked', now() - interval '30 days', now() - interval '30 days' + interval '1 hour', now() - interval '30 days' + interval '2 hours'),
  ('aa000000-0000-4000-8000-000000000007','bich.vu@example.com','Vũ Ngọc Bích','opened', now() - interval '30 days', now() - interval '30 days' + interval '4 hours', NULL),
  ('aa000000-0000-4000-8000-000000000007','chicuong.dang@example.com','Đặng Chí Cường','sent', now() - interval '30 days', NULL, NULL),
  ('aa000000-0000-4000-8000-000000000007','duong.bui@example.com','Bùi Thùy Dương','sent', now() - interval '30 days', NULL, NULL);

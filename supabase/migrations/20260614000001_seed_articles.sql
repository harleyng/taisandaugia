-- Seed 8 sample articles for development / UI testing
-- Uses subqueries to resolve category IDs by slug (safe even if UUIDs differ)

INSERT INTO articles (
  title, slug, excerpt, content,
  featured_image_url,
  category_id,
  status, published_at,
  view_count, read_time_minutes,
  source_type, source_name, source_url,
  show_on_homepage, homepage_position
)
VALUES

-- 1. Homepage slot 1 — featured (external, Kết quả đấu giá)
(
  'Phiên đấu giá đất Thanh Oai lập kỷ lục chênh lệch giá 2.400%',
  'phien-dau-gia-dat-thanh-oai-lap-ky-luc-chenh-lech-2400',
  'Lô đất khởi điểm 1,8 triệu/m² được trả lên tới 45 triệu/m², tạo nên kỷ lục chênh lệch giá chưa từng có trong lịch sử đấu giá đất tại Việt Nam.',
  '<p>Ngày 10/8/2024, phiên đấu giá quyền sử dụng đất tại huyện Thanh Oai (Hà Nội) đã thu hút hơn 4.000 hồ sơ đăng ký tham gia, với giá trúng cao nhất đạt 100,5 triệu đồng/m² — vượt xa giá khởi điểm chỉ 1,8 triệu đồng/m².</p><h2>Diễn biến phiên đấu giá</h2><p>Phiên đấu giá kéo dài từ 8 giờ sáng đến tận 21 giờ tối, với hàng nghìn lượt trả giá liên tiếp. Các lô đất tại khu vực trung tâm xã Bình Minh nhận được sự cạnh tranh gay gắt nhất.</p><ul><li>Lô đất A: 100,5 triệu/m² (khởi điểm 1,8 triệu)</li><li>Lô đất B: 78 triệu/m²</li><li>Lô đất C: 63 triệu/m²</li></ul><h2>Phản ứng từ chuyên gia</h2><p>Nhiều chuyên gia bất động sản cảnh báo về rủi ro khi giá đấu vượt quá xa giá trị thực của đất đai trong khu vực. Theo đánh giá sơ bộ, giá thị trường tại Thanh Oai chỉ ở mức 15–25 triệu/m².</p>',
  'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'ket-qua-dau-gia'),
  'published', NOW() - INTERVAL '2 hours',
  21900, 4,
  'external', 'Dân trí', 'https://dantri.com.vn',
  true, 1
),

-- 2. Homepage slot 2 (external, Pháp luật)
(
  'Luật Đấu giá tài sản sửa đổi: 5 điểm mới quan trọng có hiệu lực từ 2026',
  'luat-dau-gia-tai-san-sua-doi-5-diem-moi-quan-trong-2026',
  'Luật Đấu giá tài sản sửa đổi bổ sung nhiều quy định mới về đặt cọc, hình thức đấu giá trực tuyến và chế tài xử lý vi phạm, chính thức có hiệu lực từ ngày 1/1/2026.',
  '<p>Quốc hội vừa thông qua Luật sửa đổi, bổ sung một số điều của Luật Đấu giá tài sản, với nhiều điểm đột phá về quy trình và chế tài xử phạt.</p><h2>Những thay đổi chính</h2><ol><li><strong>Nâng mức đặt cọc:</strong> Từ 5% lên tối thiểu 10% giá khởi điểm để hạn chế đầu cơ.</li><li><strong>Đấu giá trực tuyến bắt buộc:</strong> Các lô đất có giá khởi điểm trên 20 tỷ phải tổ chức qua nền tảng điện tử.</li><li><strong>Chế tài bỏ cọc:</strong> Người trúng đấu giá bỏ cọc bị cấm tham gia đấu giá trong 2 năm.</li></ol>',
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'phap-luat'),
  'published', NOW() - INTERVAL '6 hours',
  14300, 5,
  'external', 'VnExpress', 'https://vnexpress.net',
  true, 2
),

-- 3. Homepage slot 3 (original, Thị trường)
(
  'Thị trường đấu giá bất động sản 6 tháng đầu 2026: Tổng hợp và nhận định',
  'thi-truong-dau-gia-bat-dong-san-6-thang-dau-2026',
  'Tổng giá trị tài sản đấu giá thành công đạt 48.000 tỷ đồng trong nửa đầu 2026, tăng 23% so với cùng kỳ năm trước. Đất ở tại đô thị chiếm 61% giá trị giao dịch.',
  '<p>Theo số liệu từ Bộ Tư pháp, thị trường đấu giá tài sản nửa đầu năm 2026 ghi nhận tăng trưởng mạnh ở hầu hết các phân khúc.</p><h2>Số liệu tổng quan</h2><p>Cả nước đã tổ chức 12.400 phiên đấu giá, trong đó 9.800 phiên thành công (tỷ lệ 79%). Tổng giá trị tài sản đưa ra đấu giá đạt 95.000 tỷ đồng.</p><h2>Phân khúc đất ở dẫn đầu</h2><p>Đất ở tại đô thị tiếp tục là phân khúc sôi động nhất với mức tăng giá bình quân 18% so với giá khởi điểm. Các tỉnh có hoạt động đấu giá nhiều nhất: Hà Nội, TP.HCM, Bình Dương, Đồng Nai.</p>',
  'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'thi-truong'),
  'published', NOW() - INTERVAL '1 day',
  8750, 6,
  'original', NULL, NULL,
  true, 3
),

-- 4. Homepage slot 4 (external, Kiến thức)
(
  'Cẩn trọng với chiêu trò thổi giá và quân xanh tại các phiên đấu giá đất',
  'can-trong-chieu-tro-thoi-gia-quan-xanh-tai-phien-dau-gia-dat',
  'Nhiều người mua nhà lần đầu thiếu kinh nghiệm dễ bị cuốn vào vòng xoáy giá ảo do nhóm đầu cơ tạo ra. Các dấu hiệu nhận biết và cách phòng tránh.',
  '<p>Tình trạng "quân xanh" — người được thuê để đẩy giá lên cao — xuất hiện ngày càng nhiều tại các phiên đấu giá đất, đặc biệt ở các khu vực ven đô.</p><h2>Dấu hiệu nhận biết</h2><ul><li>Giá tăng đột biến ngay từ những lượt đầu tiên</li><li>Một nhóm người cùng đấu giá và nhanh chóng nhường nhau</li><li>Giá khởi điểm rất thấp nhưng tăng vọt bất thường</li></ul><h2>Cách bảo vệ bản thân</h2><p>Trước khi tham gia, hãy nghiên cứu kỹ giá đất thị trường tại khu vực, đặt ngưỡng giá tối đa và kiên định không vượt quá con số đó dù bị áp lực.</p>',
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'kien-thuc'),
  'published', NOW() - INTERVAL '2 days',
  17200, 5,
  'external', 'CafeF', 'https://cafef.vn',
  true, 4
),

-- 5. Homepage slot 5 (original, Kiến thức)
(
  'Hướng dẫn toàn bộ quy trình tham gia đấu giá bất động sản từ A đến Z',
  'huong-dan-toan-bo-quy-trinh-tham-gia-dau-gia-bat-dong-san-a-den-z',
  'Từ đăng ký hồ sơ, nộp tiền đặt cọc, tham dự phiên đấu giá đến ký kết hợp đồng và thanh toán — tất cả những gì bạn cần biết trước khi tham gia.',
  '<p>Đấu giá bất động sản là kênh mua nhà đất minh bạch, nhưng nhiều người vẫn còn xa lạ với quy trình. Bài viết này hướng dẫn chi tiết từng bước.</p><h2>Bước 1: Tìm hiểu phiên đấu giá</h2><p>Theo dõi thông báo đấu giá trên Cổng thông tin điện tử của Sở Tư pháp hoặc website của tổ chức đấu giá. Thông báo phải được đăng tối thiểu 7 ngày trước phiên.</p><h2>Bước 2: Nộp hồ sơ và đặt cọc</h2><p>Chuẩn bị CMND/CCCD, đơn đăng ký tham gia, và tiền đặt cọc (thường 5–10% giá khởi điểm). Hạn nộp thường trước phiên đấu giá 1–2 ngày làm việc.</p><h2>Bước 3: Tham dự phiên đấu giá</h2><p>Đến đúng giờ, mang theo giấy tờ tùy thân. Tại phiên, bạn sẽ nhận phiếu trả giá (đấu giá bằng phiếu) hoặc đăng nhập hệ thống (đấu giá trực tuyến).</p>',
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'kien-thuc'),
  'published', NOW() - INTERVAL '3 days',
  12400, 7,
  'original', NULL, NULL,
  true, 5
),

-- 6. Not on homepage (Kết quả đấu giá)
(
  'TP.HCM đấu giá thành công 4 lô đất Thủ Thiêm, thu về 37.346 tỷ đồng',
  'tphcm-dau-gia-thanh-cong-4-lo-dat-thu-thiem-37346-ty-dong',
  'Bốn lô đất tại khu đô thị mới Thủ Thiêm vừa được đấu giá thành công với tổng giá trị 37.346 tỷ đồng, vượt hơn 4 lần so với giá khởi điểm.',
  '<p>Chiều ngày 10/12/2021, Trung tâm Dịch vụ đấu giá tài sản TP.HCM đã tổ chức phiên đấu giá 4 lô đất tại Khu đô thị mới Thủ Thiêm.</p><p>Kết quả cụ thể từng lô:</p><ul><li>Lô 3-12: 24.500 tỷ đồng (Công ty Sheen Mega)</li><li>Lô 3-9: 5.300 tỷ đồng (Công ty Dream Republic)</li><li>Lô 3-5: 4.000 tỷ đồng (Công ty Bình Minh)</li><li>Lô 3-8: 3.546 tỷ đồng (Tân Hoàng Minh)</li></ul>',
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'ket-qua-dau-gia'),
  'published', NOW() - INTERVAL '4 days',
  31500, 4,
  'external', 'Tuổi Trẻ', 'https://tuoitre.vn',
  false, NULL
),

-- 7. Not on homepage (Pháp luật)
(
  'Bộ Tư pháp ban hành thông tư hướng dẫn đấu giá tài sản trực tuyến',
  'bo-tu-phap-ban-hanh-thong-tu-huong-dan-dau-gia-tai-san-truc-tuyen',
  'Thông tư 05/2026/TT-BTP quy định chi tiết về nền tảng đấu giá điện tử, chữ ký số và bảo mật giao dịch trong đấu giá tài sản trực tuyến.',
  '<p>Ngày 15/3/2026, Bộ Tư pháp ban hành Thông tư 05/2026/TT-BTP hướng dẫn thi hành các quy định về đấu giá tài sản qua phương tiện điện tử.</p><h2>Phạm vi áp dụng</h2><p>Thông tư áp dụng cho tất cả tổ chức đấu giá chuyên nghiệp khi thực hiện đấu giá tài sản theo hình thức trực tuyến hoặc kết hợp trực tiếp và trực tuyến.</p>',
  'https://images.unsplash.com/photo-1521791055366-0d553872952f?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'phap-luat'),
  'published', NOW() - INTERVAL '5 days',
  6800, 4,
  'original', NULL, NULL,
  false, NULL
),

-- 8. Not on homepage (Thị trường)
(
  'Bản đồ nhiệt đấu giá đất 2026: Vùng nào đang sôi động nhất?',
  'ban-do-nhiet-dau-gia-dat-2026-vung-nao-dang-soi-dong-nhat',
  'Phân tích dữ liệu 6 tháng đầu năm cho thấy vành đai 4 Hà Nội, Đồng Nai, và Long An là ba điểm nóng đấu giá đất trong năm 2026.',
  '<p>Dựa trên dữ liệu tổng hợp từ 63 Sở Tư pháp tỉnh thành, nhóm nghiên cứu của Tài Sản Đấu Giá đã xây dựng bản đồ nhiệt hoạt động đấu giá đất trên toàn quốc.</p><h2>Top 5 tỉnh thành sôi động nhất</h2><ol><li>Hà Nội — 1.240 phiên, tổng giá trị 18.500 tỷ</li><li>TP.HCM — 890 phiên, tổng giá trị 14.200 tỷ</li><li>Đồng Nai — 670 phiên, tổng giá trị 7.800 tỷ</li><li>Long An — 520 phiên, tổng giá trị 5.400 tỷ</li><li>Bình Dương — 480 phiên, tổng giá trị 4.900 tỷ</li></ol>',
  'https://images.unsplash.com/photo-1524813686514-a57563d77965?w=800&q=80',
  (SELECT id FROM article_categories WHERE slug = 'thi-truong'),
  'published', NOW() - INTERVAL '6 days',
  9300, 5,
  'original', NULL, NULL,
  false, NULL
);

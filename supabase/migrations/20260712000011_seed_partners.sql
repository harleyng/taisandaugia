-- Seed 2 đối tác hiện có (giữ homepage y hệt sau khi chuyển sang data-driven).
-- id sentinel cố định (an toàn để xoá). logo_url trỏ tới /public/partners/*.png (app phục vụ).
-- Đối tác mới do admin thêm sẽ upload logo lên bucket partner-logos.

INSERT INTO public.partners
  (id, name, badge, accent_color, logo_url, logo_filter, tagline, description, stats,
   date_label, date_value, cta_text, cta_href, sort_order, status) VALUES
  ('face0001-0000-4000-8000-000000000001',
   'Antiquorum', 'Đối tác toàn cầu', '#DA2128',
   '/partners/logo-anti.png', NULL,
   'Important Modern & Vintage Timepieces',
   'Nhà đấu giá đồng hồ độc lập lâu đời bậc nhất thế giới. Mỗi phiên Antiquorum quy tụ hàng trăm lô hiện vật được giám định bởi các chuyên gia hàng đầu — từ Patek Philippe complications đến những độc bản Rolex hiếm thấy.',
   '[{"label":"Năm thành lập","value":"1974"},{"label":"Phiên/năm","value":"12+"},{"label":"Văn phòng","value":"3 châu lục"}]'::jsonb,
   'Phiên Hong Kong', '31 · 05 · 2026', 'Khám phá phiên đấu giá', 'https://antiquorum.swiss', 0, 'active'),

  ('face0001-0000-4000-8000-000000000002',
   'ZAHA Legacy Marathon', 'Đối tác cộng đồng', '#367639',
   '/partners/logo-marathon.png',
   'brightness(0) saturate(100%) invert(16%) sepia(64%) saturate(726%) hue-rotate(196deg) brightness(94%) contrast(94%)',
   'Giải chạy Việt Nam Tôi đó',
   'Giải chạy thường niên quy mô toàn quốc với các cự ly 2.9km, 9.2km, 21km và bán-marathon đầy đủ 42km. Mỗi bước chạy là một câu chuyện — về di sản, sức bền, và lòng tự hào dân tộc.',
   '[{"label":"Cự ly","value":"4 chặng"},{"label":"Vận động viên","value":"12.000+"},{"label":"Mùa giải","value":"Lần thứ 5"}]'::jsonb,
   'Ngày khởi tranh', '23 · 08 · 2026', 'Đăng ký giải chạy', 'https://facebook.com/vntoido', 1, 'active');

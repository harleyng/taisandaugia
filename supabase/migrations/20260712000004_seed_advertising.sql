-- DEMO / TEST DATA cho Quảng cáo. Phụ thuộc 20260712000002_advertising.sql.
-- An toàn để xoá (id sentinel cố định ad000001..ad000004, created_by NULL).
-- code (B..., KH...) do trigger sinh — không set thủ công.

-- ─── ad_pages ────────────────────────────────────────────────────────────────
INSERT INTO public.ad_pages (id, name, slug, sort_order) VALUES
  ('ad000001-0000-4000-8000-000000000001', 'Trang chủ',       'trang-chu',      0),
  ('ad000001-0000-4000-8000-000000000002', 'Trang danh sách', 'trang-danh-sach', 1),
  ('ad000001-0000-4000-8000-000000000003', 'Trang chi tiết',  'trang-chi-tiet', 2);

-- ─── customers (khách hàng dùng chung) ───────────────────────────────────────
INSERT INTO public.customers (id, name, customer_type, contact_name, phone, email, tax_code, address, status) VALUES
  ('ad000003-0000-4000-8000-000000000001', 'Công ty CP Bất động sản Đại Phát', 'company',
   'Nguyễn Văn An', '0901234567', 'contact@daiphat.vn', '0312345678', 'Số 12 Nguyễn Huệ, Q.1, TP.HCM', 'active'),
  ('ad000003-0000-4000-8000-000000000002', 'Ngân hàng TMCP Đông Nam Á', 'company',
   'Trần Thị Bình', '0912345678', 'marketing@seabank.vn', '0100112233', '25 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', 'active');

-- ─── ad_positions (loại slide/unique + giá) ──────────────────────────────────
INSERT INTO public.ad_positions
  (id, page_id, name, code, placement_type, price, desktop_width, desktop_height, mobile_width, mobile_height, sort_order) VALUES
  ('ad000002-0000-4000-8000-000000000001', 'ad000001-0000-4000-8000-000000000001',
   'Header chính (Slider)', 'home-header-slider', 'slide', 5000000, 795, 255, 375, 200, 0),
  ('ad000002-0000-4000-8000-000000000002', 'ad000001-0000-4000-8000-000000000001',
   'Popup trang chủ', 'home-popup', 'unique', 12000000, 600, 400, 320, 400, 1),
  ('ad000002-0000-4000-8000-000000000003', 'ad000001-0000-4000-8000-000000000002',
   'Sidebar danh sách', 'listing-sidebar', 'slide', 3000000, 300, 600, 375, 200, 0),
  ('ad000002-0000-4000-8000-000000000004', 'ad000001-0000-4000-8000-000000000002',
   'Banner đầu trang danh sách', 'listing-top', 'unique', 8000000, 970, 250, 375, 200, 1),
  ('ad000002-0000-4000-8000-000000000005', 'ad000001-0000-4000-8000-000000000003',
   'Banner trang chi tiết', 'detail-inline', 'slide', 2500000, 728, 90, 375, 120, 0);

-- ─── advertisements (banner) ─────────────────────────────────────────────────
INSERT INTO public.advertisements
  (id, name, is_test, position_id, show_desktop, show_mobile, desktop_image_url, mobile_image_url,
   nav_type, nav_url, start_type, start_at, end_type, end_at, sort_order, status,
   view_count, click_count, customer_id, created_at) VALUES
  -- Đang hiển thị (active) — dùng cho biểu đồ Thống kê
  ('ad000004-0000-4000-8000-000000000001',
   'Banner khai trương dự án Đại Phát Riverside', false,
   'ad000002-0000-4000-8000-000000000001', true, true,
   'https://placehold.co/795x255/1e40af/ffffff/png?text=Dai+Phat+Riverside',
   'https://placehold.co/375x200/1e40af/ffffff/png?text=Dai+Phat',
   'link', 'https://taisandaugia.vn/du-an/dai-phat-riverside',
   'immediate', now() - interval '20 days', 'scheduled', now() + interval '10 days',
   1, 'active', 152340, 18420,
   'ad000003-0000-4000-8000-000000000001', now() - interval '22 days'),

  -- Lên lịch (scheduled) — vị trí unique
  ('ad000004-0000-4000-8000-000000000002',
   'Banner ưu đãi vay mua nhà SeABank', false,
   'ad000002-0000-4000-8000-000000000004', true, true,
   'https://placehold.co/970x250/047857/ffffff/png?text=SeABank+Uu+Dai',
   'https://placehold.co/375x200/047857/ffffff/png?text=SeABank',
   'link', 'https://taisandaugia.vn/uu-dai-vay',
   'scheduled', now() + interval '5 days', 'scheduled', now() + interval '12 days',
   1, 'scheduled', 0, 0,
   'ad000003-0000-4000-8000-000000000002', now() - interval '2 days'),

  -- Bản nháp (draft)
  ('ad000004-0000-4000-8000-000000000003',
   'Banner giới thiệu tài sản thanh lý (nháp)', false,
   'ad000002-0000-4000-8000-000000000003', true, false,
   'https://placehold.co/300x600/b45309/ffffff/png?text=Thanh+Ly', NULL,
   'none', NULL,
   'immediate', NULL, 'continuous', NULL,
   2, 'draft', 0, 0,
   NULL, now() - interval '1 day');

-- ─── ad_daily_stats — 30 ngày × 2 thiết bị cho banner active ─────────────────
INSERT INTO public.ad_daily_stats (advertisement_id, stat_date, device, views, clicks)
SELECT
  'ad000004-0000-4000-8000-000000000001'::uuid,
  (current_date - g)::date,
  d.dev,
  calc.v,
  greatest(1, round(calc.v * (0.06 + 0.06 * (0.5 + 0.5 * sin((g + d.off)::numeric / 4))))::int)
FROM generate_series(0, 29) AS g
CROSS JOIN (VALUES ('desktop', 0), ('mobile', 2)) AS d(dev, off)
CROSS JOIN LATERAL (
  SELECT (
    CASE d.dev WHEN 'desktop' THEN 2600 ELSE 1400 END
    + (900 * (0.5 + 0.5 * sin((g + d.off)::numeric / 3.5)))::int
    + ((g * 17 + d.off * 53) % 350)
  )::int AS v
) AS calc;

-- Vị trí quảng cáo có "phiên trả giá": thêm thời gian kết thúc (để đếm ngược)
-- và số người đang trả giá. Giá hiện tại dùng lại cột ad_positions.price.

ALTER TABLE public.ad_positions
  ADD COLUMN auction_ends_at TIMESTAMPTZ,
  ADD COLUMN bidder_count    INTEGER NOT NULL DEFAULT 0;

-- Seed demo cho vài vị trí (card "Vị trí quảng cáo" có dữ liệu sống).
UPDATE public.ad_positions SET auction_ends_at = now() + interval '5 days',  bidder_count = 4
  WHERE id = 'ad000002-0000-4000-8000-000000000002';  -- Popup trang chủ (unique)
UPDATE public.ad_positions SET auction_ends_at = now() + interval '12 days', bidder_count = 7
  WHERE id = 'ad000002-0000-4000-8000-000000000004';  -- Banner đầu trang danh sách (unique)
UPDATE public.ad_positions SET auction_ends_at = now() + interval '3 days',  bidder_count = 2
  WHERE id = 'ad000002-0000-4000-8000-000000000001';  -- Header chính (slide)

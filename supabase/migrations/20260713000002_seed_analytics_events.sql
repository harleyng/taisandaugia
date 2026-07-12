-- Seed dữ liệu demo cho báo cáo "Phân tích truy cập" để các biểu đồ "rich" ngay
-- từ đầu (tracking thật chỉ tích lũy từ lúc bật). Sinh ~90 ngày sự kiện bằng SQL:
--   • ~1500 phiên (session), mỗi phiên 1–8 page_view + 0–3 feature event.
--   • Thiết bị ~60% mobile / 30% desktop / 10% tablet; OS suy theo thiết bị.
--   • Tỉnh nghiêng HN/HCM; path & feature_key theo trọng số thực tế.
--   • ~35% phiên gắn user thật (nếu có profile), còn lại ẩn danh (user_id NULL).
-- province set trực tiếp nên trigger fill_province bỏ qua. Idempotent: xoá seed cũ
-- (referrer sentinel 'seed') trước khi chèn lại.

DELETE FROM public.analytics_events WHERE referrer = 'seed://demo';

DO $$
DECLARE
  uids   UUID[];
  n_uids INT;
BEGIN
  SELECT array_agg(id) INTO uids FROM public.profiles;
  n_uids := COALESCE(array_length(uids, 1), 0);

  -- device_type PHẢI nằm trong SELECT list cấp dòng (không bọc trong subquery
  -- non-correlated) — nếu không Postgres cache random() và mọi dòng ra cùng 1
  -- thiết bị. os phụ thuộc device_type nên tách sang CTE sessions.
  raw_sessions AS (
    SELECT
      gen_random_uuid()::text AS session_id,
      -- Trải trên 90 ngày, nghiêng nhẹ về gần đây (bình phương nghịch)
      now() - ((random() ^ 1.3) * interval '90 days') AS started_at,
      (ARRAY['mobile','mobile','mobile','mobile','mobile','mobile',
             'desktop','desktop','desktop','tablet'])[1 + floor(random() * 10)::int] AS device_type,
      (ARRAY['Chrome','Chrome','Safari','Safari','Edge','Firefox','Cốc Cốc'])[1 + floor(random() * 7)::int] AS browser,
      (ARRAY['Hà Nội','Hà Nội','Hà Nội','TP. Hồ Chí Minh','TP. Hồ Chí Minh','TP. Hồ Chí Minh',
             'Đà Nẵng','Hải Phòng','Cần Thơ','Bình Dương','Đồng Nai','Quảng Ninh','Bắc Ninh','Nghệ An'
            ])[1 + floor(random() * 14)::int] AS province,
      (ARRAY['seed://demo','seed://demo','seed://demo','seed://demo',
             'https://www.google.com','https://www.facebook.com','https://zalo.me'
            ])[1 + floor(random() * 7)::int] AS referrer,
      CASE
        WHEN n_uids > 0 AND random() < 0.35 THEN uids[1 + floor(random() * n_uids)::int]
        ELSE NULL
      END AS user_id,
      (1 + floor(random() * 8)::int) AS n_pages,   -- 1..8 page views
      floor(random() * 4)::int       AS n_feats    -- 0..3 feature events
    FROM generate_series(1, 1500) AS g
  ),
  sessions AS (
    SELECT rs.*,
      CASE rs.device_type
        WHEN 'mobile'  THEN (ARRAY['iOS','Android','Android'])[1 + floor(random() * 3)::int]
        WHEN 'tablet'  THEN (ARRAY['iPadOS','Android'])[1 + floor(random() * 2)::int]
        ELSE (ARRAY['Windows','Windows','macOS'])[1 + floor(random() * 3)::int]
      END AS os
    FROM raw_sessions rs
  ),
  page_events AS (
    SELECT
      s.session_id, s.user_id, 'page_view'::text AS event_type,
      (ARRAY['/','/','/','/listings','/listings','/listings','/listings/chi-tiet','/report',
             '/auctions/phien-dau-gia','/buy-credits','/profile','/tin-tuc','/auction-org/cong-ty','/lien-he'
            ])[1 + floor(random() * 14)::int] AS path,
      NULL::text AS feature_key,
      s.device_type, s.browser, s.os, s.province, s.referrer,
      s.started_at + (seq * (interval '35 seconds') * (1 + random())) AS created_at
    FROM sessions s
    CROSS JOIN LATERAL generate_series(1, s.n_pages) AS seq
  ),
  feature_events AS (
    SELECT
      s.session_id, s.user_id, 'feature'::text AS event_type,
      NULL::text AS path,
      (ARRAY['search','search','view_listing','view_listing','view_listing','save_asset',
             'open_paywall','open_buy_credits','select_credit_package','view_report',
             'start_kyc','unlock_asset','view_auction'
            ])[1 + floor(random() * 13)::int] AS feature_key,
      s.device_type, s.browser, s.os, s.province, s.referrer,
      s.started_at + (seq * (interval '50 seconds') * (1 + random())) AS created_at
    FROM sessions s
    CROSS JOIN LATERAL generate_series(1, s.n_feats) AS seq
    WHERE s.n_feats > 0
  )
  INSERT INTO public.analytics_events
    (session_id, user_id, event_type, path, feature_key, device_type, browser, os, province, referrer, created_at)
  SELECT session_id, user_id, event_type, path, feature_key, device_type, browser, os, province, referrer, created_at
    FROM page_events
  UNION ALL
  SELECT session_id, user_id, event_type, path, feature_key, device_type, browser, os, province, referrer, created_at
    FROM feature_events;
END $$;

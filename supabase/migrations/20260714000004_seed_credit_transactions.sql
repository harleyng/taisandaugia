-- Seed dữ liệu demo cho báo cáo "Giao dịch credit" (/admin/bao-cao/giao-dich) để
-- các KPI + biểu đồ "rich" ngay từ đầu (giao dịch thật chỉ tích lũy dần). Báo cáo
-- CHỈ đọc `credit_transactions` (+ embed profiles) rồi tổng hợp phía client; doanh
-- thu VND SUY RA từ dòng `purchase` khớp `Mua gói {name}` theo CREDIT_PACKAGES.
--
-- An toàn:
--   • KHÔNG đụng `user_credits` (số dư là counter độc lập) → không đổi số dư user.
--   • `description` KHÔNG hiển thị trong báo cáo (nhãn suy từ gói / loại tính năng),
--     nên nhét marker ' [demo]' để idempotent; marker cũng đánh dấu rõ đây là dữ
--     liệu mẫu khi user xem lịch sử ở trang hồ sơ.
--   • Đính vào 34 profiles sẵn có (FK credit_transactions.user_id → profiles.id).
--
-- Idempotent: xoá seed cũ (marker [demo]) trước khi chèn lại.
-- Ngày: skew về gần đây (random()^1.5) trên 180 ngày → xu hướng doanh thu đi lên,
-- dày ở 30 ngày gần nhất để view mặc định (preset "30 ngày") đầy dữ liệu.

DELETE FROM public.credit_transactions WHERE description LIKE '%[demo]%';

DO $$
DECLARE
  uids UUID[];
  n    INT;
BEGIN
  SELECT array_agg(id) INTO uids FROM public.profiles;
  n := COALESCE(array_length(uids, 1), 0);
  IF n = 0 THEN
    RAISE NOTICE 'Không có profile — bỏ qua seed credit_transactions.';
    RETURN;
  END IF;

  -- ── 1) PURCHASE (doanh thu) — ~520 dòng ───────────────────────────────────
  -- Gói weighted: Popular/Value nặng nhất, Max hiếm. credit_delta = credits gói
  -- (69/190/330/600/2600) khớp CREDIT_PACKAGES; description 'Mua gói {name} [demo]'
  -- để resolvePurchase().includes('Mua gói {name}') vẫn khớp giá VND.
  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  SELECT
    uids[1 + floor(random() * n)::int],
    'purchase',
    'Mua gói ' || nm || ' [demo]',
    CASE nm
      WHEN 'Starter' THEN 69
      WHEN 'Popular' THEN 190
      WHEN 'Value'   THEN 330
      WHEN 'Pro'     THEN 600
      WHEN 'Max'     THEN 2600
    END,
    now() - ((random() ^ 1.5) * interval '180 days')
  FROM (
    SELECT (ARRAY[
      'Starter','Starter','Starter','Starter','Starter',                    -- 5
      'Popular','Popular','Popular','Popular','Popular','Popular','Popular', -- 7
      'Value','Value','Value','Value','Value',                              -- 5
      'Pro','Pro','Pro',                                                    -- 3
      'Max'                                                                 -- 1
    ])[1 + floor(random() * 21)::int] AS nm
    FROM generate_series(1, 520)
  ) s;

  -- ── 2) CONSUMPTION (tiêu dùng credit) — ~2000 dòng ────────────────────────
  -- Trải khắp 6 loại tính năng (credit_delta ÂM). unlock_asset áp đảo về SỐ LƯỢT;
  -- deep_report ít lượt nhưng credit lớn (big sink) → phản ánh thực tế.
  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  SELECT
    uids[1 + floor(random() * n)::int],
    CASE
      WHEN tok = 'asset'            THEN 'unlock_asset'
      WHEN tok LIKE 'company%'      THEN 'unlock_company'
      WHEN tok LIKE 'owner\_%'      THEN 'unlock_owner'
      WHEN tok LIKE 'deep%'         THEN 'unlock_deep_report'
      WHEN tok = 'ownerview'        THEN 'owner_report_view'
      WHEN tok LIKE 'demand%'       THEN 'subscribe_demand'
    END,
    (CASE tok
      WHEN 'asset'        THEN 'Mở khóa tài sản đấu giá'
      WHEN 'company_7d'   THEN 'Theo dõi công ty 7 ngày'
      WHEN 'company_30d'  THEN 'Theo dõi công ty 30 ngày'
      WHEN 'company_1y'   THEN 'Theo dõi công ty 1 năm'
      WHEN 'owner_7d'     THEN 'Theo dõi chủ tài sản 7 ngày'
      WHEN 'owner_30d'    THEN 'Theo dõi chủ tài sản 30 ngày'
      WHEN 'owner_1y'     THEN 'Theo dõi chủ tài sản 1 năm'
      WHEN 'deep_month'   THEN 'Mở khóa báo cáo chuyên sâu — tháng'
      WHEN 'deep_quarter' THEN 'Mở khóa báo cáo chuyên sâu — quý'
      WHEN 'deep_year'    THEN 'Mở khóa báo cáo chuyên sâu — năm'
      WHEN 'ownerview'    THEN 'Xem báo cáo chủ tài sản (bộ lọc tùy chỉnh)'
      WHEN 'demand_7d'    THEN 'Theo dõi nhu cầu 7 ngày'
      WHEN 'demand_30d'   THEN 'Theo dõi nhu cầu 30 ngày'
    END) || ' [demo]',
    -1 * (CASE tok
      WHEN 'asset'        THEN 59
      WHEN 'company_7d'   THEN 99
      WHEN 'company_30d'  THEN 299
      WHEN 'company_1y'   THEN 1990
      WHEN 'owner_7d'     THEN 49
      WHEN 'owner_30d'    THEN 149
      WHEN 'owner_1y'     THEN 995
      WHEN 'deep_month'   THEN 990
      WHEN 'deep_quarter' THEN 2490
      WHEN 'deep_year'    THEN 8900
      WHEN 'ownerview'    THEN 49
      WHEN 'demand_7d'    THEN 99
      WHEN 'demand_30d'   THEN 299
    END),
    now() - ((random() ^ 1.5) * interval '180 days')
  FROM (
    SELECT (ARRAY[
      'asset','asset','asset','asset','asset','asset','asset','asset','asset',
      'asset','asset','asset','asset','asset','asset','asset','asset','asset',  -- 18
      'company_7d','company_7d','company_7d','company_30d','company_30d','company_30d','company_1y', -- 7
      'owner_7d','owner_7d','owner_7d','owner_30d','owner_30d','owner_1y',       -- 6
      'deep_month','deep_month','deep_quarter','deep_year',                      -- 4
      'ownerview','ownerview','ownerview','ownerview',                          -- 4
      'demand_7d','demand_7d','demand_30d','demand_30d'                         -- 4
    ])[1 + floor(random() * 43)::int] AS tok
    FROM generate_series(1, 2000)
  ) s;

  -- ── 3) ADMIN_GRANT (topup không tính doanh thu → nhãn "Admin tặng") ────────
  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  SELECT
    uids[1 + floor(random() * n)::int],
    'admin_grant',
    'Admin tặng credit khuyến mãi [demo]',
    (ARRAY[50, 100, 100, 200, 500])[1 + floor(random() * 5)::int],
    now() - ((random() ^ 1.5) * interval '180 days')
  FROM generate_series(1, 15);

  -- ── 4) "Nạp khác" (purchase dương KHÔNG khớp gói → VND 0) ──────────────────
  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  SELECT
    uids[1 + floor(random() * n)::int],
    'purchase',
    'Nạp ' || amt || ' tín dụng [demo]',
    amt,
    now() - ((random() ^ 1.5) * interval '180 days')
  FROM (
    SELECT (ARRAY[250, 500, 750])[1 + floor(random() * 3)::int] AS amt
    FROM generate_series(1, 6)
  ) s;

  RAISE NOTICE 'Seed credit_transactions xong.';
END $$;

-- Re-seed dữ liệu demo cho báo cáo "Doanh thu" + "Giao dịch credit" theo catalog
-- MỚI (nhóm→biến thể, 15 gói/3 đối tượng). Thay bản seed cũ 20260714000004 (tên gói
-- 5 gói cũ). Gắn service_variant_id + variant_key để quy doanh thu bền vững + hiển
-- thị theo nhóm/đối tượng. Idempotent qua marker [demo].
--
-- Ledger seed KHÔNG cập nhật user_credits.balance (chỉ là dòng báo cáo) — giống bản cũ.

DO $$
DECLARE
  v_users     uuid[];
  v_customers uuid[];
  v_ad_service uuid;
BEGIN
  SELECT array_agg(id) INTO v_users FROM public.profiles;
  IF v_users IS NULL OR array_length(v_users, 1) IS NULL THEN
    RAISE NOTICE 'Không có profiles — bỏ qua seed doanh thu.';
    RETURN;
  END IF;

  -- Dọn seed cũ (mọi marker [demo], gồm cả tên gói cũ Starter/Popular/…).
  DELETE FROM public.credit_transactions WHERE description LIKE '%[demo]%';

  -- ── Nạp gói (purchase) — 500 dòng, biến thể category='package' ─────────────
  INSERT INTO public.credit_transactions
    (user_id, type, description, credit_delta, service_variant_id, variant_key, created_at)
  SELECT
    v_users[1 + floor(random() * array_length(v_users, 1))::int],
    'purchase',
    'Mua gói ' || sv.name || ' [demo]',
    sv.credits,
    sv.id,
    sv.variant_key,
    now() - (power(random(), 1.5) * interval '365 days')
  FROM generate_series(1, 500) gs
  CROSS JOIN LATERAL (
    SELECT v.id, v.name, v.credits, v.variant_key
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
    WHERE s.category = 'package' AND v.is_active AND v.credits IS NOT NULL
    ORDER BY random()
    LIMIT 1
  ) sv;

  -- ── Tiêu dùng (unlock/feature) — 1600 dòng, credit_delta âm theo credit_cost ─
  INSERT INTO public.credit_transactions
    (user_id, type, description, credit_delta, service_variant_id, variant_key, created_at)
  SELECT
    v_users[1 + floor(random() * array_length(v_users, 1))::int],
    f.tx_type,
    f.grp_name || ' — ' || f.name || ' [demo]',
    -f.credit_cost,
    f.id,
    f.variant_key,
    now() - (power(random(), 1.2) * interval '365 days')
  FROM generate_series(1, 1600) gs
  CROSS JOIN LATERAL (
    SELECT v.id, v.name, v.variant_key, v.credit_cost,
           s.credit_feature_key AS tx_type, s.name AS grp_name
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
    WHERE s.category IN ('unlock', 'feature')
      AND v.is_active AND v.credit_cost IS NOT NULL AND s.credit_feature_key IS NOT NULL
    ORDER BY random()
    LIMIT 1
  ) f;

  -- ── Vài dòng admin tặng + nạp lẻ (đa dạng bảng chi tiết) ────────────────────
  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  SELECT v_users[1 + floor(random() * array_length(v_users, 1))::int],
         'admin_grant', 'Admin tặng credit khuyến mãi [demo]',
         (ARRAY[50, 100, 200])[1 + floor(random() * 3)::int],
         now() - (random() * interval '300 days')
  FROM generate_series(1, 12);

  -- ── Đơn hàng dịch vụ trực tiếp (Quảng cáo) cho báo cáo Doanh thu ────────────
  SELECT array_agg(id) INTO v_customers FROM public.customers;
  SELECT id INTO v_ad_service FROM public.services WHERE kind = 'direct' AND category = 'advertising' LIMIT 1;

  IF v_customers IS NULL OR array_length(v_customers, 1) IS NULL OR v_ad_service IS NULL THEN
    RAISE NOTICE 'Không có customers/dịch vụ Quảng cáo — bỏ qua seed đơn hàng.';
    RETURN;
  END IF;

  DELETE FROM public.orders WHERE note = '[demo]';

  INSERT INTO public.orders
    (customer_id, service_id, quantity, amount, fulfillment_status, ordered_at, note)
  SELECT
    v_customers[1 + floor(random() * array_length(v_customers, 1))::int],
    v_ad_service, 1,
    (ARRAY[2000000, 3000000, 5000000, 8000000, 12000000, 20000000])[1 + floor(random() * 6)::int],
    (ARRAY['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled', 'pending', 'cancelled'])[1 + floor(random() * 6)::int]::text,
    now() - (power(random(), 1.3) * interval '365 days'),
    '[demo]'
  FROM generate_series(1, 70);

  RAISE NOTICE 'Seed doanh thu demo xong.';
END $$;

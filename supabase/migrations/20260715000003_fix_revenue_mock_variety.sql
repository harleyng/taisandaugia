-- Fix: bản seed 20260715000002 dùng CROSS JOIN LATERAL ... ORDER BY random() LIMIT 1
-- bị Postgres đánh giá MỘT LẦN (không tương quan với generate_series) → mọi dòng
-- purchase/consumption trúng CÙNG một biến thể. Làm lại bằng array-indexing (random
-- theo TỪNG dòng) để đa dạng gói + tính năng. Chỉ động vào credit_transactions [demo]
-- (đơn hàng orders [demo] đã đúng, giữ nguyên).

DO $$
DECLARE
  v_users     uuid[];
  pkg_ids     uuid[]; pkg_names text[]; pkg_credits int[]; pkg_keys text[];
  feat_ids    uuid[]; feat_names text[]; feat_keys text[]; feat_costs int[]; feat_types text[]; feat_grp text[];
  n_pkg int; n_feat int;
BEGIN
  SELECT array_agg(id) INTO v_users FROM public.profiles;
  IF v_users IS NULL OR array_length(v_users, 1) IS NULL THEN
    RAISE NOTICE 'Không có profiles — bỏ qua.';
    RETURN;
  END IF;

  -- Gói (package) → mảng song song
  SELECT array_agg(v.id), array_agg(v.name), array_agg(v.credits), array_agg(v.variant_key)
    INTO pkg_ids, pkg_names, pkg_credits, pkg_keys
  FROM public.service_variants v
  JOIN public.services s ON s.id = v.service_id
  WHERE s.category = 'package' AND v.is_active AND v.credits IS NOT NULL;
  n_pkg := array_length(pkg_ids, 1);

  -- Tính năng (unlock/feature) → mảng song song (tx type = credit_feature_key của nhóm)
  SELECT array_agg(v.id), array_agg(v.name), array_agg(v.variant_key), array_agg(v.credit_cost),
         array_agg(s.credit_feature_key), array_agg(s.name)
    INTO feat_ids, feat_names, feat_keys, feat_costs, feat_types, feat_grp
  FROM public.service_variants v
  JOIN public.services s ON s.id = v.service_id
  WHERE s.category IN ('unlock', 'feature') AND v.is_active
    AND v.credit_cost IS NOT NULL AND s.credit_feature_key IS NOT NULL;
  n_feat := array_length(feat_ids, 1);

  DELETE FROM public.credit_transactions WHERE description LIKE '%[demo]%';

  -- ── Nạp gói: 500 dòng, gói ngẫu nhiên theo từng dòng ──────────────────────
  INSERT INTO public.credit_transactions
    (user_id, type, description, credit_delta, service_variant_id, variant_key, created_at)
  SELECT
    v_users[1 + floor(random() * array_length(v_users, 1))::int],
    'purchase',
    'Mua gói ' || pkg_names[idx] || ' [demo]',
    pkg_credits[idx],
    pkg_ids[idx],
    pkg_keys[idx],
    now() - (power(random(), 1.5) * interval '365 days')
  FROM (SELECT 1 + floor(random() * n_pkg)::int AS idx FROM generate_series(1, 500)) t;

  -- ── Tiêu dùng: 1600 dòng, tính năng ngẫu nhiên theo từng dòng ─────────────
  INSERT INTO public.credit_transactions
    (user_id, type, description, credit_delta, service_variant_id, variant_key, created_at)
  SELECT
    v_users[1 + floor(random() * array_length(v_users, 1))::int],
    feat_types[idx],
    feat_grp[idx] || ' — ' || feat_names[idx] || ' [demo]',
    -feat_costs[idx],
    feat_ids[idx],
    feat_keys[idx],
    now() - (power(random(), 1.2) * interval '365 days')
  FROM (SELECT 1 + floor(random() * n_feat)::int AS idx FROM generate_series(1, 1600)) t;

  -- ── Admin tặng + nạp lẻ ───────────────────────────────────────────────────
  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, created_at)
  SELECT v_users[1 + floor(random() * array_length(v_users, 1))::int],
         'admin_grant', 'Admin tặng credit khuyến mãi [demo]',
         (ARRAY[50, 100, 200])[1 + floor(random() * 3)::int],
         now() - (random() * interval '300 days')
  FROM generate_series(1, 12);

  RAISE NOTICE 'Fix seed variety xong: % gói, % tính năng.', n_pkg, n_feat;
END $$;

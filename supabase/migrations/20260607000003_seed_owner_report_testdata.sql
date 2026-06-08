-- Seed test data for secsosoo@gmail.com — Owner Report
-- 20 listings across 3 provinces, 3 asset types, 3 auction orgs
-- Covers all report chart scenarios: Đã thành, Chờ đấu, Không thành, Tồn đọng
-- Price sessions span 6 months (Jan–Jun 2026) for trend chart
-- Idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE

DO $$
DECLARE
  v_uid          UUID;
  v_org_kyc_id   UUID;
  v_ws_id        UUID;
  v_aorg1        UUID := 'd9572b14-c8e5-4d35-8f2f-3c1f6ab6706b'; -- Cty ĐG Hợp danh VN
  v_aorg2        UUID;
  v_aorg3        UUID;

  -- Listing IDs (deterministic so re-runs are idempotent)
  l1  UUID := 'b1000001-0000-0000-0000-000000000001';
  l2  UUID := 'b1000001-0000-0000-0000-000000000002';
  l3  UUID := 'b1000001-0000-0000-0000-000000000003';
  l4  UUID := 'b1000001-0000-0000-0000-000000000004';
  l5  UUID := 'b1000001-0000-0000-0000-000000000005';
  l6  UUID := 'b1000001-0000-0000-0000-000000000006';
  l7  UUID := 'b1000001-0000-0000-0000-000000000007';
  l8  UUID := 'b1000001-0000-0000-0000-000000000008';
  l9  UUID := 'b1000001-0000-0000-0000-000000000009';
  l10 UUID := 'b1000001-0000-0000-0000-000000000010';
  l11 UUID := 'b1000001-0000-0000-0000-000000000011';
  l12 UUID := 'b1000001-0000-0000-0000-000000000012';
  l13 UUID := 'b1000001-0000-0000-0000-000000000013';
  l14 UUID := 'b1000001-0000-0000-0000-000000000014';
  l15 UUID := 'b1000001-0000-0000-0000-000000000015';
  l16 UUID := 'b1000001-0000-0000-0000-000000000016';
  l17 UUID := 'b1000001-0000-0000-0000-000000000017';
  l18 UUID := 'b1000001-0000-0000-0000-000000000018';
  l19 UUID := 'b1000001-0000-0000-0000-000000000019';
  l20 UUID := 'b1000001-0000-0000-0000-000000000020';
BEGIN

  -- ── 1. Get user ────────────────────────────────────────────────────────────
  SELECT id INTO v_uid FROM auth.users WHERE email = 'secsosoo@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'User secsosoo@gmail.com not found — skipping seed.';
    RETURN;
  END IF;

  -- ── 2. Auction orgs — pick 2 more beyond the known one ─────────────────────
  SELECT id INTO v_aorg2
    FROM auction_organizations WHERE id != v_aorg1 ORDER BY name LIMIT 1;
  SELECT id INTO v_aorg3
    FROM auction_organizations WHERE id NOT IN (v_aorg1, COALESCE(v_aorg2, v_aorg1))
    ORDER BY name LIMIT 1;
  -- Fall back to org1 if fewer than 3 exist
  IF v_aorg2 IS NULL THEN v_aorg2 := v_aorg1; END IF;
  IF v_aorg3 IS NULL THEN v_aorg3 := v_aorg1; END IF;

  -- ── 3. Org KYC (approved) ───────────────────────────────────────────────────
  INSERT INTO asset_owner_org_kyc (
    created_by, status, org_type, org_name, tax_code, official_email,
    rep_full_name, rep_title, submitted_at, reviewed_at
  ) VALUES (
    v_uid, 'approved', 'enforcement',
    'Công ty TNHH Secsosoo', '0312345678', 'contact@secsosoo.vn',
    'Nguyễn Văn Test', 'Giám đốc',
    NOW() - INTERVAL '15 days', NOW() - INTERVAL '7 days'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_org_kyc_id;

  IF v_org_kyc_id IS NULL THEN
    SELECT id INTO v_org_kyc_id FROM asset_owner_org_kyc WHERE created_by = v_uid LIMIT 1;
  END IF;

  -- ── 4. Workspace ────────────────────────────────────────────────────────────
  INSERT INTO asset_owner_workspaces (
    org_kyc_id, owner_user_id, primary_name,
    abbreviations, branch_names, last_matched_at, total_claimed
  ) VALUES (
    v_org_kyc_id, v_uid, 'Công ty TNHH Secsosoo',
    ARRAY['Secsosoo','TNHH SS'],
    ARRAY['Chi nhánh Hà Nội','Chi nhánh TP.HCM'],
    NOW(), 20
  )
  ON CONFLICT (org_kyc_id) DO UPDATE SET last_matched_at = NOW(), total_claimed = 20
  RETURNING id INTO v_ws_id;

  IF v_ws_id IS NULL THEN
    SELECT id INTO v_ws_id FROM asset_owner_workspaces WHERE owner_user_id = v_uid LIMIT 1;
  END IF;

  -- ── 5. Credits ─────────────────────────────────────────────────────────────
  INSERT INTO user_credits (user_id, balance)
  VALUES (v_uid, 500)
  ON CONFLICT (user_id) DO UPDATE SET balance = GREATEST(user_credits.balance, 500);

  -- ── 6. Listings ─────────────────────────────────────────────────────────────
  -- Group A: Đã thành (6) — status=SOLD_RENTED, win_price in custom_attributes
  INSERT INTO listings (id, title, price, price_unit, status, area, purpose,
    property_type_slug, address, auction_org_id, custom_attributes) VALUES

  (l1, 'Nhà phố Hoàn Kiếm, Hà Nội — 5 tầng',
    5200000000, 'TOTAL', 'SOLD_RENTED', 72, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Hoàn Kiếm"}', v_aorg1,
    '{"auction_time":"2026-04-10T09:00:00Z","win_price":6100000000}'::jsonb),

  (l2, 'Chung cư Bình Thạnh, TP. Hồ Chí Minh',
    3800000000, 'TOTAL', 'SOLD_RENTED', 88, 'FOR_SALE', 'bat-dong-san',
    '{"province":"TP. Hồ Chí Minh","district":"Bình Thạnh"}', v_aorg2,
    '{"auction_time":"2026-04-20T09:00:00Z","win_price":4050000000}'::jsonb),

  (l3, 'Đất nền Đống Đa, Hà Nội — 120m²',
    8500000000, 'TOTAL', 'SOLD_RENTED', 120, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Đống Đa"}', v_aorg1,
    '{"auction_time":"2026-03-15T09:00:00Z","win_price":9200000000}'::jsonb),

  (l4, 'Ô tô Toyota Camry 2020 — Hà Nội',
    850000000, 'TOTAL', 'SOLD_RENTED', 0, 'FOR_SALE', 'xe-co',
    '{"province":"Hà Nội","district":"Cầu Giấy"}', v_aorg3,
    '{"auction_time":"2026-05-05T09:00:00Z","win_price":920000000}'::jsonb),

  (l5, 'Nhà phố Sơn Trà, Đà Nẵng — mặt tiển biển',
    2900000000, 'TOTAL', 'SOLD_RENTED', 95, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Đà Nẵng","district":"Sơn Trà"}', v_aorg2,
    '{"auction_time":"2026-05-01T09:00:00Z","win_price":3150000000}'::jsonb),

  (l6, 'Dây chuyền sản xuất nhựa — TP. Hồ Chí Minh',
    1500000000, 'TOTAL', 'SOLD_RENTED', 0, 'FOR_SALE', 'may-moc',
    '{"province":"TP. Hồ Chí Minh","district":"Bình Dương"}', v_aorg1,
    '{"auction_time":"2026-03-20T09:00:00Z","win_price":1620000000}'::jsonb)

  ON CONFLICT (id) DO NOTHING;

  -- Group B: Chờ đấu (6) — upcoming auction, some with urgent registration deadline
  INSERT INTO listings (id, title, price, price_unit, status, area, purpose,
    property_type_slug, address, auction_org_id, custom_attributes) VALUES

  (l7, 'Biệt thự Tây Hồ, Hà Nội — đất 350m²',
    45000000000, 'TOTAL', 'ACTIVE', 350, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Tây Hồ"}', v_aorg1,
    '{"auction_time":"2026-06-20T09:00:00Z","registration_deadline":"2026-06-10T17:00:00Z"}'::jsonb),

  (l8, 'Căn hộ Quận 7, TP. Hồ Chí Minh — 95m²',
    6200000000, 'TOTAL', 'ACTIVE', 95, 'FOR_SALE', 'bat-dong-san',
    '{"province":"TP. Hồ Chí Minh","district":"Quận 7"}', v_aorg2,
    '{"auction_time":"2026-06-22T09:00:00Z","registration_deadline":"2026-06-09T17:00:00Z"}'::jsonb),

  (l9, 'Xe tải Hyundai 8 tấn 2021 — Hà Nội',
    680000000, 'TOTAL', 'ACTIVE', 0, 'FOR_SALE', 'xe-co',
    '{"province":"Hà Nội","district":"Đông Anh"}', v_aorg3,
    '{"auction_time":"2026-06-25T09:00:00Z","registration_deadline":"2026-06-15T17:00:00Z"}'::jsonb),

  (l10, 'Đất thương mại Hải Châu, Đà Nẵng',
    3100000000, 'TOTAL', 'ACTIVE', 180, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Đà Nẵng","district":"Hải Châu"}', v_aorg2,
    '{"auction_time":"2026-06-30T09:00:00Z","registration_deadline":"2026-06-20T17:00:00Z"}'::jsonb),

  (l11, 'Nhà xưởng Hoài Đức, Hà Nội — 800m²',
    7800000000, 'TOTAL', 'ACTIVE', 800, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Hoài Đức"}', v_aorg1,
    '{"auction_time":"2026-07-05T09:00:00Z","registration_deadline":"2026-06-25T17:00:00Z"}'::jsonb),

  (l12, 'Chung cư Tân Phú, TP. Hồ Chí Minh — 72m²',
    2400000000, 'TOTAL', 'ACTIVE', 72, 'FOR_SALE', 'bat-dong-san',
    '{"province":"TP. Hồ Chí Minh","district":"Tân Phú"}', v_aorg3,
    '{"auction_time":"2026-07-10T09:00:00Z","registration_deadline":"2026-06-30T17:00:00Z"}'::jsonb)

  ON CONFLICT (id) DO NOTHING;

  -- Group C: Không thành (4) — ended, 1 price session each
  INSERT INTO listings (id, title, price, price_unit, status, area, purpose,
    property_type_slug, address, auction_org_id, custom_attributes) VALUES

  (l13, 'Đất ở Nam Từ Liêm, Hà Nội — 90m²',
    9500000000, 'TOTAL', 'ACTIVE', 90, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Nam Từ Liêm"}', v_aorg1,
    '{"auction_time":"2026-05-10T09:00:00Z"}'::jsonb),

  (l14, 'Shophouse Thủ Đức, TP. Hồ Chí Minh',
    2800000000, 'TOTAL', 'ACTIVE', 110, 'FOR_SALE', 'bat-dong-san',
    '{"province":"TP. Hồ Chí Minh","district":"Thủ Đức"}', v_aorg2,
    '{"auction_time":"2026-05-15T09:00:00Z"}'::jsonb),

  (l15, 'Xe máy Honda Winner X 2022 — TP.HCM',
    42000000, 'TOTAL', 'ACTIVE', 0, 'FOR_SALE', 'xe-co',
    '{"province":"TP. Hồ Chí Minh","district":"Gò Vấp"}', v_aorg3,
    '{"auction_time":"2026-05-20T09:00:00Z"}'::jsonb),

  (l16, 'Đất nông nghiệp Hòa Vang, Đà Nẵng',
    1900000000, 'TOTAL', 'ACTIVE', 500, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Đà Nẵng","district":"Hòa Vang"}', v_aorg1,
    '{"auction_time":"2026-05-25T09:00:00Z"}'::jsonb)

  ON CONFLICT (id) DO NOTHING;

  -- Group D: Tồn đọng (4) — ended, ≥2 price sessions → roundCount ≥ 2
  INSERT INTO listings (id, title, price, price_unit, status, area, purpose,
    property_type_slug, address, auction_org_id, custom_attributes) VALUES

  (l17, 'Biệt thự Hà Đông, Hà Nội — giá cao',
    12500000000, 'TOTAL', 'ACTIVE', 280, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Hà Đông"}', v_aorg1,
    '{"auction_time":"2026-06-03T09:00:00Z"}'::jsonb),

  (l18, 'Chung cư cao cấp Bình Dương, TP.HCM',
    4800000000, 'TOTAL', 'ACTIVE', 130, 'FOR_SALE', 'bat-dong-san',
    '{"province":"TP. Hồ Chí Minh","district":"Bình Dương"}', v_aorg2,
    '{"auction_time":"2026-06-01T09:00:00Z"}'::jsonb),

  (l19, 'Đất công nghiệp Sóc Sơn, Hà Nội — 1200m²',
    8000000000, 'TOTAL', 'ACTIVE', 1200, 'FOR_SALE', 'bat-dong-san',
    '{"province":"Hà Nội","district":"Sóc Sơn"}', v_aorg3,
    '{"auction_time":"2026-06-05T09:00:00Z"}'::jsonb),

  (l20, 'Máy xúc Komatsu PC200 2018 — TP.HCM',
    2300000000, 'TOTAL', 'ACTIVE', 0, 'FOR_SALE', 'may-moc',
    '{"province":"TP. Hồ Chí Minh","district":"Bình Chánh"}', v_aorg1,
    '{"auction_time":"2026-06-04T09:00:00Z"}'::jsonb)

  ON CONFLICT (id) DO NOTHING;

  -- ── 7. Claims — link all 20 listings to workspace ──────────────────────────
  INSERT INTO asset_owner_claims (workspace_id, listing_id, status, confidence_score, match_basis)
  VALUES
    (v_ws_id, l1,  'confirmed',           0.95, 'auto_name'),
    (v_ws_id, l2,  'confirmed',           0.92, 'auto_name'),
    (v_ws_id, l3,  'confirmed',           0.98, 'auto_name'),
    (v_ws_id, l4,  'confirmed',           0.88, 'manual_search'),
    (v_ws_id, l5,  'confirmed',           0.91, 'auto_name'),
    (v_ws_id, l6,  'confirmed',           0.85, 'manual_search'),
    (v_ws_id, l7,  'auto_claimed',        0.97, 'auto_name'),
    (v_ws_id, l8,  'auto_claimed',        0.93, 'auto_name'),
    (v_ws_id, l9,  'confirmed',           0.89, 'manual_search'),
    (v_ws_id, l10, 'auto_claimed',        0.94, 'auto_name'),
    (v_ws_id, l11, 'auto_claimed',        0.96, 'auto_name'),
    (v_ws_id, l12, 'pending_confirmation',0.78, 'auto_name'),
    (v_ws_id, l13, 'confirmed',           0.90, 'auto_name'),
    (v_ws_id, l14, 'confirmed',           0.87, 'auto_name'),
    (v_ws_id, l15, 'confirmed',           0.83, 'manual_search'),
    (v_ws_id, l16, 'confirmed',           0.86, 'auto_name'),
    (v_ws_id, l17, 'auto_claimed',        0.99, 'auto_name'),
    (v_ws_id, l18, 'auto_claimed',        0.96, 'auto_name'),
    (v_ws_id, l19, 'auto_claimed',        0.94, 'auto_name'),
    (v_ws_id, l20, 'confirmed',           0.88, 'manual_search')
  ON CONFLICT (workspace_id, listing_id) DO NOTHING;

  -- ── 8. Price sessions — for trend chart (Jan–Jun 2026) ────────────────────
  -- Group A "Đã thành": 1 session each (the auction date)
  INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district) VALUES
    (l1,  '2026-04-10', 5200000000, 'bat-dong-san', 'Hoàn Kiếm'),
    (l2,  '2026-04-20', 3800000000, 'bat-dong-san', 'Bình Thạnh'),
    (l3,  '2026-03-15', 8500000000, 'bat-dong-san', 'Đống Đa'),
    (l4,  '2026-05-05',  850000000, 'xe-co',        'Cầu Giấy'),
    (l5,  '2026-05-01', 2900000000, 'bat-dong-san', 'Sơn Trà'),
    (l6,  '2026-03-20', 1500000000, 'may-moc',      'Bình Dương')
  ON CONFLICT DO NOTHING;

  -- Group C "Không thành": 1 session each (the failed auction)
  INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district) VALUES
    (l13, '2026-05-10', 9500000000, 'bat-dong-san', 'Nam Từ Liêm'),
    (l14, '2026-05-15', 2800000000, 'bat-dong-san', 'Thủ Đức'),
    (l15, '2026-05-20',   42000000, 'xe-co',        'Gò Vấp'),
    (l16, '2026-05-25', 1900000000, 'bat-dong-san', 'Hòa Vang')
  ON CONFLICT DO NOTHING;

  -- Group D "Tồn đọng": multiple sessions — creates roundCount ≥ 2
  -- l17: 3 sessions (Jan, Mar, Jun)
  INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district) VALUES
    (l17, '2026-01-18', 12500000000, 'bat-dong-san', 'Hà Đông'),
    (l17, '2026-03-22', 12000000000, 'bat-dong-san', 'Hà Đông'),
    (l17, '2026-06-03', 11500000000, 'bat-dong-san', 'Hà Đông')
  ON CONFLICT DO NOTHING;

  -- l18: 4 sessions (Feb, Mar, May, Jun)
  INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district) VALUES
    (l18, '2026-02-12',  4800000000, 'bat-dong-san', 'Bình Dương'),
    (l18, '2026-03-28',  4600000000, 'bat-dong-san', 'Bình Dương'),
    (l18, '2026-05-22',  4500000000, 'bat-dong-san', 'Bình Dương'),
    (l18, '2026-06-01',  4300000000, 'bat-dong-san', 'Bình Dương')
  ON CONFLICT DO NOTHING;

  -- l19: 2 sessions (Apr, Jun)
  INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district) VALUES
    (l19, '2026-04-08',  8000000000, 'bat-dong-san', 'Sóc Sơn'),
    (l19, '2026-06-05',  7500000000, 'bat-dong-san', 'Sóc Sơn')
  ON CONFLICT DO NOTHING;

  -- l20: 3 sessions (Mar, May, Jun)
  INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district) VALUES
    (l20, '2026-03-10',  2300000000, 'may-moc', 'Bình Chánh'),
    (l20, '2026-05-08',  2100000000, 'may-moc', 'Bình Chánh'),
    (l20, '2026-06-04',  2000000000, 'may-moc', 'Bình Chánh')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed complete: user=%, workspace=%', v_uid, v_ws_id;
END;
$$;

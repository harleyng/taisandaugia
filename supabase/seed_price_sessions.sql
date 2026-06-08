-- Fix owner report test data for secsosoo@gmail.com
-- Run in Supabase SQL Editor
-- 1. Sets past auction_time on 4 ACTIVE listings + 3 sessions each → Tồn đọng
-- 2. Sets future auction_time on up to 6 ACTIVE listings → Upcoming sessions
-- 3. Adds 1 session each to SOLD_RENTED → trend data

DO $$
DECLARE
  v_uid   UUID;
  v_ws_id UUID;
  rec     RECORD;
  rn_act  INT := 0;
  rn_sold INT := 0;
  today   DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'secsosoo@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT id INTO v_ws_id FROM asset_owner_workspaces WHERE owner_user_id = v_uid LIMIT 1;
  IF v_ws_id IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;

  RAISE NOTICE 'workspace_id = %', v_ws_id;

  -- ── Wipe existing test sessions to avoid duplicates ────────────────────────
  DELETE FROM listing_price_sessions
  WHERE listing_id IN (
    SELECT listing_id FROM asset_owner_claims WHERE workspace_id = v_ws_id
  );

  -- ── ACTIVE listings ────────────────────────────────────────────────────────
  FOR rec IN
    SELECT l.id, l.price, l.property_type_slug,
           COALESCE(l.address->>'province', 'Hà Nội') AS province
    FROM asset_owner_claims c
    JOIN listings l ON l.id = c.listing_id
    WHERE c.workspace_id = v_ws_id
      AND c.status IN ('auto_claimed','pending_confirmation','confirmed')
      AND l.status = 'ACTIVE'
    ORDER BY l.created_at
    LIMIT 20
  LOOP
    rn_act := rn_act + 1;

    IF rn_act <= 4 THEN
      -- ── Tồn đọng: past auction_time + 3 price sessions ──────────────────
      UPDATE listings
      SET custom_attributes =
        jsonb_strip_nulls(COALESCE(custom_attributes,'{}')
          || jsonb_build_object(
              'auction_time', (today - 20)::text || 'T09:00:00+07:00',
              'registration_deadline', NULL
             ))
      WHERE id = rec.id;

      INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district)
      VALUES
        (rec.id, today - 150, rec.price,          rec.property_type_slug, rec.province),
        (rec.id, today - 80,  rec.price * 0.95,   rec.property_type_slug, rec.province),
        (rec.id, today - 20,  rec.price * 0.90,   rec.property_type_slug, rec.province);

    ELSIF rn_act <= 10 THEN
      -- ── Chờ đấu: future auction_time (real dates) ────────────────────────
      UPDATE listings
      SET custom_attributes =
        COALESCE(custom_attributes,'{}')
          || jsonb_build_object(
              'auction_time',
              (today + (rn_act * 5))::text || 'T09:00:00+07:00',
              'registration_deadline',
              (today + (rn_act * 5) - 5)::text || 'T17:00:00+07:00'
             )
      WHERE id = rec.id;

      -- 1 session for trend chart
      INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district)
      VALUES (rec.id, today - (rn_act * 8), rec.price, rec.property_type_slug, rec.province);

    ELSE
      -- ── Không thành: past auction_time + 1 session ───────────────────────
      UPDATE listings
      SET custom_attributes =
        COALESCE(custom_attributes,'{}')
          || jsonb_build_object(
              'auction_time',
              (today - (rn_act * 12))::text || 'T09:00:00+07:00'
             )
      WHERE id = rec.id;

      INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district)
      VALUES (rec.id, today - (rn_act * 12), rec.price, rec.property_type_slug, rec.province);
    END IF;

  END LOOP;

  -- ── SOLD_RENTED listings: 1 session each for trend chart ──────────────────
  FOR rec IN
    SELECT l.id, l.price, l.property_type_slug,
           COALESCE(l.address->>'province', 'Hà Nội') AS province
    FROM asset_owner_claims c
    JOIN listings l ON l.id = c.listing_id
    WHERE c.workspace_id = v_ws_id
      AND c.status IN ('auto_claimed','pending_confirmation','confirmed')
      AND l.status = 'SOLD_RENTED'
    ORDER BY l.created_at
    LIMIT 17
  LOOP
    rn_sold := rn_sold + 1;
    INSERT INTO listing_price_sessions (listing_id, session_date, price, property_type, district)
    VALUES (rec.id, today - (rn_sold * 10), rec.price, rec.property_type_slug, rec.province);
  END LOOP;

  RAISE NOTICE 'Done. rn_act=%, rn_sold=%', rn_act, rn_sold;
END;
$$;

-- ── Verify ─────────────────────────────────────────────────────────────────
SELECT
  l.status,
  l.custom_attributes->>'auction_time'               AS auction_time,
  (
    SELECT COUNT(*) FROM listing_price_sessions lps WHERE lps.listing_id = l.id
  )::int                                              AS session_count
FROM asset_owner_claims c
JOIN listings l ON l.id = c.listing_id
JOIN asset_owner_workspaces w ON w.id = c.workspace_id
JOIN auth.users u ON u.id = w.owner_user_id
WHERE u.email = 'secsosoo@gmail.com'
  AND c.status IN ('auto_claimed','pending_confirmation','confirmed')
ORDER BY l.status, session_count DESC
LIMIT 30;

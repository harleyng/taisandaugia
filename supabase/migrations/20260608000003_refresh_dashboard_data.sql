-- Refresh dashboard data for demo:
-- 1. Move some confirmed claims → pending_confirmation (those with confidence < 0.90)
-- 2. Update auction dates of upcoming listings to CURRENT_DATE + 1..5
--    (only for the seed listings that have future dates beyond 7 days)
-- Dynamic: works whenever applied.

DO $$
DECLARE
  v_ws_id UUID;

  -- Seed listing UUIDs (from 20260607000003)
  l7  UUID := 'b1000001-0000-0000-0000-000000000007';
  l8  UUID := 'b1000001-0000-0000-0000-000000000008';
  l9  UUID := 'b1000001-0000-0000-0000-000000000009';
  l10 UUID := 'b1000001-0000-0000-0000-000000000010';
  l11 UUID := 'b1000001-0000-0000-0000-000000000011';
BEGIN
  -- ── 1. Pending confirmation: downgrade low-confidence confirmed claims ──────
  SELECT id INTO v_ws_id
  FROM asset_owner_workspaces
  ORDER BY created_at
  LIMIT 1;

  IF v_ws_id IS NOT NULL THEN
    -- Change the lowest-confidence confirmed claims to pending_confirmation
    UPDATE asset_owner_claims
    SET status = 'pending_confirmation'
    WHERE workspace_id = v_ws_id
      AND status = 'confirmed'
      AND confidence_score < 0.90
      AND listing_id IN (
        SELECT listing_id FROM asset_owner_claims
        WHERE workspace_id = v_ws_id
          AND status = 'confirmed'
          AND confidence_score < 0.90
        ORDER BY confidence_score ASC
        LIMIT 5
      );

    RAISE NOTICE 'pending_confirmation count: %', (
      SELECT COUNT(*) FROM asset_owner_claims
      WHERE workspace_id = v_ws_id AND status = 'pending_confirmation'
    );
  END IF;

  -- ── 2. Auction dates → near future (seed listings only) ──────────────────
  -- Only update if those seed listings exist in the DB
  UPDATE listings
  SET custom_attributes = custom_attributes ||
    jsonb_build_object('auction_time', (CURRENT_DATE + INTERVAL '1 day')::text || 'T09:00:00Z')
  WHERE id = l7;

  UPDATE listings
  SET custom_attributes = custom_attributes ||
    jsonb_build_object('auction_time', (CURRENT_DATE + INTERVAL '2 days')::text || 'T09:00:00Z')
  WHERE id = l8;

  UPDATE listings
  SET custom_attributes = custom_attributes ||
    jsonb_build_object('auction_time', (CURRENT_DATE + INTERVAL '3 days')::text || 'T09:00:00Z')
  WHERE id = l9;

  UPDATE listings
  SET custom_attributes = custom_attributes ||
    jsonb_build_object('auction_time', (CURRENT_DATE + INTERVAL '4 days')::text || 'T09:00:00Z')
  WHERE id = l10;

  UPDATE listings
  SET custom_attributes = custom_attributes ||
    jsonb_build_object('auction_time', (CURRENT_DATE + INTERVAL '5 days')::text || 'T09:00:00Z')
  WHERE id = l11;

  RAISE NOTICE 'Updated % seed listing auction dates', (
    SELECT COUNT(*) FROM listings WHERE id IN (l7, l8, l9, l10, l11)
  );
END $$;

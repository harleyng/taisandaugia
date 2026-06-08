-- Update some low-confidence confirmed claims → pending_confirmation
-- so the "Tài sản chờ xác nhận" dashboard block has test data.
-- Only affects the seed workspace (secsosoo@gmail.com test data).
-- Listings l4(0.88), l6(0.85), l9(0.89), l14(0.87), l15(0.83), l16(0.86)
-- These were confirmed but confidence < 0.90 → realistic candidates for review.

DO $$
DECLARE
  v_ws_id UUID;
  l4  UUID := 'b1000001-0000-0000-0000-000000000004';
  l6  UUID := 'b1000001-0000-0000-0000-000000000006';
  l9  UUID := 'b1000001-0000-0000-0000-000000000009';
  l14 UUID := 'b1000001-0000-0000-0000-000000000014';
  l15 UUID := 'b1000001-0000-0000-0000-000000000015';
BEGIN
  -- Look up the seed workspace
  SELECT id INTO v_ws_id
  FROM asset_owner_workspaces
  WHERE id = (
    SELECT id FROM asset_owner_workspaces
    ORDER BY created_at
    LIMIT 1
  );

  IF v_ws_id IS NULL THEN
    RAISE NOTICE 'No workspace found — skipping pending_confirmation seed';
    RETURN;
  END IF;

  -- Downgrade these confirmed claims to pending_confirmation
  UPDATE asset_owner_claims
  SET status = 'pending_confirmation'
  WHERE workspace_id = v_ws_id
    AND listing_id IN (l4, l6, l9, l14, l15)
    AND status = 'confirmed';

  RAISE NOTICE 'Updated % claims to pending_confirmation', (
    SELECT COUNT(*) FROM asset_owner_claims
    WHERE workspace_id = v_ws_id
      AND listing_id IN (l4, l6, l9, l14, l15)
      AND status = 'pending_confirmation'
  );
END $$;

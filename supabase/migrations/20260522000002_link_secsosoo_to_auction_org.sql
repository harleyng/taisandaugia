-- Link secsosoo@gmail.com to Công ty Đấu giá Hợp danh Việt Nam
-- Creates an approved organizations row so the portal and auction history work correctly.

DO $$
DECLARE
  v_user_id uuid;
  v_auction_org_id uuid := 'd9572b14-c8e5-4d35-8f2f-3c1f6ab6706b';
  v_org_name text := 'Công ty Đấu giá Hợp danh Việt Nam';
BEGIN
  -- Get the user ID from auth.users by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'secsosoo@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User secsosoo@gmail.com not found — skipping.';
    RETURN;
  END IF;

  -- Update existing row if present, otherwise insert
  IF EXISTS (SELECT 1 FROM organizations WHERE owner_id = v_user_id) THEN
    UPDATE organizations
    SET name        = v_org_name,
        kyc_status  = 'APPROVED',
        license_info = jsonb_build_object('auction_org_id', v_auction_org_id::text),
        updated_at  = now()
    WHERE owner_id = v_user_id;
  ELSE
    INSERT INTO organizations (name, owner_id, kyc_status, license_info)
    VALUES (
      v_org_name,
      v_user_id,
      'APPROVED',
      jsonb_build_object('auction_org_id', v_auction_org_id::text)
    );
  END IF;

  RAISE NOTICE 'Linked user % to auction org %', v_user_id, v_auction_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_listing_save_counts(listing_ids uuid[])
RETURNS TABLE(listing_id uuid, save_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ua.listing_id, COUNT(*) as save_count
  FROM user_asset_actions ua
  WHERE ua.listing_id = ANY(listing_ids) AND ua.is_saved = true
  GROUP BY ua.listing_id
$$;
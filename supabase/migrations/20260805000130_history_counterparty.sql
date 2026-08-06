-- Bộ lọc của tab "Lịch sử đấu giá" nay nằm ở đầu tab và chi phối CẢ biểu đồ lẫn
-- bảng (giống báo cáo Tin đấu giá). Client tự gộp lại từ mảng `history`, nên mỗi
-- dòng phải mang luôn đối tác — nếu không, biểu đồ "đối tác" sẽ trơ ra khi lọc
-- trong khi mọi biểu đồ khác đã đổi.

CREATE OR REPLACE FUNCTION public.admin_prospect_detail(p_kind TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name    TEXT;
  v_addr    TEXT;
  v_aliases TEXT[];
  v_result  JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  IF p_kind = 'asset_owner' THEN
    SELECT o.name, o.address, o.aliases INTO v_name, v_addr, v_aliases
    FROM public.asset_owners o WHERE o.id = p_id;
  ELSE
    SELECT a.name, a.address, '{}'::TEXT[] INTO v_name, v_addr, v_aliases
    FROM public.auction_organizations a WHERE a.id = p_id;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  WITH lrows AS (
    SELECT
      l.id AS listing_id, l.title, l.price, l.created_at,
      NULLIF(btrim(COALESCE(l.address->>'province', '')), '')  AS province,
      NULLIF(btrim(COALESCE(l.property_type_slug, '')), '')    AS slug,
      (SELECT pt.name FROM public.property_types pt WHERE pt.slug = l.property_type_slug) AS type_name,
      NULLIF(btrim(COALESCE(l.legal_status, '')), '')          AS legal_status,
      public.listing_auction_bucket(
        l.status::TEXT, COALESCE(l.custom_attributes, '{}'::JSONB),
        (SELECT count(*)::INT FROM public.listing_price_sessions s WHERE s.listing_id = l.id)
      ) AS bucket,
      (SELECT count(*)::INT FROM public.listing_price_sessions s WHERE s.listing_id = l.id) AS round_count,
      COALESCE(
        (l.custom_attributes->>'winning_price')::NUMERIC,
        (l.custom_attributes->>'win_price')::NUMERIC
      ) AS win_price,
      COALESCE(l.custom_attributes->>'auction_date', l.custom_attributes->>'auction_time') AS auction_at,
      CASE WHEN p_kind = 'asset_owner' THEN l.auction_org_id ELSE l.asset_owner_id END AS cp_id,
      CASE WHEN p_kind = 'asset_owner'
           THEN (SELECT a.name FROM public.auction_organizations a WHERE a.id = l.auction_org_id)
           ELSE (SELECT o.name FROM public.asset_owners o          WHERE o.id = l.asset_owner_id)
      END AS cp_name
    FROM public.listings l
    WHERE (p_kind = 'asset_owner' AND l.asset_owner_id = p_id)
       OR (p_kind = 'auction_org' AND l.auction_org_id  = p_id)
  ),
  posts AS (
    SELECT ap.* FROM public.asset_postings ap
    WHERE (p_kind = 'auction_org' AND ap.chosen_org_id = p_id)
       OR (p_kind = 'asset_owner' AND ap.user_id IN (
             SELECT w.owner_user_id FROM public.asset_owner_workspaces w
             JOIN public.asset_owner_claims c ON c.workspace_id = w.id
             WHERE c.asset_owner_id = p_id AND c.status IN ('auto_claimed','confirmed')))
  ),
  d_history AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', listing_id, 'title', title, 'price', price, 'province', province,
             'asset_type', COALESCE(type_name, slug), 'legal_status', legal_status,
             'bucket', bucket, 'round_count', round_count, 'win_price', win_price,
             'auction_at', auction_at, 'created_at', created_at,
             'counterparty_id', cp_id, 'counterparty', cp_name
           ) ORDER BY COALESCE(auction_at, created_at::TEXT) DESC) AS j
    FROM (SELECT * FROM lrows ORDER BY COALESCE(auction_at, created_at::TEXT) DESC LIMIT 500) t
  ),
  d_branch AS (
    SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'listing_count',
             (SELECT count(*) FROM public.listings l2 WHERE l2.asset_owner_id = o.id)
           ) ORDER BY o.name) AS j
    FROM public.asset_owners o
    WHERE p_kind = 'asset_owner' AND o.parent_owner_id = p_id
  )
  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p_id, 'kind', p_kind, 'name', v_name,
      'address', v_addr, 'aliases', to_jsonb(v_aliases)
    ),
    -- Mọi con số theo từng tin nay do CLIENT gộp lại từ `history` (để bộ lọc chi
    -- phối được), nên RPC chỉ còn giữ phần không suy ra được từ danh sách tin.
    'postings_count', (SELECT count(*) FROM posts),
    'legal_flags', (
      SELECT jsonb_build_object(
        'total',        count(*),
        'has_dispute',  count(*) FILTER (WHERE has_dispute),
        'has_mortgage', count(*) FILTER (WHERE has_mortgage),
        'is_seized',    count(*) FILTER (WHERE is_seized),
        'clean',        count(*) FILTER (WHERE NOT COALESCE(has_dispute, false)
                                           AND NOT COALESCE(has_mortgage, false)
                                           AND NOT COALESCE(is_seized, false))
      ) FROM posts
    ),
    'branches', COALESCE((SELECT j FROM d_branch),  '[]'::JSONB),
    'history',  COALESCE((SELECT j FROM d_history), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_prospect_detail(TEXT, UUID) TO authenticated;

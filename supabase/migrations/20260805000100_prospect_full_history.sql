-- Trang chi tiết lead nay có tab "Lịch sử đấu giá" → cần TOÀN BỘ tài sản, không
-- phải 20 dòng gần nhất. Đổi khoá 'recent' thành 'history' (chặn trên 500 dòng
-- để một pháp nhân bất thường không kéo sập payload).

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
  tot AS (SELECT count(*)::BIGINT AS n, COALESCE(sum(price), 0) AS sum_price FROM lrows),
  posts AS (
    SELECT ap.* FROM public.asset_postings ap
    WHERE (p_kind = 'auction_org' AND ap.chosen_org_id = p_id)
       OR (p_kind = 'asset_owner' AND ap.user_id IN (
             SELECT w.owner_user_id FROM public.asset_owner_workspaces w
             JOIN public.asset_owner_claims c ON c.workspace_id = w.id
             WHERE c.asset_owner_id = p_id AND c.status IN ('auto_claimed','confirmed')))
  ),
  d_prov AS (
    SELECT jsonb_agg(jsonb_build_object('label', label, 'count', n, 'value', v, 'pct', pct)
             ORDER BY n DESC, label) AS j
    FROM (
      SELECT COALESCE(province, 'Không xác định') AS label, count(*) AS n,
             COALESCE(sum(price), 0) AS v,
             round(count(*) * 100.0 / NULLIF((SELECT n FROM tot), 0)) AS pct
      FROM lrows GROUP BY 1
    ) t
  ),
  d_type AS (
    SELECT jsonb_agg(jsonb_build_object('label', label, 'count', n, 'value', v, 'pct', pct)
             ORDER BY n DESC, label) AS j
    FROM (
      SELECT COALESCE(type_name, slug, 'Không xác định') AS label, count(*) AS n,
             COALESCE(sum(price), 0) AS v,
             round(count(*) * 100.0 / NULLIF((SELECT n FROM tot), 0)) AS pct
      FROM lrows GROUP BY 1
    ) t
  ),
  d_legal AS (
    SELECT jsonb_agg(jsonb_build_object('label', label, 'count', n, 'value', v, 'pct', pct)
             ORDER BY n DESC, label) AS j
    FROM (
      SELECT COALESCE(legal_status, 'Không xác định') AS label, count(*) AS n,
             COALESCE(sum(price), 0) AS v,
             round(count(*) * 100.0 / NULLIF((SELECT n FROM tot), 0)) AS pct
      FROM lrows GROUP BY 1
    ) t
  ),
  d_status AS (
    SELECT jsonb_agg(jsonb_build_object('label', label, 'count', n, 'value', v, 'pct', pct)
             ORDER BY n DESC, label) AS j
    FROM (
      SELECT bucket AS label, count(*) AS n,
             COALESCE(sum(price), 0) AS v,
             round(count(*) * 100.0 / NULLIF((SELECT n FROM tot), 0)) AS pct
      FROM lrows GROUP BY 1
    ) t
  ),
  d_cp AS (
    SELECT jsonb_agg(jsonb_build_object('id', cp_id, 'label', label, 'count', n, 'value', v, 'pct', pct)
             ORDER BY n DESC, label) AS j
    FROM (
      SELECT cp_id, COALESCE(cp_name, 'Chưa xác định') AS label, count(*) AS n,
             COALESCE(sum(price), 0) AS v,
             round(count(*) * 100.0 / NULLIF((SELECT n FROM tot), 0)) AS pct
      FROM lrows GROUP BY cp_id, cp_name
    ) t
  ),
  d_month AS (
    SELECT jsonb_agg(jsonb_build_object('month', m, 'count', n, 'value', v) ORDER BY m) AS j
    FROM (
      SELECT to_char(created_at, 'YYYY-MM') AS m, count(*) AS n, COALESCE(sum(price), 0) AS v
      FROM lrows WHERE created_at IS NOT NULL GROUP BY 1
    ) t
  ),
  -- Lịch sử đầy đủ (không còn cắt 20 dòng). Ưu tiên ngày phiên đấu giá, thiếu
  -- thì rơi về ngày đưa tin lên sàn.
  d_history AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', listing_id, 'title', title, 'price', price, 'province', province,
             'asset_type', COALESCE(type_name, slug), 'legal_status', legal_status,
             'bucket', bucket, 'round_count', round_count, 'win_price', win_price,
             'auction_at', auction_at, 'created_at', created_at
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
    'totals', jsonb_build_object(
      'listings',           (SELECT n FROM tot),
      'starting_price_sum', (SELECT sum_price FROM tot),
      'avg_price',          COALESCE((SELECT round(avg(price)) FROM lrows), 0),
      'provinces',          (SELECT count(DISTINCT province) FROM lrows WHERE province IS NOT NULL),
      'asset_types',        (SELECT count(DISTINCT slug) FROM lrows WHERE slug IS NOT NULL),
      'postings',           (SELECT count(*) FROM posts),
      'won',                (SELECT count(*) FROM lrows WHERE bucket = 'Đã thành'),
      'stuck',              (SELECT count(*) FROM lrows WHERE bucket = 'Tồn đọng')
    ),
    'by_province',     COALESCE((SELECT j FROM d_prov),   '[]'::JSONB),
    'by_asset_type',   COALESCE((SELECT j FROM d_type),   '[]'::JSONB),
    'by_legal',        COALESCE((SELECT j FROM d_legal),  '[]'::JSONB),
    'by_status',       COALESCE((SELECT j FROM d_status), '[]'::JSONB),
    'by_counterparty', COALESCE((SELECT j FROM d_cp),     '[]'::JSONB),
    'by_month',        COALESCE((SELECT j FROM d_month),  '[]'::JSONB),
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

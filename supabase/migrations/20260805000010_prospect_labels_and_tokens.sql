-- 1. org_significant_tokens: 'tai' và 'thuoc' KHÔNG phải từ chỉ hình thức pháp nhân
--    ("tài sản", "thuốc" là từ có nghĩa). Bỏ chúng khiến "Quản lý tài sản" mất token "tai".
--
-- 2. property_type_slug của listings dùng bảng public.property_types
--    (biet-thu, kho-xuong, nha-rieng, van-phong…), KHÔNG phải ASSET_CATEGORIES
--    (dat-o, nha-xuong, shophouse…) như asset_postings. Trả về tên hiển thị ngay
--    trong RPC để client không phải query bảng tham chiếu lần nữa.

CREATE OR REPLACE FUNCTION public.org_significant_tokens(p_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH stripped AS (
    SELECT btrim(regexp_replace(
      regexp_replace(
        ' ' || COALESCE(public.normalize_org_name(p_name), '') || ' ',
        '(?<= )(cong ty|ngan hang|chi nhanh|phong giao dich|so giao dich|tap doan|tong cong ty|mot thanh vien|co phan|trach nhiem huu han|viet nam)(?= )',
        '', 'g'
      ),
      '\s+', ' ', 'g'
    )) AS s
  )
  SELECT COALESCE(
    ARRAY(
      SELECT t
      FROM unnest(string_to_array((SELECT s FROM stripped), ' ')) AS t
      WHERE t <> ''
        AND t NOT IN ('tnhh','mtv','cp','tmcp','cn','ct','hd','tv','va','cac')
        AND length(t) > 1
    ),
    '{}'::TEXT[]
  );
$$;

-- Generated column STORED không tự tính lại khi thay hàm → dựng lại cột.
DROP INDEX IF EXISTS public.idx_asset_owners_tokens;
ALTER TABLE public.asset_owners DROP COLUMN IF EXISTS name_tokens;
ALTER TABLE public.asset_owners
  ADD COLUMN name_tokens TEXT[]
    GENERATED ALWAYS AS (public.org_significant_tokens(name)) STORED;
CREATE INDEX idx_asset_owners_tokens ON public.asset_owners USING GIN(name_tokens);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_prospects(
  p_kind     TEXT DEFAULT 'asset_owner',
  p_search   TEXT DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 200,
  p_offset   INT  DEFAULT 0
)
RETURNS TABLE (
  id                   UUID,
  kind                 TEXT,
  name                 TEXT,
  address              TEXT,
  aliases              TEXT[],
  total_listings       BIGINT,
  total_starting_price NUMERIC,
  province_count       BIGINT,
  top_province         TEXT,
  top_asset_type       TEXT,
  posting_count        BIGINT,
  first_seen_at        TIMESTAMPTZ,
  last_seen_at         TIMESTAMPTZ,
  onboard_status       TEXT,
  workspace_id         UUID,
  lead_id              UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT o.id AS base_id, 'asset_owner'::TEXT AS base_kind, o.name AS base_name,
           o.address AS base_address, o.aliases AS base_aliases, o.normalized_name AS base_norm
    FROM public.asset_owners o
    WHERE p_kind = 'asset_owner'
    UNION ALL
    SELECT a.id, 'auction_org'::TEXT, a.name,
           a.address, '{}'::TEXT[], public.normalize_org_name(a.name)
    FROM public.auction_organizations a
    WHERE p_kind = 'auction_org'
  ),
  ls AS (
    SELECT b.base_id, l.price, l.created_at,
           NULLIF(btrim(COALESCE(l.address->>'province', '')), '') AS province,
           l.property_type_slug
    FROM base b
    JOIN public.listings l
      ON (p_kind = 'asset_owner' AND l.asset_owner_id = b.base_id)
      OR (p_kind = 'auction_org' AND l.auction_org_id  = b.base_id)
  ),
  agg AS (
    SELECT ls.base_id,
           count(*)                    AS n_listings,
           COALESCE(sum(ls.price), 0)  AS sum_price,
           count(DISTINCT ls.province) AS n_provinces,
           min(ls.created_at)          AS first_at,
           max(ls.created_at)          AS last_at
    FROM ls GROUP BY ls.base_id
  ),
  prov_rank AS (
    SELECT ls.base_id, ls.province, count(*) AS n
    FROM ls WHERE ls.province IS NOT NULL
    GROUP BY ls.base_id, ls.province
  ),
  top_prov AS (
    SELECT DISTINCT ON (pr.base_id) pr.base_id, pr.province
    FROM prov_rank pr ORDER BY pr.base_id, pr.n DESC, pr.province
  ),
  type_rank AS (
    SELECT ls.base_id, ls.property_type_slug AS slug, count(*) AS n
    FROM ls WHERE ls.property_type_slug IS NOT NULL
    GROUP BY ls.base_id, ls.property_type_slug
  ),
  top_type AS (
    SELECT DISTINCT ON (tr.base_id) tr.base_id, tr.slug
    FROM type_rank tr ORDER BY tr.base_id, tr.n DESC, tr.slug
  ),
  ws AS (
    SELECT DISTINCT ON (c.asset_owner_id) c.asset_owner_id AS base_id, w.id AS ws_id
    FROM public.asset_owner_claims c
    JOIN public.asset_owner_workspaces w ON w.id = c.workspace_id
    WHERE c.asset_owner_id IS NOT NULL AND c.status IN ('auto_claimed','confirmed')
    ORDER BY c.asset_owner_id, c.created_at
  )
  SELECT
    b.base_id,
    b.base_kind,
    b.base_name,
    b.base_address,
    b.base_aliases,
    COALESCE(agg.n_listings, 0)::BIGINT,
    COALESCE(agg.sum_price, 0)::NUMERIC,
    COALESCE(agg.n_provinces, 0)::BIGINT,
    top_prov.province,
    COALESCE(pt.name, top_type.slug),
    -- Tài sản user tự đăng. Với chủ tài sản chỉ nối được qua workspace đã claim,
    -- nên prospect chưa onboard luôn = 0 (giới hạn của mô hình dữ liệu).
    (
      SELECT count(*)::BIGINT FROM public.asset_postings ap
      WHERE (p_kind = 'auction_org' AND ap.chosen_org_id = b.base_id)
         OR (p_kind = 'asset_owner' AND ap.user_id IN (
               SELECT w2.owner_user_id
               FROM public.asset_owner_workspaces w2
               JOIN public.asset_owner_claims c2 ON c2.workspace_id = w2.id
               WHERE c2.asset_owner_id = b.base_id AND c2.status IN ('auto_claimed','confirmed')))
    ),
    agg.first_at,
    agg.last_at,
    CASE
      WHEN ws.ws_id IS NOT NULL THEN 'onboarded'
      WHEN EXISTS (
        SELECT 1 FROM public.asset_owner_org_kyc k
        WHERE public.normalize_org_name(k.org_name) = b.base_norm
          AND k.status = 'approved'
      ) THEN 'onboarded'
      WHEN EXISTS (
        SELECT 1 FROM public.asset_owner_org_kyc k
        WHERE public.normalize_org_name(k.org_name) = b.base_norm
          AND k.status IN ('pending_review','under_review')
      ) THEN 'kyc_pending'
      WHEN p_kind = 'auction_org' AND EXISTS (
        SELECT 1 FROM public.organizations g
        WHERE public.normalize_org_name(g.name) = b.base_norm
      ) THEN 'kyc_pending'
      ELSE 'none'
    END,
    ws.ws_id,
    (
      SELECT ld.id FROM public.leads ld
      WHERE public.normalize_org_name(COALESCE(ld.company_name, ld.name)) = b.base_norm
      ORDER BY ld.created_at DESC LIMIT 1
    )
  FROM base b
  LEFT JOIN agg      ON agg.base_id      = b.base_id
  LEFT JOIN top_prov ON top_prov.base_id = b.base_id
  LEFT JOIN top_type ON top_type.base_id = b.base_id
  LEFT JOIN public.property_types pt ON pt.slug = top_type.slug
  LEFT JOIN ws       ON ws.base_id       = b.base_id
  WHERE (p_search IS NULL OR btrim(p_search) = ''
         OR b.base_norm LIKE '%' || public.normalize_org_name(p_search) || '%')
    AND (p_province IS NULL OR p_province = ''
         OR EXISTS (SELECT 1 FROM ls WHERE ls.base_id = b.base_id AND ls.province = p_province))
  ORDER BY COALESCE(agg.n_listings, 0) DESC, b.base_name
  LIMIT COALESCE(p_limit, 200) OFFSET COALESCE(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_prospects(TEXT, TEXT, TEXT, INT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────

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
  d_recent AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', listing_id, 'title', title, 'price', price, 'province', province,
             'asset_type', COALESCE(type_name, slug), 'legal_status', legal_status,
             'bucket', bucket, 'created_at', created_at) ORDER BY created_at DESC) AS j
    FROM (SELECT * FROM lrows ORDER BY created_at DESC LIMIT 20) t
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
      'postings',           (SELECT count(*) FROM posts)
    ),
    'by_province',     COALESCE((SELECT j FROM d_prov),   '[]'::JSONB),
    'by_asset_type',   COALESCE((SELECT j FROM d_type),   '[]'::JSONB),
    'by_legal',        COALESCE((SELECT j FROM d_legal),  '[]'::JSONB),
    'by_status',       COALESCE((SELECT j FROM d_status), '[]'::JSONB),
    'by_counterparty', COALESCE((SELECT j FROM d_cp),     '[]'::JSONB),
    'by_month',        COALESCE((SELECT j FROM d_month),  '[]'::JSONB),
    -- 4 cờ pháp lý của tài sản user tự đăng — thang đo KHÁC listings.legal_status,
    -- nên trả riêng, không gộp vào by_legal.
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
    'branches', COALESCE((SELECT j FROM d_branch), '[]'::JSONB),
    'recent',   COALESCE((SELECT j FROM d_recent), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_prospect_detail(TEXT, UUID) TO authenticated;

-- Khách hàng tiềm năng: phân biệt cá nhân/tổ chức + danh sách chi nhánh / AMC
--
-- 1. Cột cha cho auction_organizations + cột nguồn quan hệ cho cả hai bảng
-- 2. org_branch_marker()  — nhận diện dấu hiệu chi nhánh / AMC trong tên
-- 3. infer_org_parents()  — suy ra quan hệ mẹ–con theo bao hàm token, backfill
-- 4. admin_prospects      — trả thêm entity_type / subtype / parent / branch_count
-- 5. admin_prospect_detail— branches chạy cho CẢ hai loại + profile mang loại hình
-- 6. admin_set_prospect_parent — admin gán / gỡ chi nhánh thủ công

-- ─── 1. Cột ──────────────────────────────────────────────────────────────────

-- auction_organizations trước giờ không có quan hệ mẹ–con dù org_type = 11 đã
-- đánh dấu "Chi nhánh"; normalized_name/name_tokens thì admin_prospects vẫn tính
-- lại mỗi dòng bằng hàm — chuyển sang generated column để vừa suy luận được vừa
-- bỏ được phép tính lặp.
ALTER TABLE public.auction_organizations
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_source TEXT CHECK (parent_source IN ('inferred','confirmed'));

ALTER TABLE public.auction_organizations
  ADD COLUMN IF NOT EXISTS normalized_name TEXT
    GENERATED ALWAYS AS (public.normalize_org_name(name)) STORED;

ALTER TABLE public.auction_organizations
  ADD COLUMN IF NOT EXISTS name_tokens TEXT[]
    GENERATED ALWAYS AS (public.org_significant_tokens(name)) STORED;

CREATE INDEX IF NOT EXISTS idx_auction_orgs_parent     ON public.auction_organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_auction_orgs_normalized ON public.auction_organizations(normalized_name);
CREATE INDEX IF NOT EXISTS idx_auction_orgs_tokens     ON public.auction_organizations USING GIN(name_tokens);

-- Phân biệt quan hệ máy suy ra với quan hệ admin đã xác nhận: chỉ ghi đè cái đầu.
ALTER TABLE public.asset_owners
  ADD COLUMN IF NOT EXISTS parent_source TEXT CHECK (parent_source IN ('inferred','confirmed'));

-- Quan hệ có sẵn (nếu có) coi như đã xác nhận — không để lần suy luận nào đè lên.
UPDATE public.asset_owners
   SET parent_source = 'confirmed'
 WHERE parent_owner_id IS NOT NULL AND parent_source IS NULL;

-- ─── 2. Dấu hiệu chi nhánh / AMC ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.org_branch_marker(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_org_name(p_name) ~ '(amc|quan ly no|khai thac tai san)'        THEN 'amc'
    WHEN public.normalize_org_name(p_name) ~ '(chi nhanh|phong giao dich|so giao dich)'  THEN 'branch'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.org_branch_marker(TEXT) IS
  'Tên có tự nhận là chi nhánh / PGD / công ty AMC không. Dùng làm điều kiện CẦN khi suy ra quan hệ mẹ–con.';

-- ─── 3. Suy ra quan hệ mẹ–con ────────────────────────────────────────────────

-- Chỉ suy luận khi TÊN CON tự nhận là đơn vị thành viên (hoặc org_type = 11):
-- bao hàm token là tín hiệu yếu, quét mò trên tên trung tính sẽ gán bậy hàng loạt.
-- Cha phải "đủ đặc trưng": ≥2 token, hoặc 1 token dài ≥4 ký tự ("agribank"),
-- để token ngắn kiểu "ha"/"noi" không kéo cả trăm bản ghi về một gốc.
CREATE OR REPLACE FUNCTION public.infer_org_parents()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owners INT := 0;
  v_orgs   INT := 0;
BEGIN
  WITH child AS (
    SELECT c.id, c.name_tokens
    FROM public.asset_owners c
    WHERE c.parent_owner_id IS NULL
      AND public.org_branch_marker(c.name) IS NOT NULL
      AND COALESCE(array_length(c.name_tokens, 1), 0) > 1
  ),
  pick AS (
    SELECT DISTINCT ON (ch.id) ch.id AS child_id, p.id AS parent_id
    FROM child ch
    JOIN public.asset_owners p
      ON p.id <> ch.id
     AND p.name_tokens <@ ch.name_tokens
     AND array_length(p.name_tokens, 1) < array_length(ch.name_tokens, 1)
     AND public.org_branch_marker(p.name) IS NULL
     AND (p.parent_owner_id IS NULL OR p.parent_owner_id <> ch.id)
     AND (array_length(p.name_tokens, 1) >= 2
          OR (array_length(p.name_tokens, 1) = 1 AND length(p.name_tokens[1]) >= 4))
    ORDER BY ch.id,
             array_length(p.name_tokens, 1) DESC,
             (SELECT count(*) FROM public.listings l WHERE l.asset_owner_id = p.id) DESC,
             p.id
  )
  UPDATE public.asset_owners o
     SET parent_owner_id = pick.parent_id,
         parent_source   = 'inferred'
    FROM pick
   WHERE o.id = pick.child_id;
  GET DIAGNOSTICS v_owners = ROW_COUNT;

  WITH child AS (
    SELECT c.id, c.name_tokens
    FROM public.auction_organizations c
    WHERE c.parent_org_id IS NULL
      AND (public.org_branch_marker(c.name) IS NOT NULL OR c.org_type = 11)
      AND COALESCE(array_length(c.name_tokens, 1), 0) > 1
  ),
  pick AS (
    SELECT DISTINCT ON (ch.id) ch.id AS child_id, p.id AS parent_id
    FROM child ch
    JOIN public.auction_organizations p
      ON p.id <> ch.id
     AND p.name_tokens <@ ch.name_tokens
     AND array_length(p.name_tokens, 1) < array_length(ch.name_tokens, 1)
     AND public.org_branch_marker(p.name) IS NULL
     AND COALESCE(p.org_type, -1) <> 11
     AND (p.parent_org_id IS NULL OR p.parent_org_id <> ch.id)
     AND (array_length(p.name_tokens, 1) >= 2
          OR (array_length(p.name_tokens, 1) = 1 AND length(p.name_tokens[1]) >= 4))
    ORDER BY ch.id,
             array_length(p.name_tokens, 1) DESC,
             (SELECT count(*) FROM public.listings l WHERE l.auction_org_id = p.id) DESC,
             p.id
  )
  UPDATE public.auction_organizations a
     SET parent_org_id = pick.parent_id,
         parent_source = 'inferred'
    FROM pick
   WHERE a.id = pick.child_id;
  GET DIAGNOSTICS v_orgs = ROW_COUNT;

  RETURN jsonb_build_object('owners_linked', v_owners, 'orgs_linked', v_orgs);
END;
$$;

REVOKE ALL ON FUNCTION public.infer_org_parents() FROM PUBLIC;

SELECT public.infer_org_parents();

-- ─── 4. admin_prospects ──────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_prospects(TEXT, TEXT, TEXT, INT, INT);

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
  entity_type          TEXT,
  subtype              TEXT,
  parent_id            UUID,
  parent_name          TEXT,
  branch_count         BIGINT,
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
    -- Chủ tài sản là pháp nhân duy nhất có thể là CÁ NHÂN; tổ chức đấu giá theo
    -- luật luôn là pháp nhân nên chỉ phân loại hình thức qua org_type.
    SELECT o.id AS base_id, 'asset_owner'::TEXT AS base_kind, o.name AS base_name,
           o.address AS base_address, o.aliases AS base_aliases, o.normalized_name AS base_norm,
           CASE WHEN COALESCE(o.owner_kind, 'other') = 'individual'
                THEN 'individual' ELSE 'organization' END AS base_entity,
           COALESCE(o.owner_kind, 'other') AS base_subtype,
           o.parent_owner_id AS base_parent
    FROM public.asset_owners o
    WHERE p_kind = 'asset_owner'
    UNION ALL
    SELECT a.id, 'auction_org'::TEXT, a.name,
           a.address, '{}'::TEXT[], a.normalized_name,
           'organization'::TEXT,
           CASE a.org_type
             WHEN 0  THEN 'center'
             WHEN 1  THEN 'enterprise'
             WHEN 2  THEN 'company'
             WHEN 11 THEN 'branch'
             ELSE 'other'
           END,
           a.parent_org_id
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
    b.base_entity,
    b.base_subtype,
    b.base_parent,
    CASE
      WHEN b.base_parent IS NULL THEN NULL
      WHEN p_kind = 'asset_owner'
        THEN (SELECT po.name FROM public.asset_owners po          WHERE po.id = b.base_parent)
        ELSE (SELECT pa.name FROM public.auction_organizations pa WHERE pa.id = b.base_parent)
    END,
    (
      SELECT count(*)::BIGINT FROM (
        SELECT 1 FROM public.asset_owners co
         WHERE p_kind = 'asset_owner' AND co.parent_owner_id = b.base_id
        UNION ALL
        SELECT 1 FROM public.auction_organizations ca
         WHERE p_kind = 'auction_org' AND ca.parent_org_id = b.base_id
      ) ch
    ),
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

-- ─── 5. admin_prospect_detail ────────────────────────────────────────────────

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
  v_entity  TEXT;
  v_subtype TEXT;
  v_parent  JSONB := NULL;
  v_pid     UUID;
  v_result  JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  IF p_kind = 'asset_owner' THEN
    SELECT o.name, o.address, o.aliases,
           CASE WHEN COALESCE(o.owner_kind, 'other') = 'individual'
                THEN 'individual' ELSE 'organization' END,
           COALESCE(o.owner_kind, 'other'),
           o.parent_owner_id
      INTO v_name, v_addr, v_aliases, v_entity, v_subtype, v_pid
    FROM public.asset_owners o WHERE o.id = p_id;

    IF v_pid IS NOT NULL THEN
      SELECT jsonb_build_object('id', po.id, 'name', po.name)
        INTO v_parent
      FROM public.asset_owners po WHERE po.id = v_pid;
    END IF;
  ELSE
    SELECT a.name, a.address, '{}'::TEXT[], 'organization',
           CASE a.org_type
             WHEN 0  THEN 'center'
             WHEN 1  THEN 'enterprise'
             WHEN 2  THEN 'company'
             WHEN 11 THEN 'branch'
             ELSE 'other'
           END,
           a.parent_org_id
      INTO v_name, v_addr, v_aliases, v_entity, v_subtype, v_pid
    FROM public.auction_organizations a WHERE a.id = p_id;

    IF v_pid IS NOT NULL THEN
      SELECT jsonb_build_object('id', pa.id, 'name', pa.name)
        INTO v_parent
      FROM public.auction_organizations pa WHERE pa.id = v_pid;
    END IF;
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
  -- Đơn vị thành viên chạy cho CẢ hai loại prospect: công ty đấu giá cũng có
  -- chi nhánh (org_type = 11), trước đây nhánh này bị chốt cứng asset_owner.
  branch_rows AS (
    SELECT o.id AS b_id, 'asset_owner'::TEXT AS b_kind, o.name AS b_name,
           COALESCE(o.owner_kind, 'other') AS b_subtype,
           COALESCE(o.parent_source, 'inferred') AS b_relation,
           NULL::TEXT AS b_province
    FROM public.asset_owners o
    WHERE p_kind = 'asset_owner' AND o.parent_owner_id = p_id
    UNION ALL
    SELECT a.id, 'auction_org'::TEXT, a.name,
           CASE a.org_type
             WHEN 0  THEN 'center'
             WHEN 1  THEN 'enterprise'
             WHEN 2  THEN 'company'
             WHEN 11 THEN 'branch'
             ELSE 'other'
           END,
           COALESCE(a.parent_source, 'inferred'),
           a.province
    FROM public.auction_organizations a
    WHERE p_kind = 'auction_org' AND a.parent_org_id = p_id
  ),
  branch_agg AS (
    SELECT b.*,
      (SELECT count(*) FROM public.listings l2
        WHERE (b.b_kind = 'asset_owner' AND l2.asset_owner_id = b.b_id)
           OR (b.b_kind = 'auction_org' AND l2.auction_org_id  = b.b_id)) AS n_listings,
      (SELECT COALESCE(sum(l2.price), 0) FROM public.listings l2
        WHERE (b.b_kind = 'asset_owner' AND l2.asset_owner_id = b.b_id)
           OR (b.b_kind = 'auction_org' AND l2.auction_org_id  = b.b_id)) AS sum_price,
      -- Chủ tài sản không có cột tỉnh/thành → suy từ tỉnh xuất hiện nhiều nhất
      -- trên tin đấu giá của chính đơn vị đó.
      COALESCE(b.b_province, (
        SELECT NULLIF(btrim(COALESCE(l3.address->>'province', '')), '')
        FROM public.listings l3
        WHERE l3.asset_owner_id = b.b_id
          AND NULLIF(btrim(COALESCE(l3.address->>'province', '')), '') IS NOT NULL
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 1
      )) AS prov
    FROM branch_rows b
  ),
  d_branch AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', b_id, 'kind', b_kind, 'name', b_name, 'subtype', b_subtype,
             'province', prov, 'listing_count', n_listings,
             'starting_price_sum', sum_price, 'relation', b_relation,
             'is_amc', (b_subtype = 'amc' OR public.org_branch_marker(b_name) = 'amc')
           ) ORDER BY n_listings DESC, b_name) AS j
    FROM branch_agg
  )
  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p_id, 'kind', p_kind, 'name', v_name,
      'address', v_addr, 'aliases', to_jsonb(v_aliases),
      'entity_type', v_entity, 'subtype', v_subtype, 'parent', v_parent
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

-- ─── 6. Gán / gỡ chi nhánh thủ công ──────────────────────────────────────────

-- p_parent_id NULL = gỡ khỏi công ty mẹ. Quan hệ do admin đặt luôn là
-- 'confirmed' nên infer_org_parents() chạy lại cũng không đè lên.
CREATE OR REPLACE FUNCTION public.admin_set_prospect_parent(
  p_kind      TEXT,
  p_child_id  UUID,
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grand UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'missing_child';
  END IF;
  IF p_parent_id = p_child_id THEN
    RAISE EXCEPTION 'self_parent';
  END IF;

  IF p_kind = 'asset_owner' THEN
    IF p_parent_id IS NOT NULL THEN
      SELECT parent_owner_id INTO v_grand FROM public.asset_owners WHERE id = p_parent_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'parent_not_found'; END IF;
      IF v_grand = p_child_id THEN RAISE EXCEPTION 'cycle'; END IF;
    END IF;

    UPDATE public.asset_owners
       SET parent_owner_id = p_parent_id,
           parent_source   = CASE WHEN p_parent_id IS NULL THEN NULL ELSE 'confirmed' END
     WHERE id = p_child_id;
  ELSE
    IF p_parent_id IS NOT NULL THEN
      SELECT parent_org_id INTO v_grand FROM public.auction_organizations WHERE id = p_parent_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'parent_not_found'; END IF;
      IF v_grand = p_child_id THEN RAISE EXCEPTION 'cycle'; END IF;
    END IF;

    UPDATE public.auction_organizations
       SET parent_org_id = p_parent_id,
           parent_source = CASE WHEN p_parent_id IS NULL THEN NULL ELSE 'confirmed' END
     WHERE id = p_child_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'child_not_found';
  END IF;

  RETURN jsonb_build_object('ok', true, 'child_id', p_child_id, 'parent_id', p_parent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_prospect_parent(TEXT, UUID, UUID) TO authenticated;

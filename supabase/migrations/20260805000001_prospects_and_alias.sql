-- Khách hàng tiềm năng của sàn + hạ tầng alias dùng chung
--
-- 1. Chuẩn hoá / tách token tên tổ chức (nền tảng cho matching + gợi ý alias)
-- 2. Registry alias trên asset_owners
-- 3. Cột aliases cho asset_owner_org_kyc (vá bug alias Tier-1 bị vứt)
-- 4. RPC suggest_org_aliases  — gợi ý alias, dùng chung onboarding + admin
-- 5. RPC admin_prospects / admin_prospect_detail — danh sách + cơ cấu tài sản
-- 6. RPC run_workspace_match + trigger duyệt → tự khớp tài sản, bỏ bước claim thủ công

-- ─── 1. Chuẩn hoá tên ────────────────────────────────────────────────────────

-- Bỏ dấu tiếng Việt, hạ chữ thường, bỏ dấu câu, gom khoảng trắng.
-- KHÔNG bỏ stop-word ở đây: hàm này dùng cho generated column + so khớp "cùng pháp nhân",
-- nên phải giữ đủ thông tin. Việc bỏ stop-word nằm ở org_significant_tokens().
CREATE OR REPLACE FUNCTION public.normalize_org_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          translate(
            lower(COALESCE(p_name, '')),
            'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
            'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
          ),
          '[^a-z0-9]+', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.normalize_org_name(TEXT) IS
  'Bỏ dấu + hạ chữ thường + bỏ dấu câu. Dùng cho generated column asset_owners.normalized_name.';

-- Token có nghĩa: bỏ các từ chỉ hình thức pháp nhân.
-- Cụm từ được bỏ trước (dạng phrase) để không phá "Công Thương", "Thanh Xuân"…
CREATE OR REPLACE FUNCTION public.org_significant_tokens(p_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH stripped AS (
    SELECT btrim(regexp_replace(
      regexp_replace(
        ' ' || COALESCE(public.normalize_org_name(p_name), '') || ' ',
        ' (cong ty|ngan hang|chi nhanh|phong giao dich|so giao dich|tap doan|tong cong ty|mot thanh vien|co phan|trach nhiem huu han|viet nam) ',
        ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )) AS s
  )
  SELECT COALESCE(
    ARRAY(
      SELECT t
      FROM unnest(string_to_array((SELECT s FROM stripped), ' ')) AS t
      WHERE t <> ''
        AND t NOT IN ('tnhh','mtv','cp','tmcp','cn','ct','hd','tv','va','cac','thuoc','tai')
        AND length(t) > 1
    ),
    '{}'::TEXT[]
  );
$$;

COMMENT ON FUNCTION public.org_significant_tokens(TEXT) IS
  'Token có nghĩa của tên tổ chức, đã bỏ hình thức pháp nhân. Dùng cho chấm điểm khớp + gợi ý alias.';

-- Điểm giống nhau giữa 2 tên tổ chức, 0..1.
-- Mô phỏng nameSimilarity() cũ ở client nhưng CÓ bỏ dấu (bản cũ giữ dấu nên
-- "Vietinbank" không bao giờ khớp "VietinBank – CN Đống Đa").
CREATE OR REPLACE FUNCTION public.org_name_similarity(p_a TEXT, p_b TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  na     TEXT := public.normalize_org_name(p_a);
  nb     TEXT := public.normalize_org_name(p_b);
  ta     TEXT[];
  tb     TEXT[];
  shared INT;
  denom  INT;
BEGIN
  IF na IS NULL OR nb IS NULL THEN
    RETURN 0;
  END IF;
  IF na = nb THEN
    RETURN 1.0;
  END IF;
  IF position(nb IN na) > 0 OR position(na IN nb) > 0 THEN
    RETURN 0.85;
  END IF;

  ta := public.org_significant_tokens(p_a);
  tb := public.org_significant_tokens(p_b);
  denom := GREATEST(COALESCE(array_length(ta, 1), 0), COALESCE(array_length(tb, 1), 0));
  IF denom = 0 THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO shared
  FROM (SELECT DISTINCT unnest(ta) AS t) a
  WHERE a.t = ANY(tb);

  RETURN ROUND(shared::NUMERIC / denom, 3);
END;
$$;

-- ─── 2. Registry alias trên asset_owners ─────────────────────────────────────

ALTER TABLE public.asset_owners
  ADD COLUMN IF NOT EXISTS aliases         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parent_owner_id UUID REFERENCES public.asset_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_kind      TEXT CHECK (owner_kind IN
    ('individual','bank_credit','amc','enforcement','state_agency','company','other'));

ALTER TABLE public.asset_owners
  ADD COLUMN IF NOT EXISTS normalized_name TEXT
    GENERATED ALWAYS AS (public.normalize_org_name(name)) STORED;

ALTER TABLE public.asset_owners
  ADD COLUMN IF NOT EXISTS name_tokens TEXT[]
    GENERATED ALWAYS AS (public.org_significant_tokens(name)) STORED;

CREATE INDEX IF NOT EXISTS idx_asset_owners_normalized ON public.asset_owners(normalized_name);
CREATE INDEX IF NOT EXISTS idx_asset_owners_parent     ON public.asset_owners(parent_owner_id);
CREATE INDEX IF NOT EXISTS idx_asset_owners_tokens     ON public.asset_owners USING GIN(name_tokens);

-- Bảng này trước đây chỉ có policy public SELECT → admin không sửa được alias.
DROP POLICY IF EXISTS "asset_owners_admin_write" ON public.asset_owners;
CREATE POLICY "asset_owners_admin_write"
  ON public.asset_owners FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Suy ra owner_kind cho dữ liệu sẵn có (best-effort, admin sửa lại được)
UPDATE public.asset_owners SET owner_kind = CASE
  WHEN normalized_name ~ '(amc|quan ly no|khai thac tai san|quan ly tai san)'         THEN 'amc'
  WHEN normalized_name ~ '(ngan hang|tin dung)'                                       THEN 'bank_credit'
  WHEN normalized_name ~ '(thi hanh an)'                                              THEN 'enforcement'
  WHEN normalized_name ~ '(uy ban|so tai chinh|chi cuc|co quan|trung tam phat trien)'  THEN 'state_agency'
  WHEN normalized_name ~ '(cong ty|tnhh|co phan|tap doan|tong cong ty)'                THEN 'company'
  ELSE 'individual'
END
WHERE owner_kind IS NULL;

-- ─── 3. Cột aliases cho hồ sơ KYC tổ chức ────────────────────────────────────

ALTER TABLE public.asset_owner_org_kyc
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

-- ─── 4. Gợi ý alias ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.suggest_org_aliases(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tokens  TEXT[];
  v_root    TEXT;
  v_acronym TEXT;
  v_aliases TEXT[] := '{}';
  v_result  JSONB;
BEGIN
  IF COALESCE(btrim(p_name), '') = '' THEN
    RETURN jsonb_build_object(
      'aliases', '[]'::JSONB, 'candidates', '[]'::JSONB,
      'total_listings', 0, 'total_starting_price', 0
    );
  END IF;

  v_tokens := public.org_significant_tokens(p_name);

  -- Gốc tên sau khi cắt đuôi "– Chi nhánh X" / "- CN X"
  v_root := btrim(regexp_replace(p_name, '\s*[-–—,]\s*(chi\s*nh[aá]nh|CN|PGD|phòng giao dịch)\M.*$', '', 'gi'));
  IF public.normalize_org_name(v_root) IS DISTINCT FROM public.normalize_org_name(p_name)
     AND COALESCE(btrim(v_root), '') <> '' THEN
    v_aliases := array_append(v_aliases, v_root);
  END IF;

  -- Viết tắt từ chữ cái đầu các token có nghĩa
  IF COALESCE(array_length(v_tokens, 1), 0) >= 2 THEN
    SELECT upper(string_agg(left(u.t, 1), '' ORDER BY u.ord))
      INTO v_acronym
      FROM unnest(v_tokens) WITH ORDINALITY AS u(t, ord);
    IF length(COALESCE(v_acronym, '')) BETWEEN 2 AND 6 THEN
      v_aliases := array_append(v_aliases, v_acronym);
    END IF;
  END IF;

  -- Phần lõi (đã bỏ hình thức pháp nhân)
  IF COALESCE(array_length(v_tokens, 1), 0) > 0 THEN
    v_aliases := array_append(v_aliases, initcap(array_to_string(v_tokens, ' ')));
  END IF;

  -- Alias đã có sẵn trong registry của các pháp nhân trùng token
  v_aliases := v_aliases || COALESCE((
    SELECT array_agg(DISTINCT a)
    FROM public.asset_owners o, unnest(o.aliases) AS a
    WHERE o.name_tokens && v_tokens
  ), '{}'::TEXT[]);

  SELECT jsonb_build_object(
    'aliases', COALESCE((
      SELECT jsonb_agg(DISTINCT x)
      FROM unnest(v_aliases) AS x
      WHERE btrim(x) <> ''
        AND public.normalize_org_name(x) IS DISTINCT FROM public.normalize_org_name(p_name)
    ), '[]'::JSONB),
    'candidates',           COALESCE(c.items, '[]'::JSONB),
    'total_listings',       COALESCE(c.total_listings, 0),
    'total_starting_price', COALESCE(c.total_price, 0)
  )
  INTO v_result
  FROM (
    SELECT
      jsonb_agg(jsonb_build_object(
        'id',            x.id,
        'name',          x.name,
        'listing_count', x.listing_count,
        'is_amc',        x.owner_kind = 'amc',
        'score',         x.score
      ) ORDER BY x.listing_count DESC, x.name) AS items,
      sum(x.listing_count)                     AS total_listings,
      sum(x.total_price)                       AS total_price
    FROM (
      SELECT o.id, o.name, o.owner_kind,
             public.org_name_similarity(o.name, p_name) AS score,
             count(l.id)                                AS listing_count,
             COALESCE(sum(l.price), 0)                  AS total_price
      FROM public.asset_owners o
      LEFT JOIN public.listings l ON l.asset_owner_id = o.id
      WHERE o.name_tokens && v_tokens
      GROUP BY o.id, o.name, o.owner_kind
      HAVING public.org_name_similarity(o.name, p_name) >= 0.4
    ) x
  ) c;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_org_aliases(TEXT) TO authenticated;

-- ─── 5. Phân loại trạng thái phiên đấu giá (mô phỏng getSessionStatus ở client) ─
-- STABLE chứ không IMMUTABLE: hàm phụ thuộc now().

CREATE OR REPLACE FUNCTION public.listing_auction_bucket(
  p_status TEXT, p_custom JSONB, p_round_count INT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_session TEXT := p_custom->>'session_status';
  v_auction TIMESTAMPTZ;
  v_reg     TIMESTAMPTZ;
  v_now     TIMESTAMPTZ := now();
  v_bucket  TEXT;
BEGIN
  IF p_status = 'SOLD_RENTED'
     OR (p_custom->>'winning_price') IS NOT NULL
     OR (p_custom->>'win_price') IS NOT NULL THEN
    RETURN 'Đã thành';
  END IF;

  BEGIN
    v_auction := COALESCE(p_custom->>'auction_date', p_custom->>'auction_time')::TIMESTAMPTZ;
  EXCEPTION WHEN others THEN v_auction := NULL;
  END;
  BEGIN
    v_reg := COALESCE(p_custom->>'registration_deadline', p_custom->>'document_sale_end')::TIMESTAMPTZ;
  EXCEPTION WHEN others THEN v_reg := NULL;
  END;

  IF v_session IN ('ongoing', 'ended', 'registration_open', 'upcoming') THEN
    v_bucket := v_session;
  ELSIF v_auction IS NOT NULL THEN
    IF v_auction <= v_now THEN
      v_bucket := CASE WHEN v_now <= v_auction + INTERVAL '2 hours' THEN 'ongoing' ELSE 'ended' END;
    ELSIF v_reg IS NOT NULL AND v_now > v_reg THEN
      v_bucket := 'upcoming';
    ELSE
      v_bucket := 'registration_open';
    END IF;
  ELSE
    v_bucket := 'registration_open';
  END IF;

  RETURN CASE v_bucket
    WHEN 'ongoing'           THEN 'Đang đấu'
    WHEN 'registration_open' THEN 'Chờ đấu'
    WHEN 'upcoming'          THEN 'Chờ đấu'
    ELSE CASE WHEN COALESCE(p_round_count, 0) >= 2 THEN 'Tồn đọng' ELSE 'Không thành' END
  END;
END;
$$;

-- ─── 6. Danh sách khách hàng tiềm năng ───────────────────────────────────────

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
           count(*)                 AS n_listings,
           COALESCE(sum(ls.price), 0) AS sum_price,
           count(DISTINCT ls.province) AS n_provinces,
           min(ls.created_at)       AS first_at,
           max(ls.created_at)       AS last_at
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
    top_type.slug,
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

-- ─── 7. Cơ cấu tài sản chi tiết ──────────────────────────────────────────────

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
      SELECT COALESCE(slug, 'khac') AS label, count(*) AS n,
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
             'property_type_slug', slug, 'legal_status', legal_status,
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

-- ─── 8. Khớp tài sản phía server ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.run_workspace_match(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       public.asset_owner_workspaces%ROWTYPE;
  v_seeds    TEXT[];
  v_inserted INT := 0;
  v_auto     INT := 0;
  v_pending  INT := 0;
BEGIN
  SELECT * INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF v_ws.id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- Chủ workspace, admin, hoặc service_role / trigger (auth.uid() IS NULL)
  IF auth.uid() IS NOT NULL
     AND v_ws.owner_user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_seeds := ARRAY(
    SELECT DISTINCT s FROM unnest(
      ARRAY[v_ws.primary_name] || v_ws.abbreviations || v_ws.branch_names
    ) AS s WHERE COALESCE(btrim(s), '') <> ''
  );

  IF COALESCE(array_length(v_seeds, 1), 0) = 0 THEN
    RETURN jsonb_build_object('inserted', 0, 'auto_claimed', 0, 'pending', 0);
  END IF;

  WITH scored AS (
    SELECT o.id AS owner_id, o.name AS owner_name,
           (SELECT max(public.org_name_similarity(o.name, s)) FROM unnest(v_seeds) AS s) AS score
    FROM public.asset_owners o
  ),
  hits AS (SELECT * FROM scored WHERE score >= 0.6),
  ins AS (
    INSERT INTO public.asset_owner_claims
      (workspace_id, listing_id, asset_owner_id, confidence_score, match_basis, matched_name, status)
    SELECT p_workspace_id, l.id, h.owner_id, h.score, 'auto_name', h.owner_name,
           CASE WHEN h.score >= 0.9 THEN 'auto_claimed' ELSE 'pending_confirmation' END
    FROM hits h
    JOIN public.listings l ON l.asset_owner_id = h.owner_id
    ON CONFLICT (workspace_id, listing_id) DO NOTHING
    RETURNING status
  )
  SELECT count(*)::INT,
         count(*) FILTER (WHERE status = 'auto_claimed')::INT,
         count(*) FILTER (WHERE status = 'pending_confirmation')::INT
    INTO v_inserted, v_auto, v_pending
  FROM ins;

  UPDATE public.asset_owner_workspaces
     SET last_matched_at = now(),
         total_claimed = (
           SELECT count(*) FROM public.asset_owner_claims
           WHERE workspace_id = p_workspace_id AND status IN ('auto_claimed','confirmed')
         )
   WHERE id = p_workspace_id;

  RETURN jsonb_build_object('inserted', v_inserted, 'auto_claimed', v_auto, 'pending', v_pending);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_workspace_match(UUID) TO authenticated;

-- ─── 9. Duyệt hồ sơ → tạo workspace có sẵn alias + khớp luôn ─────────────────

CREATE OR REPLACE FUNCTION public.create_workspace_on_org_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws_id      UUID;
  v_suggestion JSONB;
  v_branches   TEXT[];
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    v_suggestion := public.suggest_org_aliases(COALESCE(NEW.org_name, ''));
    v_branches := COALESCE((
      SELECT array_agg(c->>'name')
      FROM jsonb_array_elements(v_suggestion->'candidates') AS c
    ), '{}'::TEXT[]);

    INSERT INTO public.asset_owner_workspaces
      (org_kyc_id, owner_user_id, primary_name, abbreviations, branch_names)
    VALUES (
      NEW.id, NEW.created_by, COALESCE(NEW.org_name, ''),
      COALESCE(NEW.aliases, '{}'::TEXT[]),
      v_branches
    )
    ON CONFLICT (org_kyc_id) DO UPDATE
      SET abbreviations = EXCLUDED.abbreviations,
          branch_names  = EXCLUDED.branch_names
    RETURNING id INTO v_ws_id;

    IF v_ws_id IS NOT NULL THEN
      -- Khớp ngay để user đăng nhập lại là đã thấy tài sản, không phải claim tay
      PERFORM public.run_workspace_match(v_ws_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

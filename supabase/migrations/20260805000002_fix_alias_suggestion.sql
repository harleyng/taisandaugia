-- Sửa 2 lỗi của bước gợi ý alias ở 20260805000001:
--
-- 1. org_significant_tokens: các cụm pháp nhân ĐỨNG CẠNH NHAU ăn mất dấu cách của nhau.
--    " ngan hang tmcp cong thuong viet nam chi nhanh dong da " → sau khi khớp " viet nam "
--    thì " chi nhanh " không còn dấu cách đứng trước để khớp, nên token "chi nhanh" sót lại.
--    → dùng lookbehind/lookahead để KHÔNG nuốt dấu cách phân tách.
--
-- 2. suggest_org_aliases: alias "lõi" dựng lại từ token đã bỏ dấu ("Cong Thuong") — với người
--    dùng trông như gõ sai chính tả. → cắt tiền tố/hậu tố pháp nhân trên tên GỐC, giữ nguyên dấu.
--    Đồng thời tính viết tắt từ tên đã cắt đuôi chi nhánh, và bỏ viết tắt quá ngắn (2 ký tự).

CREATE OR REPLACE FUNCTION public.org_significant_tokens(p_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH stripped AS (
    SELECT btrim(regexp_replace(
      regexp_replace(
        ' ' || COALESCE(public.normalize_org_name(p_name), '') || ' ',
        -- lookbehind/lookahead: chỉ xoá cụm từ, giữ nguyên 2 dấu cách bao quanh
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
        AND t NOT IN ('tnhh','mtv','cp','tmcp','cn','ct','hd','tv','va','cac','thuoc','tai')
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
  v_core    TEXT;
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

  -- Token dùng cho tìm ứng viên: lấy trên TOÀN BỘ tên để không bỏ sót chi nhánh
  v_tokens := public.org_significant_tokens(p_name);

  -- (a) Gốc tên sau khi cắt đuôi "– Chi nhánh X" / "- CN X" / "- PGD X"
  v_root := btrim(regexp_replace(
    p_name, '\s*[-–—,]\s*(chi\s*nh[aá]nh|CN|PGD|phòng giao dịch)\M.*$', '', 'gi'
  ));
  IF COALESCE(btrim(v_root), '') = '' THEN
    v_root := p_name;
  END IF;
  IF public.normalize_org_name(v_root) IS DISTINCT FROM public.normalize_org_name(p_name) THEN
    v_aliases := array_append(v_aliases, v_root);
  END IF;

  -- (b) Lõi thương hiệu: cắt tiền tố/hậu tố pháp nhân trên tên gốc, GIỮ NGUYÊN DẤU
  v_core := btrim(regexp_replace(
    btrim(regexp_replace(
      v_root,
      '^\s*(Ngân hàng TMCP|Ngân hàng thương mại cổ phần|Ngân hàng|Tổng công ty|Công ty TNHH MTV|Công ty TNHH một thành viên|Công ty TNHH|Công ty Cổ phần|Công ty CP|Công ty|Tập đoàn)\s+',
      '', 'i'
    )),
    '\s+(Việt Nam)\s*$', '', 'i'
  ));
  IF COALESCE(btrim(v_core), '') <> ''
     AND public.normalize_org_name(v_core) IS DISTINCT FROM public.normalize_org_name(p_name) THEN
    v_aliases := array_append(v_aliases, v_core);
  END IF;

  -- (c) Viết tắt từ chữ cái đầu của lõi. Bỏ viết tắt 2 ký tự — quá ngắn, gây nhiễu khi khớp.
  IF COALESCE(array_length(public.org_significant_tokens(v_root), 1), 0) >= 3 THEN
    SELECT upper(string_agg(left(u.t, 1), '' ORDER BY u.ord))
      INTO v_acronym
      FROM unnest(public.org_significant_tokens(v_root)) WITH ORDINALITY AS u(t, ord);
    IF length(COALESCE(v_acronym, '')) BETWEEN 3 AND 6 THEN
      v_aliases := array_append(v_aliases, v_acronym);
    END IF;
  END IF;

  -- (d) Alias do admin đã curate sẵn trong registry
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

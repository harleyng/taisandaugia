-- ─────────────────────────────────────────────────────────────────────────────
-- Báo cáo "Tin đấu giá" (Admin) — tồn kho & phân bố tài sản trên sàn.
--
-- Nguồn dữ liệu DUY NHẤT: public.listings, GỒM CẢ trạng thái nội bộ
-- (DRAFT / PENDING_APPROVAL / INACTIVE). KHÔNG đọc asset_postings.
--
-- Bộ lọc thời gian áp lên listings.created_at (ngày đăng tin). Mọi phần đều
-- theo khoảng đã chọn, TRỪ kpis.total — đó là tồn kho toàn sàn (stock), không
-- phải lưu lượng trong kỳ, nên cố tình bỏ qua khoảng ngày.
--
-- Zero-fill trục thời gian làm ở CLIENT (enumerateBuckets), giống admin_access_report.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Helper: parse timestamptz an toàn từ text tự do ──────────────────────
-- custom_attributes là jsonb do người dùng/seed ghi, giá trị ngày có thể rác.
-- STABLE (không IMMUTABLE): cast text→timestamptz phụ thuộc GUC TimeZone.
CREATE OR REPLACE FUNCTION public.try_timestamptz(_t TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF _t IS NULL OR btrim(_t) = '' THEN
    RETURN NULL;
  END IF;
  RETURN _t::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ─── 2. Helper: gom slug con về nhóm cha ─────────────────────────────────────
-- listings.property_type_slug chứa CẢ HAI thế hệ taxonomy:
--   • thế hệ mới  = ASSET_CATEGORIES (src/constants/category.constants.ts)
--   • thế hệ cũ   = property_types chỉ-BĐS (seed 20251004173023 / 20251104030318)
-- Slug lạ → 'khac'; muốn biết cái gì rơi vào 'khac' thì xem section byCategoryChild.
-- ĐỒNG BỘ BẮT BUỘC với PARENT_OF trong src/lib/reports/listingsReport.ts.
CREATE OR REPLACE FUNCTION public.asset_parent_slug(_slug TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    -- slug cha tự nó
    WHEN _slug IN ('bat-dong-san','xe-co','may-moc','hang-hoa','do-dung','khac')
      THEN _slug
    -- Bất động sản (thế hệ mới)
    WHEN _slug IN ('dat-o','dat-nong-nghiep','nha-pho','can-ho','nha-xuong','shophouse')
      THEN 'bat-dong-san'
    -- Bất động sản (thế hệ cũ, property_types)
    WHEN _slug IN ('can-ho-chung-cu','chung-cu-mini-chdv','nha-rieng','biet-thu',
                   'nha-biet-thu','nha-lien-ke','nha-mat-pho','dat-nen-du-an',
                   'dat-nen','dat-tho-cu','trang-trai-khu-nghi-duong',
                   'kho-nha-xuong','kho-xuong','condotel','cua-hang-kiot',
                   'nha-tro-phong-tro','van-phong',
                   'cac-loai-nha','cac-loai-dat','bds-khac')
      THEN 'bat-dong-san'
    WHEN _slug IN ('o-to','xe-tai','xe-may')                         THEN 'xe-co'
    WHEN _slug IN ('may-cong-trinh','may-nong-nghiep','day-chuyen')  THEN 'may-moc'
    WHEN _slug IN ('gach-vat-lieu','sat-thep','hang-ton-kho')        THEN 'hang-hoa'
    WHEN _slug IN ('noi-that','thiet-bi','cong-cu')                  THEN 'do-dung'
    ELSE 'khac'
  END;
$$;

-- ─── 3. Helper: giá trị khởi điểm quy đổi (VND) ──────────────────────────────
--   TOTAL     → price
--   PER_SQM   → price × area  (quy đổi ra tổng)
--   PER_MONTH → NULL — giá thuê/tháng KHÔNG phải giá khởi điểm đấu giá; cộng
--               vào tổng sẽ làm sai lệch. Các tin này rơi vào bucket
--               'unknown' ("Chưa quy đổi") và không tính vào Σ/trung vị.
CREATE OR REPLACE FUNCTION public.listing_start_value(
  _price NUMERIC,
  _unit  public.price_unit,
  _area  NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _price IS NULL OR _price <= 0 THEN NULL
    WHEN _unit = 'PER_MONTH'::public.price_unit THEN NULL
    WHEN _unit = 'PER_SQM'::public.price_unit
      THEN _price * COALESCE(NULLIF(_area, 0), 1)
    ELSE _price
  END;
$$;

-- ─── 4. Helper: trạng thái phiên suy diễn ────────────────────────────────────
-- BẢN SAO 1:1 của sessionStatusOf() trong src/lib/listings/sessionStatus.ts.
-- Sửa một bên PHẢI sửa bên kia. Lý do phải có bản SQL: cần GROUP BY trên toàn
-- bộ tin, không thể suy sau khi đã tổng hợp.
-- Bẫy chính tả key: auction_date | auction_time, registration_deadline | document_sale_end.
CREATE OR REPLACE FUNCTION public.listing_session_status(
  _status public.listing_status,
  _ca     JSONB,
  _now    TIMESTAMPTZ DEFAULT now()
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  explicit   TEXT;
  auction_at TIMESTAMPTZ;
  reg_at     TIMESTAMPTZ;
BEGIN
  -- 1. Ghi đè tường minh
  explicit := NULLIF(btrim(COALESCE(_ca ->> 'session_status', '')), '');
  IF explicit IN ('ongoing', 'ended', 'registration_open', 'upcoming') THEN
    RETURN explicit;
  END IF;

  -- 2. Đã đấu giá xong
  IF _status = 'SOLD_RENTED'::public.listing_status THEN
    RETURN 'ended';
  END IF;

  -- 3. Suy từ mốc thời gian (NULLIF: chuỗi rỗng phải rơi sang key thay thế,
  --    khớp toán tử `||` của JS — COALESCE trần sẽ giữ lại '' và sai)
  auction_at := public.try_timestamptz(
    COALESCE(NULLIF(_ca ->> 'auction_date', ''), NULLIF(_ca ->> 'auction_time', ''))
  );
  reg_at := public.try_timestamptz(
    COALESCE(NULLIF(_ca ->> 'registration_deadline', ''), NULLIF(_ca ->> 'document_sale_end', ''))
  );

  IF auction_at IS NOT NULL THEN
    IF auction_at <= _now THEN
      -- cửa sổ 2 tiếng coi như đang diễn ra
      IF _now <= auction_at + INTERVAL '2 hours' THEN
        RETURN 'ongoing';
      END IF;
      RETURN 'ended';
    END IF;
    IF reg_at IS NOT NULL THEN
      IF _now <= reg_at THEN
        RETURN 'registration_open';
      END IF;
      RETURN 'upcoming';  -- hết hạn nộp hồ sơ nhưng chưa tới ngày đấu
    END IF;
    RETURN 'registration_open';
  END IF;

  RETURN 'registration_open';  -- không có mốc nào
END;
$$;

-- ─── 5. RPC tổng hợp (ADMIN only) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_listings_report(
  _from        TIMESTAMPTZ,
  _to          TIMESTAMPTZ,
  _granularity TEXT DEFAULT 'day'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trunc  TEXT;
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  trunc := CASE _granularity
             WHEN 'month' THEN 'month'
             WHEN 'week'  THEN 'week'
             ELSE 'day'
           END;

  WITH scoped AS MATERIALIZED (
    SELECT
      l.id,
      l.status,
      l.created_at,
      l.property_type_slug,
      l.auction_org_id,
      l.asset_owner_id,
      l.image_url,
      l.verified,
      l.featured,
      l.views_count,
      l.custom_attributes,
      public.asset_parent_slug(l.property_type_slug)                   AS parent_slug,
      COALESCE(NULLIF(btrim(l.address ->> 'province'), ''), 'Không rõ') AS province,
      public.listing_start_value(l.price, l.price_unit, l.area)        AS value,
      public.listing_session_status(l.status, l.custom_attributes)     AS session_status
    FROM public.listings l
    WHERE l.created_at >= _from AND l.created_at <= _to
  )
  SELECT jsonb_build_object(

    -- ── KPI ────────────────────────────────────────────────────────────────
    'kpis', jsonb_build_object(
      -- Trong kỳ (theo created_at)
      'period', jsonb_build_object(
        'listings',    (SELECT count(*) FROM scoped),
        'value',       (SELECT COALESCE(sum(value), 0) FROM scoped),
        'medianValue', (SELECT COALESCE(
                          round((percentile_cont(0.5) WITHIN GROUP (ORDER BY value))::numeric),
                          0)
                        FROM scoped WHERE value IS NOT NULL),
        'valuedCount', (SELECT count(*) FROM scoped WHERE value IS NOT NULL),
        'orgs',        (SELECT count(DISTINCT auction_org_id) FROM scoped WHERE auction_org_id IS NOT NULL),
        'owners',      (SELECT count(DISTINCT asset_owner_id) FROM scoped WHERE asset_owner_id IS NOT NULL),
        'provinces',   (SELECT count(DISTINCT province) FROM scoped WHERE province <> 'Không rõ'),
        'views',       (SELECT COALESCE(sum(COALESCE(views_count, 0)), 0) FROM scoped)
      ),
      -- Toàn sàn (KHÔNG lọc theo ngày — đây là tồn kho, không phải lưu lượng)
      'total', jsonb_build_object(
        'listings', (SELECT count(*) FROM public.listings),
        'active',   (SELECT count(*) FROM public.listings WHERE status = 'ACTIVE'),
        'pending',  (SELECT count(*) FROM public.listings WHERE status = 'PENDING_APPROVAL'),
        'draft',    (SELECT count(*) FROM public.listings WHERE status = 'DRAFT'),
        'value',    (SELECT COALESCE(sum(public.listing_start_value(price, price_unit, area)), 0)
                     FROM public.listings)
      )
    ),

    -- ── Tin mới theo thời gian ─────────────────────────────────────────────
    'timeseries', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.bucket)
      FROM (
        SELECT
          date_trunc(trunc, created_at) AS bucket,
          count(*)                      AS listings,
          COALESCE(sum(value), 0)       AS value
        FROM scoped
        GROUP BY 1
      ) t
    ), '[]'::jsonb),

    -- ── Theo trạng thái tin ────────────────────────────────────────────────
    'byStatus', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.listings DESC)
      FROM (
        SELECT status::text AS status, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped
        GROUP BY status
      ) s
    ), '[]'::jsonb),

    -- ── Theo trạng thái phiên (suy diễn) ───────────────────────────────────
    'bySessionStatus', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.listings DESC)
      FROM (
        SELECT session_status AS session_status, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped
        GROUP BY session_status
      ) s
    ), '[]'::jsonb),

    -- ── Theo nhóm tài sản (đã gom về cha) ──────────────────────────────────
    'byCategory', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.listings DESC)
      FROM (
        SELECT parent_slug AS parent_slug, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped
        GROUP BY parent_slug
      ) c
    ), '[]'::jsonb),

    -- ── Chi tiết theo slug gốc (soi drift taxonomy) ────────────────────────
    'byCategoryChild', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.listings DESC)
      FROM (
        SELECT
          s.property_type_slug                    AS slug,
          COALESCE(pt.name, s.property_type_slug) AS name,
          s.parent_slug                           AS parent_slug,
          count(*)                                AS listings,
          COALESCE(sum(s.value), 0)               AS value
        FROM scoped s
        LEFT JOIN public.property_types pt ON pt.slug = s.property_type_slug
        GROUP BY s.property_type_slug, pt.name, s.parent_slug
        ORDER BY count(*) DESC
        LIMIT 30
      ) c
    ), '[]'::jsonb),

    -- ── Theo tỉnh/thành (address là jsonb) ─────────────────────────────────
    'byProvince', COALESCE((
      SELECT jsonb_agg(p ORDER BY p.listings DESC)
      FROM (
        SELECT province AS province, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped
        GROUP BY province
        ORDER BY count(*) DESC
        LIMIT 100
      ) p
    ), '[]'::jsonb),

    -- ── Histogram khoảng giá khởi điểm ─────────────────────────────────────
    'byPriceBucket', COALESCE((
      SELECT jsonb_agg(b ORDER BY b.sort)
      FROM (
        SELECT
          CASE
            WHEN value IS NULL               THEN 'unknown'
            WHEN value <     1000000000      THEN 'lt1'
            WHEN value <     5000000000      THEN '1to5'
            WHEN value <    20000000000      THEN '5to20'
            WHEN value <   100000000000      THEN '20to100'
            ELSE 'gt100'
          END AS bucket,
          CASE
            WHEN value IS NULL               THEN 6
            WHEN value <     1000000000      THEN 1
            WHEN value <     5000000000      THEN 2
            WHEN value <    20000000000      THEN 3
            WHEN value <   100000000000      THEN 4
            ELSE 5
          END AS sort,
          count(*)                 AS listings,
          COALESCE(sum(value), 0)  AS value
        FROM scoped
        GROUP BY 1, 2
      ) b
    ), '[]'::jsonb),

    -- ── Top tổ chức đấu giá ────────────────────────────────────────────────
    'topOrgs', COALESCE((
      SELECT jsonb_agg(o ORDER BY o.listings DESC)
      FROM (
        SELECT
          s.auction_org_id::text     AS id,
          COALESCE(ao.name, '—')     AS name,
          ao.province                AS sub,
          count(*)                   AS listings,
          COALESCE(sum(s.value), 0)  AS value
        FROM scoped s
        LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
        WHERE s.auction_org_id IS NOT NULL
        GROUP BY s.auction_org_id, ao.name, ao.province
        ORDER BY count(*) DESC
        LIMIT 10
      ) o
    ), '[]'::jsonb),

    -- ── Top chủ tài sản ────────────────────────────────────────────────────
    'topOwners', COALESCE((
      SELECT jsonb_agg(o ORDER BY o.listings DESC)
      FROM (
        SELECT
          s.asset_owner_id::text     AS id,
          COALESCE(aw.name, '—')     AS name,
          aw.address                 AS sub,
          count(*)                   AS listings,
          COALESCE(sum(s.value), 0)  AS value
        FROM scoped s
        LEFT JOIN public.asset_owners aw ON aw.id = s.asset_owner_id
        WHERE s.asset_owner_id IS NOT NULL
        GROUP BY s.asset_owner_id, aw.name, aw.address
        ORDER BY count(*) DESC
        LIMIT 10
      ) o
    ), '[]'::jsonb),

    -- ── Độ đầy đủ dữ liệu của kho tin ──────────────────────────────────────
    'coverage', jsonb_build_object(
      'total',        (SELECT count(*) FROM scoped),
      'withImage',    (SELECT count(*) FROM scoped WHERE image_url IS NOT NULL AND btrim(image_url) <> ''),
      'withValue',    (SELECT count(*) FROM scoped WHERE value IS NOT NULL),
      'withAuctionAt',(SELECT count(*) FROM scoped
                       WHERE public.try_timestamptz(
                               COALESCE(NULLIF(custom_attributes ->> 'auction_date', ''),
                                        NULLIF(custom_attributes ->> 'auction_time', ''))
                             ) IS NOT NULL),
      'withOrg',      (SELECT count(*) FROM scoped WHERE auction_org_id IS NOT NULL),
      'withOwner',    (SELECT count(*) FROM scoped WHERE asset_owner_id IS NOT NULL),
      'withProvince', (SELECT count(*) FROM scoped WHERE province <> 'Không rõ'),
      'verified',     (SELECT count(*) FROM scoped WHERE verified IS TRUE),
      'featured',     (SELECT count(*) FROM scoped WHERE featured IS TRUE)
    )

  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listings_report(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- ─── 6. Index cho bảng chi tiết (lọc trạng thái / nhóm / tỉnh) ───────────────
-- idx_listings_created_at đã có sẵn (20251004182522).
CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON public.listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_property_type_slug
  ON public.listings(property_type_slug);
CREATE INDEX IF NOT EXISTS idx_listings_address_province
  ON public.listings((address ->> 'province'));

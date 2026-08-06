-- ─────────────────────────────────────────────────────────────────────────────
-- Bộ lọc cấp trang cho báo cáo "Tin đấu giá".
--
-- Trước đây bộ lọc chỉ áp cho bảng chi tiết (query PostgREST phía client) nên
-- biểu đồ và bảng nói hai chuyện khác nhau. Nay MỘT định nghĩa bộ lọc duy nhất
-- là public.admin_listings_scope(); cả phần tổng hợp lẫn bảng chi tiết đều join
-- vào đó — không còn khả năng lệch ngữ nghĩa giữa SQL và client.
--
-- Kèm theo: admin_listings_rows() thay cho query PostgREST của bảng chi tiết,
-- xoá luôn màn tra id tổ chức/chủ tài sản 2 bước ở client.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. NGUỒN SỰ THẬT DUY NHẤT của bộ lọc ────────────────────────────────────
-- Mọi tham số NULL = không lọc. Client chuẩn hoá "all" → NULL trước khi gọi.
CREATE OR REPLACE FUNCTION public.admin_listings_scope(
  _from     TIMESTAMPTZ,
  _to       TIMESTAMPTZ,
  _status   TEXT    DEFAULT NULL,
  _parent   TEXT    DEFAULT NULL,
  _province TEXT    DEFAULT NULL,
  _org_id   UUID    DEFAULT NULL,
  _owner_id UUID    DEFAULT NULL,
  _q        TEXT    DEFAULT NULL
)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l.id
  FROM public.listings l
  WHERE l.created_at >= _from
    AND l.created_at <= _to
    AND (_status   IS NULL OR l.status = _status::public.listing_status)
    AND (_province IS NULL OR btrim(COALESCE(l.address ->> 'province', '')) = _province)
    AND (_org_id   IS NULL OR l.auction_org_id = _org_id)
    AND (_owner_id IS NULL OR l.asset_owner_id = _owner_id)
    AND (_parent   IS NULL OR public.asset_parent_slug(l.property_type_slug) = _parent)
    -- Tìm kiếm: tên · mô tả · tỉnh · quận/huyện · tên tổ chức đấu giá · tên chủ tài sản
    AND (
      _q IS NULL OR btrim(_q) = '' OR (
           l.title       ILIKE '%' || btrim(_q) || '%'
        OR l.description ILIKE '%' || btrim(_q) || '%'
        OR l.address ->> 'province' ILIKE '%' || btrim(_q) || '%'
        OR l.address ->> 'district' ILIKE '%' || btrim(_q) || '%'
        OR EXISTS (SELECT 1 FROM public.auction_organizations ao
                   WHERE ao.id = l.auction_org_id AND ao.name ILIKE '%' || btrim(_q) || '%')
        OR EXISTS (SELECT 1 FROM public.asset_owners aw
                   WHERE aw.id = l.asset_owner_id AND aw.name ILIKE '%' || btrim(_q) || '%')
      )
    );
$$;

-- ─── 2. RPC tổng hợp — thêm bộ lọc ───────────────────────────────────────────
-- DROP trước: thêm tham số làm đổi chữ ký ⇒ CREATE OR REPLACE sẽ tạo overload
-- và lời gọi có tên tham số trở nên nhập nhằng.
DROP FUNCTION IF EXISTS public.admin_listings_report(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.admin_listings_report(
  _from        TIMESTAMPTZ,
  _to          TIMESTAMPTZ,
  _granularity TEXT DEFAULT 'day',
  _status      TEXT DEFAULT NULL,
  _parent      TEXT DEFAULT NULL,
  _province    TEXT DEFAULT NULL,
  _org_id      UUID DEFAULT NULL,
  _owner_id    UUID DEFAULT NULL,
  _q           TEXT DEFAULT NULL
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
    JOIN public.admin_listings_scope(_from, _to, _status, _parent, _province, _org_id, _owner_id, _q) s
      ON s.id = l.id
  )
  SELECT jsonb_build_object(

    'kpis', jsonb_build_object(
      -- Trong kỳ + theo bộ lọc đang áp
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
      -- Toàn sàn: KHÔNG lọc ngày, KHÔNG lọc gì cả — mốc tham chiếu để biết bộ
      -- lọc đang thu hẹp bao nhiêu. UI chỉ hiện khi khác con số trong kỳ.
      'total', jsonb_build_object(
        'listings', (SELECT count(*) FROM public.listings),
        'active',   (SELECT count(*) FROM public.listings WHERE status = 'ACTIVE'),
        'pending',  (SELECT count(*) FROM public.listings WHERE status = 'PENDING_APPROVAL'),
        'draft',    (SELECT count(*) FROM public.listings WHERE status = 'DRAFT'),
        'value',    (SELECT COALESCE(sum(public.listing_start_value(price, price_unit, area)), 0)
                     FROM public.listings)
      )
    ),

    'timeseries', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.bucket)
      FROM (
        SELECT date_trunc(trunc, created_at) AS bucket,
               count(*)                      AS listings,
               COALESCE(sum(value), 0)       AS value
        FROM scoped GROUP BY 1
      ) t
    ), '[]'::jsonb),

    'byStatus', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.listings DESC)
      FROM (
        SELECT status::text AS status, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped GROUP BY status
      ) s
    ), '[]'::jsonb),

    'bySessionStatus', COALESCE((
      SELECT jsonb_agg(s ORDER BY s.listings DESC)
      FROM (
        SELECT session_status AS session_status, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped GROUP BY session_status
      ) s
    ), '[]'::jsonb),

    'byCategory', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.listings DESC)
      FROM (
        SELECT parent_slug AS parent_slug, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped GROUP BY parent_slug
      ) c
    ), '[]'::jsonb),

    'byCategoryChild', COALESCE((
      SELECT jsonb_agg(c ORDER BY c.listings DESC)
      FROM (
        SELECT s.property_type_slug                    AS slug,
               COALESCE(pt.name, s.property_type_slug) AS name,
               s.parent_slug                           AS parent_slug,
               count(*)                                AS listings,
               COALESCE(sum(s.value), 0)               AS value
        FROM scoped s
        LEFT JOIN public.property_types pt ON pt.slug = s.property_type_slug
        GROUP BY s.property_type_slug, pt.name, s.parent_slug
        ORDER BY count(*) DESC LIMIT 30
      ) c
    ), '[]'::jsonb),

    'byProvince', COALESCE((
      SELECT jsonb_agg(p ORDER BY p.listings DESC)
      FROM (
        SELECT province AS province, count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped GROUP BY province ORDER BY count(*) DESC LIMIT 100
      ) p
    ), '[]'::jsonb),

    'byPriceBucket', COALESCE((
      SELECT jsonb_agg(b ORDER BY b.sort)
      FROM (
        SELECT
          CASE WHEN value IS NULL          THEN 'unknown'
               WHEN value <     1000000000 THEN 'lt1'
               WHEN value <     5000000000 THEN '1to5'
               WHEN value <    20000000000 THEN '5to20'
               WHEN value <   100000000000 THEN '20to100'
               ELSE 'gt100' END AS bucket,
          CASE WHEN value IS NULL          THEN 6
               WHEN value <     1000000000 THEN 1
               WHEN value <     5000000000 THEN 2
               WHEN value <    20000000000 THEN 3
               WHEN value <   100000000000 THEN 4
               ELSE 5 END AS sort,
          count(*) AS listings, COALESCE(sum(value), 0) AS value
        FROM scoped GROUP BY 1, 2
      ) b
    ), '[]'::jsonb),

    'topOrgs', COALESCE((
      SELECT jsonb_agg(o ORDER BY o.listings DESC)
      FROM (
        SELECT s.auction_org_id::text AS id, COALESCE(ao.name, '—') AS name,
               ao.province AS sub, count(*) AS listings, COALESCE(sum(s.value), 0) AS value
        FROM scoped s
        LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
        WHERE s.auction_org_id IS NOT NULL
        GROUP BY s.auction_org_id, ao.name, ao.province
        ORDER BY count(*) DESC LIMIT 10
      ) o
    ), '[]'::jsonb),

    'topOwners', COALESCE((
      SELECT jsonb_agg(o ORDER BY o.listings DESC)
      FROM (
        SELECT s.asset_owner_id::text AS id, COALESCE(aw.name, '—') AS name,
               aw.address AS sub, count(*) AS listings, COALESCE(sum(s.value), 0) AS value
        FROM scoped s
        LEFT JOIN public.asset_owners aw ON aw.id = s.asset_owner_id
        WHERE s.asset_owner_id IS NOT NULL
        GROUP BY s.asset_owner_id, aw.name, aw.address
        ORDER BY count(*) DESC LIMIT 10
      ) o
    ), '[]'::jsonb),

    'coverage', jsonb_build_object(
      'total',        (SELECT count(*) FROM scoped),
      'withImage',    (SELECT count(*) FROM scoped WHERE image_url IS NOT NULL AND btrim(image_url) <> ''),
      'withValue',    (SELECT count(*) FROM scoped WHERE value IS NOT NULL),
      'withAuctionAt',(SELECT count(*) FROM scoped
                       WHERE public.try_timestamptz(
                               COALESCE(NULLIF(custom_attributes ->> 'auction_date', ''),
                                        NULLIF(custom_attributes ->> 'auction_time', ''))) IS NOT NULL),
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

-- ─── 3. RPC bảng chi tiết (phân trang phía server) ───────────────────────────
-- Thay cho query PostgREST cũ: dùng CHUNG admin_listings_scope nên bảng và biểu
-- đồ không thể lệch nhau. Các trường suy diễn (giá quy đổi, trạng thái phiên,
-- nhóm cha) tính luôn ở đây để client khỏi map lại.
CREATE OR REPLACE FUNCTION public.admin_listings_rows(
  _from     TIMESTAMPTZ,
  _to       TIMESTAMPTZ,
  _status   TEXT    DEFAULT NULL,
  _parent   TEXT    DEFAULT NULL,
  _province TEXT    DEFAULT NULL,
  _org_id   UUID    DEFAULT NULL,
  _owner_id UUID    DEFAULT NULL,
  _q        TEXT    DEFAULT NULL,
  _limit    INT     DEFAULT 20,
  _offset   INT     DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH scoped AS MATERIALIZED (
    SELECT l.*
    FROM public.listings l
    JOIN public.admin_listings_scope(_from, _to, _status, _parent, _province, _org_id, _owner_id, _q) s
      ON s.id = l.id
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM scoped),
    'rows', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.created_at DESC)
      FROM (
        SELECT
          s.id,
          s.title,
          s.status::text                                              AS status,
          s.property_type_slug                                        AS slug,
          public.asset_parent_slug(s.property_type_slug)              AS parent_slug,
          COALESCE(NULLIF(btrim(s.address ->> 'province'), ''), 'Không rõ') AS province,
          s.address ->> 'district'                                    AS district,
          public.listing_start_value(s.price, s.price_unit, s.area)   AS value,
          s.area,
          ao.name                                                     AS org_name,
          aw.name                                                     AS owner_name,
          public.listing_session_status(s.status, s.custom_attributes) AS session_status,
          s.created_at,
          COALESCE(s.views_count, 0)                                  AS views
        FROM scoped s
        LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
        LEFT JOIN public.asset_owners aw          ON aw.id = s.asset_owner_id
        ORDER BY s.created_at DESC
        LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0)
      ) r
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listings_scope(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listings_report(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listings_rows(
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, UUID, TEXT, INT, INT) TO authenticated;

-- Hỗ trợ lọc theo chủ tài sản (đã có index cho status/slug/province ở migration trước).
CREATE INDEX IF NOT EXISTS idx_listings_asset_owner_id ON public.listings(asset_owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_auction_org_id ON public.listings(auction_org_id);

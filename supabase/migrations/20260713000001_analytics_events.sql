-- Báo cáo "Phân tích truy cập" (/admin/bao-cao/truy-cap) — hạ tầng thu thập hành
-- vi người dùng first-party (sàn trước đây KHÔNG track gì: không page view, không
-- session, không thiết bị/geo).
--
-- Gồm 4 phần:
--   1. Bảng analytics_events — sink append-only cho page_view + feature event.
--   2. RLS: ai cũng INSERT được (kể cả khách chưa đăng nhập) nhưng chỉ ghi được
--      cho chính mình/ẩn danh; chỉ ADMIN mới SELECT.
--   3. user_province(uid) + trigger tự suy tỉnh từ hồ sơ tổ chức khi có user_id
--      (tái dùng đúng khối COALESCE của resolve_campaign_audience).
--   4. admin_access_report() — RPC tổng hợp phía server (ADMIN-guarded, giống
--      admin_grant_credits) trả 1 JSONB đủ cho mọi biểu đồ + funnel của báo cáo.

-- ─── 1. Bảng sự kiện ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL,                 -- id ẩn danh sinh ở client (localStorage)
  user_id     UUID,                          -- auth.uid() khi đăng nhập, NULL khi ẩn danh
  event_type  TEXT NOT NULL,                 -- 'page_view' | 'feature'
  path        TEXT,                          -- cho page_view
  feature_key TEXT,                          -- cho feature (search, save_asset, open_paywall…)
  device_type TEXT,                          -- 'desktop' | 'mobile' | 'tablet'
  browser     TEXT,
  os          TEXT,
  province    TEXT,                          -- seed điền trực tiếp; real: trigger suy từ tổ chức
  referrer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_event_type_check CHECK (event_type IN ('page_view', 'feature')),
  CONSTRAINT analytics_events_device_type_check
    CHECK (device_type IS NULL OR device_type IN ('desktop', 'mobile', 'tablet'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created      ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON public.analytics_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_feature      ON public.analytics_events (feature_key) WHERE feature_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_province     ON public.analytics_events (province);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Ai cũng ghi được (khách chưa đăng nhập vẫn cần log) nhưng KHÔNG mạo danh user
-- khác: authenticated chỉ được set user_id = chính mình hoặc NULL; anon = NULL.
DROP POLICY IF EXISTS "analytics_events_insert_any" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_any" ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Chỉ ADMIN đọc (không có policy UPDATE/DELETE → mặc định chặn).
DROP POLICY IF EXISTS "analytics_events_admin_read" ON public.analytics_events;
CREATE POLICY "analytics_events_admin_read" ON public.analytics_events
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 3. Suy tỉnh từ hồ sơ tổ chức ────────────────────────────────────────────
-- Bê nguyên khối COALESCE 4 nhánh của resolve_campaign_audience
-- (20260711000001_marketing_campaigns.sql): organizations → auction_organizations,
-- organization_memberships, asset_owner_org_kyc, asset_postings. Khách mua không
-- gắn tổ chức → NULL (báo cáo hiển thị "Không rõ").
CREATE OR REPLACE FUNCTION public.user_province(uid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ao.province FROM organizations o
       JOIN auction_organizations ao ON ao.id::text = (o.license_info ->> 'auction_org_id')
      WHERE o.owner_id = uid AND ao.province IS NOT NULL LIMIT 1),
    (SELECT ao.province FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id
       JOIN auction_organizations ao ON ao.id::text = (o.license_info ->> 'auction_org_id')
      WHERE m.user_id = uid AND ao.province IS NOT NULL LIMIT 1),
    (SELECT ao.province FROM asset_owner_org_kyc ok
       JOIN auction_organizations ao ON ao.id = ok.linked_auction_org_id
      WHERE ok.created_by = uid AND ao.province IS NOT NULL LIMIT 1),
    (SELECT ap.province FROM asset_postings ap
      WHERE ap.user_id = uid AND ap.province IS NOT NULL
      ORDER BY ap.created_at DESC LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.analytics_events_fill_province()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.province IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.province := public.user_province(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_events_province ON public.analytics_events;
CREATE TRIGGER trg_analytics_events_province
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.analytics_events_fill_province();

-- ─── 4. RPC tổng hợp (ADMIN only) ────────────────────────────────────────────
-- Trả 1 JSONB gồm mọi phần báo cáo. Bucket theo day/week/month bằng date_trunc
-- (week theo ISO = thứ 2, khớp date-fns weekStartsOn:1). Zero-fill trục thời gian
-- làm ở client (tái dùng enumerateBuckets). "theo người" = distinct
-- COALESCE(user_id, session_id); tỉnh NULL → "Không rõ".
CREATE OR REPLACE FUNCTION public.admin_access_report(
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

  trunc := CASE _granularity WHEN 'month' THEN 'month' WHEN 'week' THEN 'week' ELSE 'day' END;

  SELECT jsonb_build_object(
    -- Lượt truy cập (distinct session) + page views theo thời gian
    'timeseries', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.bucket)
      FROM (
        SELECT
          date_trunc(trunc, created_at)                          AS bucket,
          count(DISTINCT session_id)                             AS visits,
          count(*) FILTER (WHERE event_type = 'page_view')       AS page_views,
          count(DISTINCT user_id)                                AS unique_users
        FROM public.analytics_events
        WHERE created_at >= _from AND created_at <= _to
        GROUP BY 1
      ) t
    ), '[]'::jsonb),

    -- Tổng truy cập theo từng page
    'topPages', COALESCE((
      SELECT jsonb_agg(p ORDER BY p.views DESC)
      FROM (
        SELECT
          path                                                   AS path,
          count(*)                                               AS views,
          count(DISTINCT COALESCE(user_id::text, session_id))    AS unique_users
        FROM public.analytics_events
        WHERE event_type = 'page_view' AND path IS NOT NULL
          AND created_at >= _from AND created_at <= _to
        GROUP BY path
        ORDER BY views DESC
        LIMIT 20
      ) p
    ), '[]'::jsonb),

    -- Tính năng dùng nhiều nhất (theo lượt + theo người)
    'byFeature', COALESCE((
      SELECT jsonb_agg(f ORDER BY f.count DESC)
      FROM (
        SELECT
          feature_key                                            AS feature_key,
          count(*)                                               AS count,
          count(DISTINCT COALESCE(user_id::text, session_id))    AS unique_users
        FROM public.analytics_events
        WHERE event_type = 'feature' AND feature_key IS NOT NULL
          AND created_at >= _from AND created_at <= _to
        GROUP BY feature_key
      ) f
    ), '[]'::jsonb),

    -- Thiết bị
    'byDevice', COALESCE((
      SELECT jsonb_agg(d ORDER BY d.count DESC)
      FROM (
        SELECT COALESCE(device_type, 'unknown') AS device_type, count(*) AS count
        FROM public.analytics_events
        WHERE created_at >= _from AND created_at <= _to
        GROUP BY 1
      ) d
    ), '[]'::jsonb),

    -- Địa lý (tỉnh)
    'byProvince', COALESCE((
      SELECT jsonb_agg(pr ORDER BY pr.count DESC)
      FROM (
        SELECT COALESCE(province, 'Không rõ') AS province, count(*) AS count
        FROM public.analytics_events
        WHERE created_at >= _from AND created_at <= _to
        GROUP BY 1
      ) pr
    ), '[]'::jsonb),

    -- Funnel: truy cập → đăng ký → kích hoạt → tiêu credit
    'funnel', jsonb_build_object(
      'visitors', (
        SELECT count(DISTINCT session_id) FROM public.analytics_events
        WHERE created_at >= _from AND created_at <= _to
      ),
      'registrations', (
        SELECT count(*) FROM public.profiles
        WHERE created_at >= _from AND created_at <= _to
      ),
      'activations', (
        SELECT count(*) FROM public.profiles
        WHERE activated_at IS NOT NULL AND activated_at >= _from AND activated_at <= _to
      ),
      'spenders', (
        SELECT count(DISTINCT user_id) FROM public.credit_transactions
        WHERE credit_delta < 0 AND created_at >= _from AND created_at <= _to
      )
    ),

    -- KPI tổng
    'kpis', jsonb_build_object(
      'totalVisits', (
        SELECT count(DISTINCT session_id) FROM public.analytics_events
        WHERE created_at >= _from AND created_at <= _to
      ),
      'totalPageViews', (
        SELECT count(*) FROM public.analytics_events
        WHERE event_type = 'page_view' AND created_at >= _from AND created_at <= _to
      ),
      'uniqueUsers', (
        SELECT count(DISTINCT user_id) FROM public.analytics_events
        WHERE user_id IS NOT NULL AND created_at >= _from AND created_at <= _to
      ),
      'featureEvents', (
        SELECT count(*) FROM public.analytics_events
        WHERE event_type = 'feature' AND created_at >= _from AND created_at <= _to
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_access_report(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

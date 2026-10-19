-- Phase 6 của docs/auction-platform-split-plan.md — admin hợp nhất nhìn được sàn đấu giá.
--
-- 1. analytics_events.platform ('info' | 'auction'): taisanviet ghi chung bảng này nên
--    báo cáo /admin/bao-cao/truy-cap phải tách được hai nền tảng. DEFAULT 'info' ⇒ bản
--    taisandaugia đang chạy (không gửi cột) vẫn ghi đúng; mọi dòng cũ là của INFO.
-- 2. admin_access_report(..., _platform) — NULL = gộp cả hai (đúng hành vi cũ). Phễu
--    theo nền tảng: INFO = truy cập → đăng ký → kích hoạt → tiêu credit; sàn = truy cập
--    → đăng ký trên sàn (profiles.signup_platform) → nộp hồ sơ → đã nộp phí hồ sơ.
-- 3. Giám sát phiên (chỉ đọc) /admin/phien-dau-gia: admin_auction_sessions() +
--    admin_auction_session_detail(id), module RBAC admin "phien-dau-gia:view".
--    Hai hàm này là READ CONTRACT mới (INFO đọc bảng AUC) — ghi ở manifest §3.
--    Không có ghi: thao tác phiên thuộc về tổ chức trên sàn.

-- ─── 1. analytics_events.platform ───────────────────────────────────────────
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'info';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.analytics_events'::regclass AND conname = 'analytics_events_platform_check'
  ) THEN
    ALTER TABLE public.analytics_events
      ADD CONSTRAINT analytics_events_platform_check CHECK (platform IN ('info', 'auction'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_platform_created
  ON public.analytics_events (platform, created_at DESC);

-- ─── 2. admin_access_report theo nền tảng ───────────────────────────────────
-- Đổi chữ ký ⇒ DROP bản 3 tham số. Bản đang chạy gọi bằng tham số có tên
-- (_from, _to, _granularity) ⇒ vẫn khớp hàm mới nhờ DEFAULT của _platform.
DROP FUNCTION IF EXISTS public.admin_access_report(timestamptz, timestamptz, text);

CREATE OR REPLACE FUNCTION public.admin_access_report(
  _from        timestamptz,
  _to          timestamptz,
  _granularity text DEFAULT 'day',
  _platform    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  trunc  TEXT;
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _platform IS NOT NULL AND _platform NOT IN ('info', 'auction') THEN
    RAISE EXCEPTION 'invalid platform %', _platform;
  END IF;

  trunc := CASE _granularity WHEN 'month' THEN 'month' WHEN 'week' THEN 'week' ELSE 'day' END;

  WITH ev AS (
    SELECT *
      FROM public.analytics_events
     WHERE created_at >= _from AND created_at <= _to
       AND (_platform IS NULL OR platform = _platform)
  )
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
        FROM ev
        GROUP BY 1
      ) t
    ), '[]'::jsonb),

    -- Tổng truy cập theo từng page (cùng path ở hai nền tảng là hai trang khác nhau)
    'topPages', COALESCE((
      SELECT jsonb_agg(p ORDER BY p.views DESC)
      FROM (
        SELECT
          platform                                               AS platform,
          path                                                   AS path,
          count(*)                                               AS views,
          count(DISTINCT COALESCE(user_id::text, session_id))    AS unique_users
        FROM ev
        WHERE event_type = 'page_view' AND path IS NOT NULL
        GROUP BY platform, path
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
        FROM ev
        WHERE event_type = 'feature' AND feature_key IS NOT NULL
        GROUP BY feature_key
      ) f
    ), '[]'::jsonb),

    -- Thiết bị
    'byDevice', COALESCE((
      SELECT jsonb_agg(d ORDER BY d.count DESC)
      FROM (
        SELECT COALESCE(device_type, 'unknown') AS device_type, count(*) AS count
        FROM ev
        GROUP BY 1
      ) d
    ), '[]'::jsonb),

    -- Địa lý (tỉnh)
    'byProvince', COALESCE((
      SELECT jsonb_agg(pr ORDER BY pr.count DESC)
      FROM (
        SELECT COALESCE(province, 'Không rõ') AS province, count(*) AS count
        FROM ev
        GROUP BY 1
      ) pr
    ), '[]'::jsonb),

    -- Phễu. Sàn không có kích hoạt / credit ⇒ bậc riêng: hồ sơ tham gia.
    'funnel', CASE WHEN _platform = 'auction' THEN jsonb_build_object(
      'visitors', (SELECT count(DISTINCT session_id) FROM ev),
      'registrations', (
        SELECT count(*) FROM public.profiles
        WHERE signup_platform = 'auction' AND created_at >= _from AND created_at <= _to
      ),
      'dossiers', (
        SELECT count(DISTINCT user_id) FROM public.auction_bidding_contracts
        WHERE created_at >= _from AND created_at <= _to
      ),
      'paidDossiers', (
        SELECT count(DISTINCT user_id) FROM public.auction_bidding_contracts
        WHERE paid_at IS NOT NULL AND paid_at >= _from AND paid_at <= _to
      )
    ) ELSE jsonb_build_object(
      'visitors', (SELECT count(DISTINCT session_id) FROM ev),
      -- INFO: mọi tài khoản không đăng ký từ sàn (NULL = OAuth chưa nhận nền tảng).
      'registrations', (
        SELECT count(*) FROM public.profiles
        WHERE created_at >= _from AND created_at <= _to
          AND (_platform IS NULL OR signup_platform IS DISTINCT FROM 'auction')
      ),
      'activations', (
        SELECT count(*) FROM public.profiles
        WHERE activated_at IS NOT NULL AND activated_at >= _from AND activated_at <= _to
      ),
      'spenders', (
        SELECT count(DISTINCT user_id) FROM public.credit_transactions
        WHERE credit_delta < 0 AND created_at >= _from AND created_at <= _to
      )
    ) END,

    -- KPI tổng
    'kpis', jsonb_build_object(
      'totalVisits',    (SELECT count(DISTINCT session_id) FROM ev),
      'totalPageViews', (SELECT count(*) FROM ev WHERE event_type = 'page_view'),
      'uniqueUsers',    (SELECT count(DISTINCT user_id) FROM ev WHERE user_id IS NOT NULL),
      'featureEvents',  (SELECT count(*) FROM ev WHERE event_type = 'feature')
    )
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_access_report(timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_access_report(timestamptz, timestamptz, text, text) TO authenticated, service_role;

-- ─── 3. Giám sát phiên đấu giá (chỉ đọc) ─────────────────────────────────────
-- Danh sách mọi phiên (kể cả nháp / đã huỷ — trang công khai của sàn không hiện
-- được). Đếm gộp sẵn để trang không phải đọc thẳng bảng AUC.
CREATE OR REPLACE FUNCTION public.admin_auction_sessions(_limit integer DEFAULT 500)
RETURNS TABLE (
  id                  uuid,
  code                text,
  title               text,
  status              text,
  auction_format      text,
  bidding_method      text,
  province            text,
  org_name            text,
  registration_end_at timestamptz,
  starts_at           timestamptz,
  ends_at             timestamptz,
  published_at        timestamptz,
  finalized_at        timestamptz,
  cancelled_reason    text,
  created_at          timestamptz,
  lot_count           integer,
  live_lot_count      integer,
  closed_lot_count    integer,
  sold_lot_count      integer,
  dossier_count       integer,
  paid_dossier_count  integer,
  checked_in_count    integer,
  sale_contract_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.admin_has_permission('phien-dau-gia', 'view') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.code, s.title, s.status, s.auction_format, s.bidding_method, s.province,
    COALESCE(ao.name, o.name)                                                     AS org_name,
    s.registration_end_at, s.starts_at, s.ends_at, s.published_at, s.finalized_at,
    s.cancelled_reason, s.created_at,
    (SELECT count(*)::int FROM auction_session_items i WHERE i.session_id = s.id) AS lot_count,
    (SELECT count(*)::int FROM auction_lot_states l
      WHERE l.session_id = s.id AND l.status IN ('open', 'paused', 'tied'))       AS live_lot_count,
    (SELECT count(*)::int FROM auction_lot_states l
      WHERE l.session_id = s.id AND l.status IN ('closed', 'withdrawn'))          AS closed_lot_count,
    (SELECT count(*)::int FROM auction_lot_states l
      WHERE l.session_id = s.id AND l.result = 'sold')                            AS sold_lot_count,
    (SELECT count(*)::int FROM auction_bidding_contracts c
      WHERE c.session_id = s.id AND c.status <> 'cancelled')                      AS dossier_count,
    (SELECT count(*)::int FROM auction_bidding_contracts c
      WHERE c.session_id = s.id AND c.status IN ('paid', 'refunded'))             AS paid_dossier_count,
    (SELECT count(*)::int FROM auction_bidding_contracts c
      WHERE c.session_id = s.id AND c.checked_in_at IS NOT NULL)                  AS checked_in_count,
    (SELECT count(*)::int FROM auction_sale_contracts sc
      WHERE sc.session_id = s.id AND sc.status <> 'cancelled')                    AS sale_contract_count
  FROM auction_sessions s
  LEFT JOIN auction_organizations ao ON ao.id = s.auction_org_id
  LEFT JOIN organizations o           ON o.id = s.organization_id
  ORDER BY s.starts_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 500), 2000));
END;
$function$;

-- Một phiên: thông tin + từng lô với trạng thái điều hành sống + tổng hồ sơ + HĐ mua bán.
-- KHÔNG trả dữ liệu cá nhân người mua (CCCD, SĐT…): giám sát chỉ cần số đếm.
CREATE OR REPLACE FUNCTION public.admin_auction_session_detail(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.admin_has_permission('phien-dau-gia', 'view') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id, 'code', s.code, 'title', s.title, 'status', s.status,
      'auction_format', s.auction_format, 'bidding_method', s.bidding_method,
      'venue', s.venue, 'province', s.province,
      'org_name', COALESCE(ao.name, o.name), 'organization_id', s.organization_id,
      'registration_start_at', s.registration_start_at, 'registration_end_at', s.registration_end_at,
      'starts_at', s.starts_at, 'ends_at', s.ends_at, 'dossier_fee', s.dossier_fee,
      'published_at', s.published_at, 'roster_closed_at', s.roster_closed_at,
      'finalized_at', s.finalized_at, 'cancelled_reason', s.cancelled_reason,
      'created_at', s.created_at, 'updated_at', s.updated_at
    ),
    'lots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'lot_no', i.lot_no, 'title', i.title,
        'starting_price', i.starting_price, 'deposit_amount', i.deposit_amount,
        'state', l.status, 'current_price', l.current_price, 'bid_count', COALESCE(l.bid_count, 0),
        'leading_bidder_no', l.leading_bidder_no, 'round_no', l.round_no,
        'opened_at', l.opened_at, 'ends_at', l.ends_at, 'closed_at', l.closed_at,
        'result', l.result, 'winning_amount', l.winning_amount, 'payment_status', l.payment_status
      ) ORDER BY i.lot_no)
      FROM auction_session_items i
      LEFT JOIN auction_lot_states l ON l.lot_id = i.id
      WHERE i.session_id = s.id
    ), '[]'::jsonb),
    'dossiers', (
      SELECT jsonb_build_object(
        'total',            count(*),
        'pending_payment',  count(*) FILTER (WHERE c.status = 'pending_payment'),
        'paid',             count(*) FILTER (WHERE c.status = 'paid'),
        'refunded',         count(*) FILTER (WHERE c.status = 'refunded'),
        'cancelled',        count(*) FILTER (WHERE c.status = 'cancelled'),
        'review_pending',   count(*) FILTER (WHERE c.status = 'paid' AND c.review_status = 'pending'),
        'needs_info',       count(*) FILTER (WHERE c.review_status = 'needs_info'),
        'approved',         count(*) FILTER (WHERE c.review_status = 'approved'),
        'rejected',         count(*) FILTER (WHERE c.review_status = 'rejected'),
        'deposit_received', count(*) FILTER (WHERE c.deposit_status <> 'pending'),
        'checked_in',       count(*) FILTER (WHERE c.checked_in_at IS NOT NULL),
        'absent',           count(*) FILTER (WHERE c.absent_at IS NOT NULL)
      )
      FROM auction_bidding_contracts c
      WHERE c.session_id = s.id
    ),
    'sale_contracts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sc.id, 'code', sc.code, 'lot_id', sc.lot_id, 'status', sc.status,
        'price', sc.price, 'created_at', sc.created_at
      ) ORDER BY sc.created_at)
      FROM auction_sale_contracts sc
      WHERE sc.session_id = s.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM auction_sessions s
  LEFT JOIN auction_organizations ao ON ao.id = s.auction_org_id
  LEFT JOIN organizations o           ON o.id = s.organization_id
  WHERE s.id = _session_id;

  RETURN result; -- NULL ⇒ không có phiên
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_auction_sessions(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_auction_session_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_auction_sessions(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_auction_session_detail(uuid) TO authenticated, service_role;

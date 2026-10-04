-- Báo cáo kết quả đơn "Giao việc cho sàn" (owner_mkt_orders, Phase M4).
--
-- Chủ tài sản cần thấy sàn ĐÃ LÀM GÌ và KẾT QUẢ RA SAO, không chỉ một dòng ghi chú:
--   1. analytics_events.listing_id cho lượt xem trang /listings/:id — trước đây page_view bị gộp về
--      "/listings/:id" nên không đếm được lượt xem theo tài sản. Frontend gửi kèm listing_id từ nay.
--   2. owner_mkt_orders.post_metrics — số liệu bài đăng fanpage (tiếp cận / tương tác / lượt bấm) do
--      sàn nhập tay: Facebook không cho sàn đọc tự động.
--   3. owner_mkt_order_impact — tác động lên tài sản trong thời gian sàn chạy (lượt xem, người xem,
--      lượt lưu, hồ sơ đăng ký) so với khoảng ngay trước đó cùng độ dài, kèm lượt xem theo ngày.
--      Thành viên Trạm tự xem / lưu tài sản của mình không tính.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Lượt xem theo tài sản
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS analytics_events_listing_created_idx
  ON public.analytics_events (listing_id, created_at)
  WHERE listing_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Số liệu bài đăng do sàn nhập
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.owner_mkt_orders ADD COLUMN post_metrics JSONB;

COMMENT ON COLUMN public.owner_mkt_orders.post_metrics IS
  'Số liệu bài đăng MXH do sàn nhập: {reach, engagements, clicks, updated_at}. NULL = chưa nhập.';

-- Nhập / sửa số liệu bài đăng (đang thực hiện hoặc đã hoàn tất). Lỗi: forbidden · not_found ·
-- invalid_status · invalid_number.
CREATE FUNCTION public.admin_mkt_order_set_post_metrics(
  p_order_id UUID, p_reach INTEGER, p_engagements INTEGER, p_clicks INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o public.owner_mkt_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-truyen-thong', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_o.status NOT IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_o.status);
  END IF;
  IF p_reach IS NULL OR p_engagements IS NULL OR p_clicks IS NULL
     OR p_reach < 0 OR p_engagements < 0 OR p_clicks < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_number');
  END IF;

  UPDATE public.owner_mkt_orders
     SET post_metrics = jsonb_build_object('reach', p_reach, 'engagements', p_engagements,
                                           'clicks', p_clicks, 'updated_at', now())
   WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Tác động lên tài sản
-- ═══════════════════════════════════════════════════════════════════════════

-- Khoảng chạy: tin nổi bật = thời gian nổi bật; gói khác = nhận việc → hoàn tất (đang chạy: → bây giờ).
-- Khoảng so sánh: ngay trước khoảng chạy, cùng độ dài. NULL khi chưa nhận việc / không có quyền.
CREATE FUNCTION public.owner_mkt_order_impact(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_o     public.owner_mkt_orders%ROWTYPE;
  v_from  TIMESTAMPTZ;
  v_to    TIMESTAMPTZ;
  v_len   INTERVAL;
  v_pfrom TIMESTAMPTZ;
  v_cur   JSONB;
  v_prev  JSONB;
  v_daily JSONB;
BEGIN
  SELECT * INTO v_o FROM public.owner_mkt_orders WHERE id = p_order_id;
  IF NOT FOUND OR auth.uid() IS NULL
     OR NOT (public.owner_ws_can(v_o.workspace_id, 'read')
             OR public.admin_has_permission('don-truyen-thong', 'view')) THEN
    RETURN NULL;
  END IF;
  IF v_o.status NOT IN ('in_progress', 'completed') OR v_o.started_at IS NULL OR v_o.listing_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_o.featured_from IS NOT NULL THEN
    v_from := v_o.featured_from;
    v_to   := LEAST(COALESCE(v_o.featured_until, now()), now());
  ELSE
    v_from := v_o.started_at;
    v_to   := LEAST(COALESCE(v_o.completed_at, now()), now());
  END IF;
  IF v_to <= v_from THEN
    v_to := v_from + interval '1 hour';
  END IF;
  v_len   := v_to - v_from;
  v_pfrom := v_from - v_len;

  WITH members AS (
    SELECT m.user_id FROM public.asset_owner_workspace_members m
     WHERE m.workspace_id = v_o.workspace_id AND m.status <> 'removed'
  ),
  views AS (
    SELECT e.created_at, e.session_id
      FROM public.analytics_events e
     WHERE e.listing_id = v_o.listing_id
       AND e.event_type = 'page_view'
       AND e.created_at >= v_pfrom - GREATEST(interval '14 days' - v_len, interval '0')
       AND e.created_at < v_to
       AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM members))
  ),
  saves AS (
    SELECT a.created_at FROM public.user_asset_actions a
     WHERE a.listing_id = v_o.listing_id AND a.is_saved
       AND a.created_at >= v_pfrom AND a.created_at < v_to
       AND a.user_id NOT IN (SELECT user_id FROM members)
  ),
  regs AS (
    SELECT DISTINCT b.id, b.paid_at
      FROM public.auction_session_items i
      JOIN public.auction_bidding_contracts b ON b.session_id = i.session_id
     WHERE i.listing_id = v_o.listing_id AND b.status = 'paid'
       AND b.paid_at >= v_pfrom AND b.paid_at < v_to
  )
  SELECT
    jsonb_build_object(
      'views',         (SELECT count(*) FROM views WHERE created_at >= v_from),
      'visitors',      (SELECT count(DISTINCT session_id) FROM views WHERE created_at >= v_from),
      'saves',         (SELECT count(*) FROM saves WHERE created_at >= v_from),
      'registrations', (SELECT count(*) FROM regs WHERE paid_at >= v_from)),
    jsonb_build_object(
      'views',         (SELECT count(*) FROM views WHERE created_at >= v_pfrom AND created_at < v_from),
      'visitors',      (SELECT count(DISTINCT session_id) FROM views WHERE created_at >= v_pfrom AND created_at < v_from),
      'saves',         (SELECT count(*) FROM saves WHERE created_at < v_from),
      'registrations', (SELECT count(*) FROM regs WHERE paid_at < v_from)),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day::date, 'views', COALESCE(c.n, 0)) ORDER BY d.day), '[]'::jsonb)
       FROM generate_series(
              ((v_pfrom - GREATEST(interval '14 days' - v_len, interval '0')) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
              (v_to AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, interval '1 day') AS d(day)
       LEFT JOIN (SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, count(*)::int AS n
                    FROM views GROUP BY 1) c ON c.day = d.day::date)
    INTO v_cur, v_prev, v_daily;

  RETURN jsonb_build_object(
    'window',   jsonb_build_object('from', v_from, 'to', v_to, 'running', v_to >= now() - interval '1 minute'),
    'baseline', jsonb_build_object('from', v_pfrom, 'to', v_from),
    'current',  v_cur,
    'previous', v_prev,
    'daily',    v_daily);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mkt_order_set_post_metrics(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mkt_order_impact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mkt_order_set_post_metrics(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mkt_order_impact(UUID) TO authenticated;

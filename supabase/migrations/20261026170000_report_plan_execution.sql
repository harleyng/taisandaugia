-- Phase 8 của docs/owner-auction-planning-plan.md — "Thực hiện kế hoạch đấu giá" trong
-- báo cáo định kỳ (payload v2).
--
-- 1. owner_report_plan_execution(ws, period_type, period_start, branch) — phần mới của payload.
--    Số liệu LẤY NGUYÊN từ auction_plan_period_metrics (bản nhân bản SQL ↔ TS thứ sáu, tab
--    "Theo kỳ") và auction_plan_item_health_rows — KHÔNG tính lại chỉ số nào, nên báo cáo và
--    tab "Theo kỳ" không thể lệch nhau.
-- 2. owner_build_report_payload: 'version' 1 → 2 và ghép thêm khoá 'plan_execution'.
--    Thân hàm là bản ĐANG CHẠY, chụp bằng pg_get_functiondef ngay trước khi áp (bẫy 01/10:
--    dựng lại hàm dùng chung từ file migration cũ làm rơi thay đổi của phiên khác).
--    Báo cáo ĐÃ CHỐT giữ nguyên payload v1 trong cột payload — không migration nào chạm vào.
-- 3. owner_report_public_payload: thêm 'plan_execution' vào danh sách trắng của link /r/:token.
--    Mọi khoá id / người phụ trách đã bị owner_report_strip_private loại (quy tắc `_ids?$`),
--    và phần này KHÔNG mang bất kỳ URL nào (không approval_doc_urls, không evidence_urls).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Phần "Thực hiện kế hoạch đấu giá"
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_report_plan_execution(
  p_workspace_id UUID,
  p_period_type  TEXT,
  p_period_start DATE,
  p_branch_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_as_of  DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;
  v_year   INT;
  v_months INT;
  v_end    DATE;
  v_result JSONB;
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_months := CASE p_period_type WHEN 'month' THEN 1 WHEN 'quarter' THEN 3 WHEN 'year' THEN 12 END;
  IF v_months IS NULL OR p_period_start IS NULL THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = '22023';
  END IF;
  v_end  := (p_period_start + make_interval(months => v_months))::DATE - 1;
  v_year := extract(year FROM p_period_start)::INT;

  WITH
  -- Kế hoạch trong phạm vi báo cáo: ĐÃ TỪNG DUYỆT (approved / adjusting / closed) của đúng
  -- năm của kỳ. auction_plan_read_ok là cổng đọc của module (hẹp hơn owner_ws_can): cán bộ
  -- bị giới hạn chi nhánh không thấy kế hoạch của xã khác, kể cả trong báo cáo toàn đơn vị.
  pl AS (
    SELECT p.id, p.title, p.kind, p.status, p.plan_year, p.branch_id, p.admin_unit_code,
           p.baseline_version, p.approval_doc_no, p.approval_doc_date,
           COALESCE(au.name, p.admin_unit_code)                                   AS unit_name,
           COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name)                   AS branch_name
      FROM public.auction_plans p
      LEFT JOIN public.admin_units au ON au.code = p.admin_unit_code
      LEFT JOIN public.workspace_branches wb ON wb.id = p.branch_id
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE p.workspace_id = p_workspace_id
       AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
       AND p.plan_year = v_year
       AND p.status IN ('approved', 'adjusting', 'closed')
       AND public.auction_plan_read_ok(p.workspace_id, p.branch_id, p.id)
  ),
  -- Chỉ số của kỳ — ĐÚNG hàm mà tab "Theo kỳ" đọc.
  met AS (
    SELECT pl.id,
           COALESCE(m.planned_count, 0)        AS planned_count,
           COALESCE(m.planned_start_value, 0)  AS planned_start_value,
           COALESCE(m.offered_count, 0)        AS offered_count,
           COALESCE(m.sold_count, 0)           AS sold_count,
           COALESCE(m.actual_start_value, 0)   AS actual_start_value,
           COALESCE(m.winning_total, 0)        AS winning_total,
           COALESCE(m.collected, 0)            AS collected,
           COALESCE(m.recorded, 0)             AS recorded,
           COALESCE(m.estimated, 0)            AS estimated,
           COALESCE(m.awaiting, 0)             AS awaiting,
           m.done_pct
      FROM pl
      LEFT JOIN LATERAL public.auction_plan_period_metrics(pl.id, p_period_type, p_period_start) m ON TRUE
  ),
  -- Sức khoẻ từng tài sản tính đến NGÀY LẬP (as_of), như các phần theo trạng thái khác của payload.
  it AS (
    SELECT pl.id                AS plan_id,
           h.item_id,
           h.item_code,
           h.health,
           h.baseline_month,
           h.forecast_month,
           h.steps_done,
           h.steps_total,
           i.seq,
           i.title,
           i.forecast_reason,
           i.exec_note
      FROM pl
      CROSS JOIN LATERAL public.auction_plan_item_health_rows(pl.id, v_as_of) h
      JOIN public.auction_plan_items i ON i.id = h.item_id
  ),
  -- Mốc quá hạn SỚM NHẤT của tài sản (đúng biên của A5: đến hạn hôm nay chưa tính là quá hạn).
  od AS (
    SELECT DISTINCT ON (s.item_id) s.item_id, s.step, s.planned_date, s.note
      FROM public.auction_plan_item_steps s
     WHERE s.item_id IN (SELECT item_id FROM it)
       AND s.done_on IS NULL
       AND s.planned_date IS NOT NULL
       AND s.planned_date < v_as_of
     ORDER BY s.item_id, s.planned_date, s.sort_order
  ),
  cnt AS (
    SELECT it.plan_id,
           count(*)::INT                                                        AS item_count,
           count(*) FILTER (WHERE it.health = 'late')::INT                       AS late_count,
           count(*) FILTER (WHERE it.health = 'at_risk')::INT                    AS at_risk_count,
           count(*) FILTER (WHERE it.health = 'failed_retry')::INT               AS failed_retry_count,
           count(*) FILTER (WHERE it.forecast_month IS NOT NULL
                              AND it.baseline_month IS NOT NULL
                              AND it.forecast_month <> it.baseline_month)::INT   AS moved_count
      FROM it
     GROUP BY it.plan_id
  ),
  pr AS (
    SELECT pl.id,
           jsonb_build_object(
             'title',              pl.title,
             'unit_name',          pl.unit_name,
             'branch_name',        pl.branch_name,
             'admin_unit_code',    pl.admin_unit_code,
             'kind',               pl.kind,
             'status',             pl.status,
             'plan_year',          pl.plan_year,
             'baseline_version',   pl.baseline_version,
             'approval_doc_no',    pl.approval_doc_no,
             'approval_doc_date',  pl.approval_doc_date,
             'item_count',         COALESCE(cnt.item_count, 0),
             'late_count',         COALESCE(cnt.late_count, 0),
             'at_risk_count',      COALESCE(cnt.at_risk_count, 0),
             'failed_retry_count', COALESCE(cnt.failed_retry_count, 0),
             'moved_count',        COALESCE(cnt.moved_count, 0),
             'metrics', jsonb_build_object(
               'planned_count',       met.planned_count,
               'planned_start_value', met.planned_start_value,
               'offered_count',       met.offered_count,
               'sold_count',          met.sold_count,
               'actual_start_value',  met.actual_start_value,
               'winning_total',       met.winning_total,
               'collected',           met.collected,
               'recorded',            met.recorded,
               'estimated',           met.estimated,
               'awaiting',            met.awaiting,
               'done_pct',            met.done_pct),
             -- Tài sản trễ / nguy cơ trễ kèm LÝ DO (vì sao dời tháng, ghi chú thực hiện, mốc quá hạn).
             'attention', (
               SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'item_code',         x.item_code,
                        'title',             x.title,
                        'health',            x.health,
                        'baseline_month',    x.baseline_month,
                        'forecast_month',    x.forecast_month,
                        'steps_done',        x.steps_done,
                        'steps_total',       x.steps_total,
                        'forecast_reason',   x.forecast_reason,
                        'exec_note',         x.exec_note,
                        'overdue_step',      o.step,
                        'overdue_step_date', o.planned_date,
                        'overdue_step_note', o.note
                      ) ORDER BY array_position(ARRAY['late', 'at_risk'], x.health), x.baseline_month, x.seq), '[]'::jsonb)
                 FROM it x
                 LEFT JOIN od o ON o.item_id = x.item_id
                WHERE x.plan_id = pl.id AND x.health IN ('late', 'at_risk')
             ),
             -- Dời tháng dự kiến so với bản mốc.
             'forecast_moves', (
               SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'item_code',      x.item_code,
                        'title',          x.title,
                        'health',         x.health,
                        'baseline_month', x.baseline_month,
                        'forecast_month', x.forecast_month,
                        'reason',         x.forecast_reason
                      ) ORDER BY x.forecast_month, x.seq), '[]'::jsonb)
                 FROM it x
                WHERE x.plan_id = pl.id
                  AND x.forecast_month IS NOT NULL
                  AND x.baseline_month IS NOT NULL
                  AND x.forecast_month <> x.baseline_month
             )
           ) AS doc,
           pl.unit_name, pl.branch_name, pl.admin_unit_code
      FROM pl
      JOIN met ON met.id = pl.id
      LEFT JOIN cnt ON cnt.plan_id = pl.id
  )
  SELECT jsonb_build_object(
           'as_of',  v_as_of,
           'period', jsonb_build_object('type', p_period_type, 'start', p_period_start, 'end', v_end),
           'totals', (
             SELECT jsonb_build_object(
                      'plans',               count(*)::INT,
                      'planned_count',       COALESCE(sum((r.doc->'metrics'->>'planned_count')::INT), 0),
                      'planned_start_value', COALESCE(sum((r.doc->'metrics'->>'planned_start_value')::NUMERIC), 0),
                      'offered_count',       COALESCE(sum((r.doc->'metrics'->>'offered_count')::INT), 0),
                      'sold_count',          COALESCE(sum((r.doc->'metrics'->>'sold_count')::INT), 0),
                      'actual_start_value',  COALESCE(sum((r.doc->'metrics'->>'actual_start_value')::NUMERIC), 0),
                      'winning_total',       COALESCE(sum((r.doc->'metrics'->>'winning_total')::NUMERIC), 0),
                      'collected',           COALESCE(sum((r.doc->'metrics'->>'collected')::NUMERIC), 0),
                      'recorded',            COALESCE(sum((r.doc->'metrics'->>'recorded')::NUMERIC), 0),
                      'estimated',           COALESCE(sum((r.doc->'metrics'->>'estimated')::NUMERIC), 0),
                      'awaiting',            COALESCE(sum((r.doc->'metrics'->>'awaiting')::NUMERIC), 0),
                      'done_pct',            CASE WHEN COALESCE(sum((r.doc->'metrics'->>'planned_count')::INT), 0) > 0
                                                  THEN floor(COALESCE(sum((r.doc->'metrics'->>'sold_count')::INT), 0) * 100.0
                                                             / sum((r.doc->'metrics'->>'planned_count')::INT))::INT END,
                      'item_count',          COALESCE(sum((r.doc->>'item_count')::INT), 0),
                      'late_count',          COALESCE(sum((r.doc->>'late_count')::INT), 0),
                      'at_risk_count',       COALESCE(sum((r.doc->>'at_risk_count')::INT), 0),
                      'failed_retry_count',  COALESCE(sum((r.doc->>'failed_retry_count')::INT), 0),
                      'moved_count',         COALESCE(sum((r.doc->>'moved_count')::INT), 0))
               FROM pr r
           ),
           'plans', (
             SELECT COALESCE(jsonb_agg(r.doc ORDER BY r.admin_unit_code, r.unit_name, r.branch_name), '[]'::jsonb)
               FROM pr r
           )
         )
    INTO v_result;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.owner_report_plan_execution(UUID, TEXT, DATE, UUID) IS
  'Phần "Thực hiện kế hoạch đấu giá" của payload báo cáo định kỳ v2 (Phase 8). Số liệu lấy nguyên từ auction_plan_period_metrics + auction_plan_item_health_rows. Không mang id, người phụ trách hay URL tài liệu.';

REVOKE ALL ON FUNCTION public.owner_report_plan_execution(UUID, TEXT, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_report_plan_execution(UUID, TEXT, DATE, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. owner_build_report_payload — payload v2 (thân hàm = bản LIVE lúc áp + 2 thay đổi)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_build_report_payload(p_workspace_id uuid, p_period_type text, p_period_start date, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  c_stuck_rounds CONSTANT INT := 3;
  c_stuck_days   CONSTANT INT := 90;
  v_months     INT;
  v_end        DATE;
  v_next_start DATE;
  v_next_end   DATE;
  v_as_of      DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_unit       TEXT;
  v_scope_name TEXT;
  v_result     JSONB;
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_months := CASE p_period_type WHEN 'month' THEN 1 WHEN 'quarter' THEN 3 WHEN 'year' THEN 12 END;
  IF v_months IS NULL OR p_period_start IS NULL
     OR extract(day FROM p_period_start) <> 1
     OR (p_period_type = 'quarter' AND extract(month FROM p_period_start) NOT IN (1, 4, 7, 10))
     OR (p_period_type = 'year' AND extract(month FROM p_period_start) <> 1) THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = '22023';
  END IF;
  v_end        := (p_period_start + make_interval(months => v_months))::date - 1;
  v_next_start := v_end + 1;
  v_next_end   := (v_next_start + make_interval(months => v_months))::date - 1;

  SELECT w.primary_name INTO v_unit FROM public.asset_owner_workspaces w WHERE w.id = p_workspace_id;

  IF p_branch_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên')
      INTO v_scope_name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.id = p_branch_id AND wb.workspace_id = p_workspace_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_branch' USING ERRCODE = '22023';
    END IF;
  END IF;

  WITH
  br AS (
    SELECT wb.id, COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên') AS name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.workspace_id = p_workspace_id
  ),
  -- Mọi tài sản có kết quả của phạm vi (chi nhánh suy từ claim, như trang Kết quả phiên).
  ov AS MATERIALIZED (
    SELECT o.*,
           br.name AS branch_name,
           CASE WHEN o.listing_id IS NOT NULL THEN upper(left(o.listing_id::text, 8)) END AS asset_code,
           COALESCE(rec.counted, false)  AS counted,
           COALESCE(rec.recorded, 0)     AS recorded,
           COALESCE(rec.estimated, 0)    AS estimated,
           COALESCE(rec.awaiting, 0)     AS awaiting
      FROM public.owner_outcomes_overview(p_workspace_id) o
      LEFT JOIN br ON br.id = o.branch_id
      LEFT JOIN LATERAL public.owner_report_recovery(o.resolved_price, o.payment_status, o.paid_amount) rec
             ON o.resolved_outcome = 'sold'
     WHERE p_branch_id IS NULL OR o.branch_id = p_branch_id
  ),
  per AS (
    SELECT * FROM ov WHERE resolved_date BETWEEN p_period_start AND v_end
  ),
  sold_per AS (
    SELECT * FROM per WHERE resolved_outcome = 'sold'
  ),

  -- ─── Chỉ tiêu ──────────────────────────────────────────────────────────────
  -- Báo cáo cả đơn vị: chỉ tiêu cả đơn vị + từng chi nhánh. Báo cáo chi nhánh:
  -- chỉ chỉ tiêu của chi nhánh đó. Cùng phép tính với computeTargetProgress().
  -- Chỉ tiêu nhiều tiêu chí (mig 20260927124605): báo cáo chỉ dựng
  -- 2 tiêu chí tiền thu hồi / tài sản đấu thành; chỉ tiêu không có tiêu chí nào trong
  -- 2 loại đó bị bỏ qua (tiêu chí khác chỉ hiện ở trang Chỉ tiêu).
  tg AS (
    SELECT t.id, t.branch_id, t.period_start, br.name AS branch_name,
           ca.goal       AS target_amount,
           cc.goal::int  AS target_count
      FROM public.owner_workspace_targets t
      LEFT JOIN br ON br.id = t.branch_id
      LEFT JOIN public.owner_workspace_target_criteria ca
             ON ca.target_id = t.id AND ca.metric = 'recovered_amount'
      LEFT JOIN public.owner_workspace_target_criteria cc
             ON cc.target_id = t.id AND cc.metric = 'sold_count'
     WHERE t.workspace_id = p_workspace_id
       AND t.period_type = p_period_type
       AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
       AND (ca.goal IS NOT NULL OR cc.goal IS NOT NULL)
  ),
  tg_prog AS (
    SELECT t.id, t.branch_id, t.branch_name, t.target_amount, t.target_count,
           COALESCE(sum(s.recorded), 0)  AS recorded,
           COALESCE(sum(s.estimated), 0) AS estimated,
           COALESCE(sum(s.awaiting), 0)  AS awaiting,
           count(s.row_key)::int         AS sold_count
      FROM tg t
      LEFT JOIN sold_per s ON s.counted AND (t.branch_id IS NULL OR s.branch_id = t.branch_id)
     WHERE t.period_start = p_period_start
     GROUP BY t.id, t.branch_id, t.branch_name, t.target_amount, t.target_count
  ),

  -- ─── Tồn đọng + lịch phiên sắp tới ─────────────────────────────────────────
  claimed AS (
    SELECT DISTINCT c.listing_id AS lid
      FROM public.asset_owner_claims c
     WHERE c.workspace_id = p_workspace_id
       AND c.status IN ('auto_claimed', 'pending_confirmation', 'confirmed')
       AND c.listing_id IS NOT NULL
  ),
  -- Đúng luật branch_of của owner_outcomes_overview.
  branch_of AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS lid, wb.id AS bid
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id AND c.listing_id IS NOT NULL
     ORDER BY c.listing_id, c.created_at
  ),
  lst AS (
    SELECT l.id AS lid, bo.bid, l.title, l.price, l.price_unit, l.auction_org_id,
           (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS listed_on,
           (public.try_timestamptz(COALESCE(l.custom_attributes->>'auction_time',
                                            l.custom_attributes->>'auction_date'))
              AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ca_date
      FROM claimed cl
      JOIN public.listings l    ON l.id = cl.lid
      LEFT JOIN branch_of bo    ON bo.lid = cl.lid
     WHERE p_branch_id IS NULL OR bo.bid = p_branch_id
  ),
  sess AS (
    SELECT s.listing_id AS lid, count(*)::int AS n, min(s.session_date) AS first_date
      FROM public.listing_price_sessions s
      JOIN lst ON lst.lid = s.listing_id
     GROUP BY s.listing_id
  ),
  own AS (
    SELECT o.listing_id AS lid, max(o.round_no) AS max_round, min(o.auction_date) AS first_date
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NOT NULL
     GROUP BY o.listing_id
  ),
  -- Phiên sớm nhất từ hôm nay trở đi: phiên trên sàn đã công bố, hoặc ngày phiên của tin.
  upcoming AS (
    SELECT DISTINCT ON (u.lid) u.lid, u.d, u.src, u.org_name
      FROM (
        SELECT i.listing_id AS lid,
               (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d,
               'platform'::text AS src,
               ao.name AS org_name
          FROM public.auction_session_items i
          JOIN lst                         ON lst.lid = i.listing_id
          JOIN public.auction_sessions s   ON s.id = i.session_id AND s.status = 'published'
          LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
         WHERE i.source = 'listing'
           AND (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= v_as_of
        UNION ALL
        SELECT lst.lid, lst.ca_date, 'listing'::text, ao.name
          FROM lst
          LEFT JOIN public.auction_organizations ao ON ao.id = lst.auction_org_id
         WHERE lst.ca_date >= v_as_of
      ) u
     ORDER BY u.lid, u.d, u.src DESC
  ),
  stuck_l AS (
    SELECT lst.lid,
           upper(left(lst.lid::text, 8)) AS asset_code,
           lst.title::text AS title,
           br.name AS branch_name,
           greatest(COALESCE(se.n, 0), COALESCE(ow.max_round, 0),
                    CASE WHEN o.resolved_outcome IS NOT NULL THEN 1 ELSE 0 END) AS rounds,
           least(se.first_date, ow.first_date, lst.listed_on) AS first_date,
           o.resolved_outcome AS last_outcome,
           o.resolved_date    AS last_date,
           o.confidence_label,
           CASE WHEN lst.price_unit::text = 'TOTAL' AND lst.price > 0 THEN lst.price END::numeric AS starting_price,
           up.d AS next_date
      FROM lst
      LEFT JOIN sess se     ON se.lid = lst.lid
      LEFT JOIN own ow      ON ow.lid = lst.lid
      LEFT JOIN ov o        ON o.listing_id = lst.lid
      LEFT JOIN br          ON br.id = lst.bid
      LEFT JOIN upcoming up ON up.lid = lst.lid
     WHERE o.resolved_outcome IS DISTINCT FROM 'sold'
       AND o.resolved_outcome IS DISTINCT FROM 'withdrawn'
  ),
  off_hist AS (
    SELECT o.title_key, max(o.round_no) AS max_round, min(o.auction_date) AS first_date
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NULL AND o.asset_posting_id IS NULL
     GROUP BY o.title_key
  ),
  stuck_o AS (
    SELECT NULL::uuid AS lid,
           NULL::text AS asset_code,
           v.asset_title AS title,
           v.branch_name,
           greatest(h.max_round, 1) AS rounds,
           h.first_date,
           v.resolved_outcome AS last_outcome,
           v.resolved_date    AS last_date,
           v.confidence_label,
           v.starting_price,
           NULL::date AS next_date
      FROM ov v
      JOIN off_hist h ON h.title_key = v.title_key
     WHERE v.listing_id IS NULL
       AND v.resolved_outcome NOT IN ('sold', 'withdrawn')
  ),
  stuck AS (
    SELECT x.*, (v_as_of - x.first_date)::int AS age_days
      FROM (SELECT * FROM stuck_l UNION ALL SELECT * FROM stuck_o) x
     WHERE x.rounds >= c_stuck_rounds
        OR (x.first_date IS NOT NULL AND v_as_of - x.first_date > c_stuck_days)
  ),
  scheduled AS (
    SELECT up.lid, up.d, up.src, up.org_name,
           upper(left(lst.lid::text, 8)) AS asset_code,
           lst.title::text AS title,
           br.name AS branch_name,
           CASE WHEN lst.price_unit::text = 'TOTAL' AND lst.price > 0 THEN lst.price END::numeric AS starting_price,
           EXISTS (SELECT 1 FROM stuck s WHERE s.lid = up.lid) AS is_stuck
      FROM upcoming up
      JOIN lst       ON lst.lid = up.lid
      LEFT JOIN br   ON br.id = lst.bid
      LEFT JOIN ov o ON o.listing_id = up.lid
     WHERE up.d <= v_next_end
       AND o.resolved_outcome IS DISTINCT FROM 'sold'
       AND o.resolved_outcome IS DISTINCT FROM 'withdrawn'
  )
  SELECT jsonb_build_object(
    'version', 2,
    'meta', jsonb_build_object(
      'generated_at', now(),
      'as_of',        v_as_of,
      'period',       jsonb_build_object('type', p_period_type, 'start', p_period_start, 'end', v_end),
      'unit_name',    v_unit,
      'scope',        jsonb_build_object(
                        'kind',        CASE WHEN p_branch_id IS NULL THEN 'unit' ELSE 'branch' END,
                        'branch_name', v_scope_name)
    ),

    'targets', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'scope',            CASE WHEN t.branch_id IS NULL THEN 'unit' ELSE 'branch' END,
               'branch_name',      t.branch_name,
               'target_amount',    t.target_amount,
               'target_count',     t.target_count,
               'collected',        t.recorded + t.estimated,
               'recorded',         t.recorded,
               'estimated',        t.estimated,
               'awaiting',         t.awaiting,
               'sold_count',       t.sold_count,
               'amount_pct',       CASE WHEN t.target_amount IS NOT NULL
                                        THEN floor((t.recorded + t.estimated) * 100 / t.target_amount)::int END,
               'count_pct',        CASE WHEN t.target_count IS NOT NULL
                                        THEN floor(t.sold_count * 100.0 / t.target_count)::int END,
               'amount_remaining', CASE WHEN t.target_amount IS NOT NULL
                                        THEN greatest(0, t.target_amount - (t.recorded + t.estimated)) END,
               'count_remaining',  CASE WHEN t.target_count IS NOT NULL
                                        THEN greatest(0, t.target_count - t.sold_count) END
             ) ORDER BY t.branch_id IS NOT NULL, t.branch_name), '[]'::jsonb)
        FROM tg_prog t
    ),

    'results', jsonb_build_object(
      'totals', (
        SELECT jsonb_build_object(
                 'total',              count(*),
                 'sold',               count(*) FILTER (WHERE p.resolved_outcome = 'sold'),
                 'unsold',             count(*) FILTER (WHERE p.resolved_outcome = 'unsold'),
                 'voided',             count(*) FILTER (WHERE p.resolved_outcome IN ('postponed', 'cancelled', 'withdrawn')),
                 'conflicts',          count(*) FILTER (WHERE p.has_conflict),
                 'sold_value',         COALESCE(sum(p.resolved_price) FILTER (WHERE p.resolved_outcome = 'sold'), 0),
                 'sold_without_price', count(*) FILTER (WHERE p.resolved_outcome = 'sold' AND p.resolved_price IS NULL),
                 'defaulted',          count(*) FILTER (WHERE p.resolved_outcome = 'sold' AND p.payment_status = 'defaulted'),
                 'success_rate',       CASE WHEN count(*) > 0
                                            THEN round(count(*) FILTER (WHERE p.resolved_outcome = 'sold') * 100.0 / count(*))::int END)
          FROM per p
      ),
      'by_label', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'label', g.confidence_label, 'count', g.n, 'sold', g.sold, 'sold_value', g.sold_value
               ) ORDER BY array_position(ARRAY['platform', 'reconciled', 'owner_evidence', 'self_reported', 'estimated'],
                                         g.confidence_label)), '[]'::jsonb)
          FROM (SELECT p.confidence_label,
                       count(*)::int AS n,
                       count(*) FILTER (WHERE p.resolved_outcome = 'sold')::int AS sold,
                       COALESCE(sum(p.resolved_price) FILTER (WHERE p.resolved_outcome = 'sold'), 0) AS sold_value
                  FROM per p
                 GROUP BY p.confidence_label) g
      ),
      'items', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'asset_code',       p.asset_code,
                 'title',            p.asset_title,
                 'category',         p.asset_category,
                 'branch_name',      p.branch_name,
                 'org_name',         p.auction_org_name,
                 'date',             p.resolved_date,
                 'round_no',         p.own_round_no,
                 'outcome',          p.resolved_outcome,
                 'starting_price',   p.starting_price,
                 'price',            p.resolved_price,
                 'confidence_label', p.confidence_label,
                 'has_conflict',     p.has_conflict,
                 'payment_status',   p.payment_status
               ) ORDER BY p.resolved_date DESC, p.asset_title), '[]'::jsonb)
          FROM per p
      )
    ),

    'money', (
      SELECT jsonb_build_object(
               'collected',  COALESCE(sum(s.recorded + s.estimated), 0),
               'recorded',   COALESCE(sum(s.recorded), 0),
               'estimated',  COALESCE(sum(s.estimated), 0),
               'awaiting',   COALESCE(sum(s.awaiting), 0),
               'sold_count', count(*) FILTER (WHERE s.counted),
               'defaulted',  jsonb_build_object(
                               'count', count(*) FILTER (WHERE NOT s.counted),
                               'value', COALESCE(sum(s.resolved_price) FILTER (WHERE NOT s.counted), 0)),
               'by_label', (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'label', g.confidence_label, 'count', g.n,
                          'collected', g.collected, 'awaiting', g.awaiting
                        ) ORDER BY array_position(ARRAY['platform', 'reconciled', 'owner_evidence', 'self_reported', 'estimated'],
                                                  g.confidence_label)), '[]'::jsonb)
                   FROM (SELECT x.confidence_label,
                                count(*)::int AS n,
                                sum(x.recorded + x.estimated) AS collected,
                                sum(x.awaiting) AS awaiting
                           FROM sold_per x
                          WHERE x.counted
                          GROUP BY x.confidence_label) g
               ),
               'items', (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'asset_code',       x.asset_code,
                          'title',            x.asset_title,
                          'branch_name',      x.branch_name,
                          'date',             x.resolved_date,
                          'price',            x.resolved_price,
                          'paid_amount',      x.paid_amount,
                          'awaiting',         x.awaiting,
                          'payment_status',   x.payment_status,
                          'confidence_label', x.confidence_label
                        ) ORDER BY x.payment_status = 'defaulted', x.awaiting DESC, x.asset_title), '[]'::jsonb)
                   FROM sold_per x
                  WHERE x.payment_status IN ('pending', 'partial', 'defaulted')
               ),
               'carry_over', (
                 SELECT jsonb_build_object('count', count(*), 'awaiting', COALESCE(sum(c.awaiting), 0))
                   FROM ov c
                  WHERE c.resolved_outcome = 'sold'
                    AND c.resolved_date < p_period_start
                    AND c.payment_status IN ('pending', 'partial')
               )
             )
        FROM sold_per s
    ),

    'stuck', jsonb_build_object(
      'rule',  jsonb_build_object('min_rounds', c_stuck_rounds, 'max_days', c_stuck_days),
      'count', (SELECT count(*) FROM stuck),
      'items', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'asset_code',       s.asset_code,
                 'title',            s.title,
                 'branch_name',      s.branch_name,
                 'rounds',           s.rounds,
                 'age_days',         s.age_days,
                 'first_date',       s.first_date,
                 'last_outcome',     s.last_outcome,
                 'last_date',        s.last_date,
                 'confidence_label', s.confidence_label,
                 'starting_price',   s.starting_price,
                 'next_date',        s.next_date
               ) ORDER BY s.age_days DESC NULLS LAST, s.rounds DESC, s.title), '[]'::jsonb)
          FROM stuck s
      )
    ),

    'plan', jsonb_build_object(
      'next_period', jsonb_build_object('type', p_period_type, 'start', v_next_start, 'end', v_next_end),
      'next_targets', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'scope',         CASE WHEN t.branch_id IS NULL THEN 'unit' ELSE 'branch' END,
                 'branch_name',   t.branch_name,
                 'target_amount', t.target_amount,
                 'target_count',  t.target_count
               ) ORDER BY t.branch_id IS NOT NULL, t.branch_name), '[]'::jsonb)
          FROM tg t
         WHERE t.period_start = v_next_start
      ),
      'scheduled', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'asset_code',     s.asset_code,
                 'title',          s.title,
                 'branch_name',    s.branch_name,
                 'date',           s.d,
                 'source',         s.src,
                 'org_name',       s.org_name,
                 'starting_price', s.starting_price,
                 'is_stuck',       s.is_stuck
               ) ORDER BY s.d, s.title), '[]'::jsonb)
          FROM scheduled s
      ),
      'stuck_unscheduled', (SELECT count(*) FROM stuck s WHERE s.next_date IS NULL)
    )
  )
  INTO v_result;

  -- Phase M5: phễu truyền thông của kỳ, cùng phạm vi chi nhánh với báo cáo.
  -- Phase 8 (kế hoạch đấu giá): payload v2 mang thêm 'plan_execution'.
  RETURN v_result || jsonb_build_object(
    'marketing',      public.owner_mkt_funnel_core(p_workspace_id, p_period_start, v_end, NULL, p_branch_id, false),
    'plan_execution', public.owner_report_plan_execution(p_workspace_id, p_period_type, p_period_start, p_branch_id));
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Link chia sẻ /r/:token — danh sách trắng thêm 'plan_execution'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_report_public_payload(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT public.owner_report_strip_private(COALESCE(
    (SELECT jsonb_object_agg(e.key, e.value)
       FROM jsonb_each(p) e
      WHERE e.key IN ('version', 'meta', 'targets', 'results', 'money', 'stuck', 'plan', 'marketing',
                      'plan_execution', 'notes', 'people', 'finalized_at')),
    '{}'::jsonb))
$function$;

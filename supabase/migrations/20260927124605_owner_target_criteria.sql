-- Chỉ tiêu nhiều tiêu chí — mở rộng Phase 9 (owner_workspace_targets, mig 20260926145733).
--
-- Mỗi chỉ tiêu (một kỳ + một phạm vi, vẫn DUY NHẤT theo owt_unique_period) có TÊN và
-- 1..4 TIÊU CHÍ, mỗi loại tối đa một lần:
--   recovered_amount  Số tiền thu hồi (₫)          — luật recoveryOf() cũ
--   winning_total     Tổng giá trúng (₫)            — giá trúng tài sản đấu thành, trừ bỏ cọc
--   sold_count        Số tài sản đấu thành          — trừ bỏ cọc
--   offered_count     Số tài sản đưa ra đấu giá     — mọi kết quả trong kỳ
-- Bảng CHỈ lưu mục tiêu; số thực tế vẫn TÍNH ở src/lib/ownerTargets.ts từ các dòng
-- owner_outcomes_overview.
--
-- target_amount / target_count của bảng cha chuyển thành 2 tiêu chí; từ đây tiêu chí là
-- nguồn DUY NHẤT. Hai cột cũ tạm GIỮ (ngừng dùng, không đồng bộ) vì bản production đang
-- chạy còn đọc/ghi chúng — xoá bằng migration tiếp theo SAU KHI deploy code mới (người
-- dùng chốt 2 bước, 2026-09-27). owner_build_report_payload (Báo cáo định kỳ) đọc lại 2
-- tiêu chí đó — payload giữ nguyên cấu trúc nên báo cáo đã chốt và màn báo cáo không đổi.
--
-- Ghi: RPC owner_save_target (SECURITY INVOKER ⇒ RLS vẫn là cổng duy nhất) lưu chỉ tiêu +
-- thay toàn bộ tiêu chí trong MỘT giao dịch. Quyền giống bảng cha: đọc = 'read',
-- ghi = 'manage_members'.

-- DB dùng chung với phiên khác ⇒ khoá trước để không kẹt giữa chừng.
LOCK TABLE public.owner_workspace_targets IN ACCESS EXCLUSIVE MODE;

-- ─── 1. Tên chỉ tiêu ────────────────────────────────────────────────────────
-- NULL ⇒ UI hiện tên tự sinh "Quý IV/2026 · Toàn đơn vị".

ALTER TABLE public.owner_workspace_targets
  ADD COLUMN name TEXT
  CONSTRAINT owt_name_len CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 120);

-- ─── 2. Bảng tiêu chí ───────────────────────────────────────────────────────

CREATE TABLE public.owner_workspace_target_criteria (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id     UUID NOT NULL REFERENCES public.owner_workspace_targets(id) ON DELETE CASCADE,
  -- Trigger điền từ chỉ tiêu cha (client gửi gì cũng bị ghi đè) — để RLS không phải join.
  workspace_id  UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  metric        TEXT NOT NULL
                CHECK (metric IN ('recovered_amount', 'winning_total', 'sold_count', 'offered_count')),
  goal          NUMERIC(18,0) NOT NULL CHECK (goal > 0),
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Tiêu chí đếm tài sản: ép ::int an toàn (báo cáo) và khớp form (tối đa 6 chữ số).
  CONSTRAINT owtc_count_goal CHECK (metric NOT IN ('sold_count', 'offered_count') OR goal <= 999999),
  CONSTRAINT owtc_unique_metric UNIQUE (target_id, metric)
);

CREATE INDEX idx_owtc_workspace ON public.owner_workspace_target_criteria (workspace_id);

CREATE TRIGGER owner_workspace_target_criteria_updated_at
  BEFORE UPDATE ON public.owner_workspace_target_criteria
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SECURITY DEFINER: đọc chỉ tiêu cha không phụ thuộc RLS của người gọi. RLS WITH CHECK
-- chạy SAU trigger BEFORE ⇒ workspace_id đã ép vẫn bị kiểm quyền.
CREATE OR REPLACE FUNCTION public.owner_workspace_target_criteria_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.target_id IS DISTINCT FROM OLD.target_id THEN
    RAISE EXCEPTION 'Không thể chuyển tiêu chí sang chỉ tiêu khác';
  END IF;

  SELECT t.workspace_id INTO v_ws FROM public.owner_workspace_targets t WHERE t.id = NEW.target_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy chỉ tiêu';
  END IF;
  NEW.workspace_id := v_ws;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_workspace_target_criteria_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_workspace_target_criteria_guard
  BEFORE INSERT OR UPDATE ON public.owner_workspace_target_criteria
  FOR EACH ROW EXECUTE FUNCTION public.owner_workspace_target_criteria_guard();

-- ─── 3. RLS — y hệt bảng cha ────────────────────────────────────────────────

ALTER TABLE public.owner_workspace_target_criteria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_workspace_target_criteria FROM anon;

CREATE POLICY "owner_workspace_target_criteria_read" ON public.owner_workspace_target_criteria
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY "owner_workspace_target_criteria_insert" ON public.owner_workspace_target_criteria
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_members'));

CREATE POLICY "owner_workspace_target_criteria_update" ON public.owner_workspace_target_criteria
  FOR UPDATE TO authenticated
  USING      (public.owner_ws_can(workspace_id, 'manage_members'))
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_members'));

CREATE POLICY "owner_workspace_target_criteria_delete" ON public.owner_workspace_target_criteria
  FOR DELETE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_members'));

-- ─── 4. Chuyển mục tiêu cũ thành tiêu chí ───────────────────────────────────

INSERT INTO public.owner_workspace_target_criteria (target_id, workspace_id, metric, goal, sort_order)
SELECT t.id, t.workspace_id, 'recovered_amount', t.target_amount, 0
  FROM public.owner_workspace_targets t
 WHERE t.target_amount IS NOT NULL
UNION ALL
SELECT t.id, t.workspace_id, 'sold_count', t.target_count, 1
  FROM public.owner_workspace_targets t
 WHERE t.target_count IS NOT NULL;

-- ─── 5. Báo cáo định kỳ đọc 2 tiêu chí thay cho 2 cột ───────────────────────
-- Thân hàm = bản pg_get_functiondef đang chạy, chỉ thay CTE `tg`.

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
    'version', 1,
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

  RETURN v_result;
END;
$function$;

-- ─── 6. Ngừng dùng 2 cột cũ ─────────────────────────────────────────────────
-- Chỉ tiêu mới không ghi 2 cột này ⇒ bỏ ràng buộc "phải có một trong hai". Cột được GIỮ
-- tới khi production chạy code mới; bước 2: DROP COLUMN target_amount, target_count.

ALTER TABLE public.owner_workspace_targets DROP CONSTRAINT owt_has_goal;

COMMENT ON COLUMN public.owner_workspace_targets.target_amount IS
  'NGỪNG DÙNG (mig 20260927124605) — xem owner_workspace_target_criteria. Chờ xoá sau khi deploy.';
COMMENT ON COLUMN public.owner_workspace_targets.target_count IS
  'NGỪNG DÙNG (mig 20260927124605) — xem owner_workspace_target_criteria. Chờ xoá sau khi deploy.';

-- ─── 7. RPC lưu chỉ tiêu + tiêu chí ─────────────────────────────────────────
-- SECURITY INVOKER: RLS của 2 bảng là cổng quyền. UPDATE bị RLS lọc không báo lỗi
-- ⇒ không có id trả về thì tự RAISE 42501 (INSERT bị chặn thì Postgres tự báo 42501).
-- p_criteria: [{ "metric": "recovered_amount", "goal": 1000000 }, …] — thứ tự = sort_order.

CREATE OR REPLACE FUNCTION public.owner_save_target(
  p_workspace_id UUID,
  p_target_id    UUID,
  p_branch_id    UUID,
  p_period_type  TEXT,
  p_period_start DATE,
  p_name         TEXT,
  p_criteria     JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_id       UUID;
  v_n        INT;
  v_distinct INT;
  v_name     TEXT := NULLIF(btrim(p_name), '');
BEGIN
  IF p_criteria IS NULL OR jsonb_typeof(p_criteria) <> 'array' THEN
    RAISE EXCEPTION 'Danh sách tiêu chí không hợp lệ';
  END IF;
  SELECT count(*), count(DISTINCT e ->> 'metric') INTO v_n, v_distinct
    FROM jsonb_array_elements(p_criteria) e;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Chỉ tiêu cần ít nhất một tiêu chí';
  END IF;
  IF v_distinct <> v_n THEN
    RAISE EXCEPTION 'Mỗi loại tiêu chí chỉ chọn một lần';
  END IF;

  IF p_target_id IS NULL THEN
    INSERT INTO public.owner_workspace_targets (workspace_id, branch_id, period_type, period_start, name)
    VALUES (p_workspace_id, p_branch_id, p_period_type, p_period_start, v_name)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.owner_workspace_targets
       SET branch_id = p_branch_id,
           period_type = p_period_type,
           period_start = p_period_start,
           name = v_name
     WHERE id = p_target_id AND workspace_id = p_workspace_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Chỉ Trưởng đơn vị mới đặt được chỉ tiêu' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.owner_workspace_target_criteria WHERE target_id = v_id;
  END IF;

  INSERT INTO public.owner_workspace_target_criteria (target_id, workspace_id, metric, goal, sort_order)
  SELECT v_id, p_workspace_id, x.e ->> 'metric', (x.e ->> 'goal')::numeric, (x.ord - 1)::smallint
    FROM jsonb_array_elements(p_criteria) WITH ORDINALITY AS x(e, ord);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_target(UUID, UUID, UUID, TEXT, DATE, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_save_target(UUID, UUID, UUID, TEXT, DATE, TEXT, JSONB) TO authenticated;

-- ─── 8. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.owner_workspace_target_criteria'::regclass) THEN
    RAISE EXCEPTION 'owner_target_criteria self-check: chưa bật RLS';
  END IF;

  IF has_table_privilege('anon', 'public.owner_workspace_target_criteria', 'SELECT') THEN
    RAISE EXCEPTION 'owner_target_criteria self-check: anon còn quyền đọc bảng';
  END IF;

  IF has_function_privilege('authenticated', 'public.owner_workspace_target_criteria_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_target_criteria self-check: trigger guard đang mở cho authenticated';
  END IF;

  IF has_function_privilege('anon', 'public.owner_save_target(uuid, uuid, uuid, text, date, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_target_criteria self-check: anon gọi được owner_save_target';
  END IF;

  -- Mọi chỉ tiêu phải còn ít nhất một tiêu chí sau khi chuyển.
  IF EXISTS (SELECT 1 FROM public.owner_workspace_targets t
              WHERE NOT EXISTS (SELECT 1 FROM public.owner_workspace_target_criteria c WHERE c.target_id = t.id)) THEN
    RAISE EXCEPTION 'owner_target_criteria self-check: có chỉ tiêu không còn tiêu chí nào';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.prosrc ~ '\mtarget_amount\M'
                AND p.proname <> 'owner_build_report_payload') THEN
    RAISE EXCEPTION 'owner_target_criteria self-check: còn hàm đọc cột target_amount đã xoá';
  END IF;
END;
$$;

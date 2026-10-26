-- Kế hoạch đấu giá — Phase 6: vận hành theo tháng / quý / năm (A5, A6 của
-- docs/owner-auction-planning-plan.md).
--
-- Migration này làm 6 việc:
--   1. MỞ RỘNG `owner_outcomes_overview_core` để nó khớp cả kết quả gắn
--      `asset_posting_id` (quyết định D8).
--   2. `auction_plan_outcome_rows(ws)` — ĐỊNH NGHĨA DUY NHẤT "kết quả thực tế
--      của một tài sản trong kế hoạch", đọc từ bộ hợp nhất ở (1).
--   3. `auction_plan_item_outcomes(plan)` — giữ NGUYÊN chữ ký, nay chỉ là lớp
--      mỏng gọi (2) (xoá bản định nghĩa thứ hai mà Phase 5 phải tự dựng).
--   4. `auction_plan_period_metrics(plan, period_type, period_start)` — bản sao
--      SQL của `planVsActual()` (A5).
--   5. `auction_plan_due_steps(ws, through)` — mốc đến hạn / quá hạn của cả Trạm
--      (trang "Vận hành tháng" + số đếm nav `auction-plan-due`).
--   6. `auction_plan_month_items(ws, from, to, as_of)` — tài sản của một kỳ kèm
--      sức khoẻ, dùng cho "Vận hành tháng".
--
-- ⚠️ (1) là hàm ĐÃ SHIP mà Chỉ tiêu, Kết quả phiên, Dòng tiền, Báo cáo định kỳ,
-- Phễu truyền thông và Benchmark đều đọc. Thân hàm dưới đây được chép từ
-- `pg_get_functiondef` của bản ĐANG CHẠY lúc áp (26/10/2026) rồi THÊM một nhánh
-- — không dựng lại từ file migration cũ (bẫy 01/10 làm rơi `so-hoa:share`).
-- Nhánh mới chỉ bắt dòng `listing_id IS NULL AND asset_posting_id IS NOT NULL`,
-- tức phần mà CẢ HAI nhánh cũ đều bỏ sót, nên không Trạm nào đang có số liệu bị
-- đổi (đã chứng minh bằng ảnh chụp trước/sau 4 Trạm có kết quả).

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. owner_outcomes_overview_core — thêm nhánh "kết quả gắn hồ sơ số hoá" (D8)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_outcomes_overview_core(p_workspace_id uuid)
 RETURNS TABLE(row_key text, listing_id uuid, title_key text, own_outcome_id uuid, own_round_no integer, rounds_reported integer, asset_title text, asset_category text, branch_id uuid, auction_org_name text, starting_price numeric, resolved_outcome text, resolved_price numeric, resolved_date date, payment_status text, paid_amount numeric, best_kind text, confidence_label text, has_conflict boolean, sources jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH res AS (
    SELECT x.* FROM public.owner_asset_outcomes_resolved_core(p_workspace_id) x
     WHERE x.resolved_outcome IS NOT NULL
  ),
  own_src AS (
    -- Bản ghi của chính đơn vị = nguồn owner_report (chỉ có lượt mới nhất).
    SELECT r.listing_id                       AS lid,
           (e->>'ref_id')::uuid               AS oid,
           (e->>'round_no')::int              AS rno,
           COALESCE((e->>'in_round')::boolean, false) AS in_round
      FROM res r
      CROSS JOIN LATERAL jsonb_array_elements(r.sources) e
     WHERE e->>'kind' = 'owner_report'
  ),
  own_count AS (
    SELECT o.listing_id AS lid, count(*)::int AS n
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NOT NULL
     GROUP BY o.listing_id
  ),
  branch_of AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS lid, wb.id AS bid
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id AND c.listing_id IS NOT NULL
     ORDER BY c.listing_id, c.created_at
  ),
  off_all AS (
    SELECT o.*
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id
       AND o.listing_id IS NULL
       AND o.asset_posting_id IS NULL
  ),
  off_latest AS (
    SELECT DISTINCT ON (o.title_key) o.*
      FROM off_all o
     ORDER BY o.title_key, o.round_no DESC, o.auction_date DESC, o.updated_at DESC
  ),
  off_count AS (
    SELECT o.title_key AS tk, count(*)::int AS n FROM off_all o GROUP BY o.title_key
  ),
  -- D8 (26/10/2026): kết quả do đơn vị khai cho một HỒ SƠ SỐ HOÁ. Trước đây nó
  -- rơi khỏi CẢ HAI nhánh trên (nhánh trên sàn khoá theo `listing_id`, nhánh
  -- ngoài sàn đòi `asset_posting_id IS NULL`) nên không xuất hiện ở đâu cả.
  -- Dòng có CẢ listing_id vẫn thuộc nhánh trên sàn — tin đăng thắng, không đếm hai lần.
  pst_all AS (
    SELECT o.*
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id
       AND o.listing_id IS NULL
       AND o.asset_posting_id IS NOT NULL
  ),
  pst_latest AS (
    -- Không có unique index theo (ws, hồ sơ, lượt) ⇒ thứ tự phải TẤT ĐỊNH.
    SELECT DISTINCT ON (o.asset_posting_id) o.*
      FROM pst_all o
     ORDER BY o.asset_posting_id, o.round_no DESC, o.auction_date DESC, o.updated_at DESC
  ),
  pst_count AS (
    SELECT o.asset_posting_id AS pid, count(*)::int AS n FROM pst_all o GROUP BY o.asset_posting_id
  )
  SELECT ('l:' || r.listing_id::text)::text,
         r.listing_id,
         NULL::text,
         os.oid,
         os.rno,
         COALESCE(oc.n, 0)::int,
         l.title::text,
         l.property_type_slug::text,
         bo.bid,
         COALESCE(r.sources->0->>'org_name', ao.name)::text,
         (CASE WHEN l.price_unit::text = 'TOTAL' AND l.price > 0 THEN l.price END)::numeric,
         r.resolved_outcome,
         r.resolved_price::numeric,
         r.resolved_date,
         r.payment_status,
         (CASE WHEN os.in_round AND r.sources->0->>'kind' = 'owner_report' THEN oo.paid_amount END)::numeric,
         (r.sources->0->>'kind')::text,
         r.confidence_label,
         r.has_conflict,
         r.sources
    FROM res r
    JOIN public.listings l                    ON l.id = r.listing_id
    LEFT JOIN own_src os                      ON os.lid = r.listing_id
    LEFT JOIN public.owner_asset_outcomes oo  ON oo.id = os.oid
    LEFT JOIN own_count oc                    ON oc.lid = r.listing_id
    LEFT JOIN branch_of bo                    ON bo.lid = r.listing_id
    LEFT JOIN public.auction_organizations ao ON ao.id = l.auction_org_id
  UNION ALL
  SELECT ('t:' || f.title_key)::text,
         NULL::uuid,
         f.title_key,
         f.id,
         f.round_no,
         COALESCE(fc.n, 0)::int,
         f.asset_title,
         f.asset_category,
         f.branch_id,
         ao.name::text,
         f.starting_price::numeric,
         f.outcome,
         (CASE WHEN f.outcome = 'sold' THEN f.winning_price END)::numeric,
         f.auction_date,
         CASE WHEN f.outcome = 'sold' THEN f.payment_status END,
         (CASE WHEN f.outcome = 'sold' THEN f.paid_amount END)::numeric,
         'owner_report'::text,
         lbl.label,
         false,
         jsonb_build_array(jsonb_build_object(
           'kind',           'owner_report',
           'label',          lbl.label,
           'outcome',        f.outcome,
           'price',          CASE WHEN f.outcome = 'sold' THEN f.winning_price END,
           'date',           f.auction_date,
           'payment_status', CASE WHEN f.outcome = 'sold' THEN f.payment_status END,
           'fp',             public.owner_outcome_source_fp('owner_report', f.id::text, f.outcome,
                                CASE WHEN f.outcome = 'sold' THEN f.winning_price END),
           'dismissed',      false,
           'in_round',       true,
           'disagrees',      false,
           'ref_id',         f.id,
           'org_name',       ao.name,
           'round_no',       f.round_no
         ))
    FROM off_latest f
    LEFT JOIN off_count fc                    ON fc.tk = f.title_key
    LEFT JOIN public.auction_organizations ao ON ao.id = f.auction_org_id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN cardinality(f.evidence_urls) > 0 THEN 'owner_evidence' ELSE 'self_reported' END::text AS label
    ) lbl
  UNION ALL
  -- Nhánh MỚI (D8): một dòng cho mỗi hồ sơ số hoá có kết quả, khoá `p:<hồ sơ>`.
  SELECT ('p:' || g.asset_posting_id::text)::text,
         NULL::uuid,
         g.title_key,
         g.id,
         g.round_no,
         COALESCE(gc.n, 0)::int,
         COALESCE(g.asset_title, ap.title)::text,
         g.asset_category,
         g.branch_id,
         ao.name::text,
         g.starting_price::numeric,
         g.outcome,
         (CASE WHEN g.outcome = 'sold' THEN g.winning_price END)::numeric,
         g.auction_date,
         CASE WHEN g.outcome = 'sold' THEN g.payment_status END,
         (CASE WHEN g.outcome = 'sold' THEN g.paid_amount END)::numeric,
         'owner_report'::text,
         glbl.label,
         false,
         jsonb_build_array(jsonb_build_object(
           'kind',           'owner_report',
           'label',          glbl.label,
           'outcome',        g.outcome,
           'price',          CASE WHEN g.outcome = 'sold' THEN g.winning_price END,
           'date',           g.auction_date,
           'payment_status', CASE WHEN g.outcome = 'sold' THEN g.payment_status END,
           'fp',             public.owner_outcome_source_fp('owner_report', g.id::text, g.outcome,
                                CASE WHEN g.outcome = 'sold' THEN g.winning_price END),
           'dismissed',      false,
           'in_round',       true,
           'disagrees',      false,
           'ref_id',         g.id,
           'org_name',       ao.name,
           'round_no',       g.round_no
         ))
    FROM pst_latest g
    LEFT JOIN pst_count gc                    ON gc.pid = g.asset_posting_id
    -- Hồ sơ LUÔN thuộc Trạm (trigger owner_asset_outcomes_guard_posting), điều
    -- kiện workspace_id ở đây chỉ để hàm DEFINER này không thể rò tên hồ sơ lạ.
    LEFT JOIN public.asset_postings ap        ON ap.id = g.asset_posting_id
                                             AND ap.workspace_id = p_workspace_id
    LEFT JOIN public.auction_organizations ao ON ao.id = g.auction_org_id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN cardinality(g.evidence_urls) > 0 THEN 'owner_evidence' ELSE 'self_reported' END::text AS label
    ) glbl;
END;
$function$;

COMMENT ON FUNCTION public.owner_outcomes_overview_core(uuid) IS
  'Mỗi tài sản CÓ KẾT QUẢ một dòng: trên sàn (l:<tin>), ngoài sàn (t:<tên>), hồ sơ số hoá (p:<hồ sơ>, D8 26/10/2026). Nguồn DUY NHẤT của Chỉ tiêu, Kết quả phiên, Dòng tiền, Báo cáo định kỳ và Kế hoạch đấu giá.';

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Kết quả thực tế của một tài sản trong kế hoạch — ĐỊNH NGHĨA DUY NHẤT
-- ───────────────────────────────────────────────────────────────────────────────

-- Hàm NỘI BỘ: không có cổng quyền (gọi cho cả Trạm), vì thế bị REVOKE sạch và
-- chỉ các hàm DEFINER bên dưới gọi được. Tài sản gắn CẢ tin đăng và hồ sơ thì
-- TIN ĐĂNG thắng (như Phase 5).
CREATE OR REPLACE FUNCTION public.auction_plan_outcome_rows(p_workspace_id UUID)
RETURNS TABLE (
  item_id        UUID,
  plan_id        UUID,
  link           TEXT,
  row_key        TEXT,
  outcome        TEXT,
  payment_status TEXT,
  auction_date   DATE,
  starting_price NUMERIC,
  winning_price  NUMERIC,
  paid_amount    NUMERIC,
  paid_at        DATE,
  round_no       INT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ov AS (
    SELECT * FROM public.owner_outcomes_overview_core(p_workspace_id)
  ),
  it AS (
    SELECT i.id, i.plan_id, i.asset_posting_id, i.listing_id
      FROM public.auction_plan_items i
     WHERE i.workspace_id = p_workspace_id
       AND (i.listing_id IS NOT NULL OR i.asset_posting_id IS NOT NULL)
  ),
  m AS (
    SELECT DISTINCT ON (it.id)
           it.id      AS item_id,
           it.plan_id AS plan_id,
           CASE WHEN r.listing_id IS NOT NULL THEN 'listing' ELSE 'posting' END AS link,
           r.row_key,
           r.resolved_outcome,
           r.payment_status,
           r.resolved_date,
           r.starting_price,
           r.resolved_price,
           r.paid_amount,
           r.own_outcome_id,
           r.own_round_no
      FROM it
      JOIN ov r
        ON (r.listing_id IS NOT NULL AND r.listing_id = it.listing_id)
        OR (it.asset_posting_id IS NOT NULL AND r.row_key = 'p:' || it.asset_posting_id::TEXT)
     ORDER BY it.id, (r.listing_id IS NOT NULL) DESC
  )
  SELECT m.item_id,
         m.plan_id,
         m.link,
         m.row_key,
         m.resolved_outcome,
         m.payment_status,
         m.resolved_date,
         m.starting_price,
         m.resolved_price,
         m.paid_amount,
         -- `paid_at` / `round_no` chỉ có nghĩa với bản ghi tự khai của đơn vị;
         -- dòng trên sàn để NULL, y như Phase 5.
         CASE WHEN m.link = 'posting' THEN oo.paid_at END,
         CASE WHEN m.link = 'posting' THEN m.own_round_no END
    FROM m
    LEFT JOIN public.owner_asset_outcomes oo
           ON oo.id = m.own_outcome_id AND oo.workspace_id = p_workspace_id;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_outcome_rows(UUID) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.auction_plan_outcome_rows(UUID) IS
  'NỘI BỘ (không có cổng quyền): kết quả thực tế của từng tài sản kế hoạch trong một Trạm, đọc từ owner_outcomes_overview_core. Đây là ĐỊNH NGHĨA DUY NHẤT "kết quả của một mục kế hoạch" (D8).';

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. auction_plan_item_outcomes — giữ chữ ký, nay là lớp mỏng
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auction_plan_item_outcomes(p_plan_id UUID)
RETURNS TABLE (
  item_id        UUID,
  link           TEXT,
  outcome        TEXT,
  payment_status TEXT,
  auction_date   DATE,
  starting_price NUMERIC,
  winning_price  NUMERIC,
  paid_amount    NUMERIC,
  paid_at        DATE,
  round_no       INTEGER
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.auction_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.auction_plan_read_ok(v_plan.workspace_id, v_plan.branch_id, p_plan_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.item_id, r.link, r.outcome, r.payment_status, r.auction_date,
         r.starting_price, r.winning_price, r.paid_amount, r.paid_at, r.round_no
    FROM public.auction_plan_outcome_rows(v_plan.workspace_id) r
   WHERE r.plan_id = p_plan_id;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_item_outcomes(UUID) IS
  'Kết quả thực tế của từng tài sản của MỘT kế hoạch (cổng auction_plan_read_ok). Từ 26/10/2026 chỉ là lớp mỏng trên auction_plan_outcome_rows — không còn luật riêng.';

REVOKE ALL ON FUNCTION public.auction_plan_item_outcomes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_item_outcomes(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. auction_plan_period_metrics — bản sao SQL của planVsActual() (A5)
-- ───────────────────────────────────────────────────────────────────────────────

-- ⚠️ CẶP NHÂN BẢN SQL ↔ TS: `planVsActual()` trong
-- src/lib/auctionPlan/period.ts. Sửa một bên thì PHẢI sửa bên kia.
--  · CỘT KẾ HOẠCH lấy từ BẢN MỐC mới nhất (`auction_plan_baselines.payload.items`)
--    — không lấy danh mục hiện tại; tài sản THÊM SAU bản mốc (hoặc kế hoạch chưa
--    từng duyệt) dùng giá trị hiện tại, cùng luật với `baselineMonthOf`.
--  · CỘT THỰC TẾ đi qua `auction_plan_outcome_rows` (một nguồn với Chỉ tiêu) và
--    luật tiền cash-strict dùng LẠI `owner_report_recovery` — không viết lại.
--  · Biên kỳ BAO GỒM hai đầu; kết quả không có ngày KHÔNG thuộc kỳ nào.
CREATE OR REPLACE FUNCTION public.auction_plan_period_metrics(
  p_plan_id      UUID,
  p_period_type  TEXT,
  p_period_start DATE
)
RETURNS TABLE (
  period_type         TEXT,
  period_start        DATE,
  period_end          DATE,
  planned_count       INT,
  planned_start_value NUMERIC,
  offered_count       INT,
  sold_count          INT,
  actual_start_value  NUMERIC,
  winning_total       NUMERIC,
  collected           NUMERIC,
  recorded            NUMERIC,
  estimated           NUMERIC,
  awaiting            NUMERIC,
  done_pct            INT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  public.auction_plans%ROWTYPE;
  v_start DATE;
  v_end   DATE;
  v_unit  INTERVAL;
BEGIN
  IF p_period_type NOT IN ('month', 'quarter', 'year') THEN
    RAISE EXCEPTION 'bad_period_type' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.auction_plan_read_ok(v_plan.workspace_id, v_plan.branch_id, p_plan_id) THEN
    RETURN;
  END IF;

  v_unit  := CASE p_period_type WHEN 'month' THEN INTERVAL '1 month'
                                WHEN 'quarter' THEN INTERVAL '3 months'
                                ELSE INTERVAL '1 year' END;
  v_start := date_trunc(CASE p_period_type WHEN 'month' THEN 'month'
                                           WHEN 'quarter' THEN 'quarter'
                                           ELSE 'year' END, p_period_start)::DATE;
  v_end   := (v_start + v_unit - INTERVAL '1 day')::DATE;

  RETURN QUERY
  WITH bl AS (
    SELECT b.payload
      FROM public.auction_plan_baselines b
     WHERE b.plan_id = p_plan_id
     ORDER BY b.version DESC
     LIMIT 1
  ),
  bitems AS (
    SELECT (e->>'id')::UUID                                  AS id,
           NULLIF(e->>'planned_month', '')::DATE              AS month,
           COALESCE(NULLIF(e->>'expected_start_value', '')::NUMERIC, 0) AS expected
      FROM bl
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bl.payload->'items', '[]'::jsonb)) e
  ),
  planned AS (
    SELECT b.id, b.month, b.expected FROM bitems b
    UNION ALL
    SELECT i.id, i.planned_month, COALESCE(i.expected_start_value, 0)
      FROM public.auction_plan_items i
     WHERE i.plan_id = p_plan_id
       AND i.exec_status = 'active'
       AND NOT EXISTS (SELECT 1 FROM bitems b WHERE b.id = i.id)
  ),
  pl AS (
    SELECT count(*)::INT                        AS cnt,
           COALESCE(sum(p.expected), 0)::NUMERIC AS val
      FROM planned p
     WHERE p.month IS NOT NULL AND p.month BETWEEN v_start AND v_end
  ),
  oc AS (
    SELECT r.*
      FROM public.auction_plan_outcome_rows(v_plan.workspace_id) r
     WHERE r.plan_id = p_plan_id
       AND r.outcome IS NOT NULL
       AND r.auction_date IS NOT NULL
       AND r.auction_date BETWEEN v_start AND v_end
  ),
  cash AS (
    SELECT o.outcome,
           GREATEST(COALESCE(o.winning_price, 0), 0) AS price,
           GREATEST(COALESCE(o.starting_price, 0), 0) AS start_price,
           rec.counted, rec.recorded, rec.estimated, rec.awaiting
      FROM oc o
      CROSS JOIN LATERAL public.owner_report_recovery(o.winning_price, o.payment_status, o.paid_amount) rec
  ),
  ac AS (
    SELECT count(*)::INT                                                            AS offered,
           COALESCE(sum(c.start_price), 0)::NUMERIC                                  AS start_total,
           count(*) FILTER (WHERE c.outcome = 'sold' AND c.counted)::INT             AS sold,
           COALESCE(sum(c.price)      FILTER (WHERE c.outcome = 'sold' AND c.counted), 0)::NUMERIC AS win,
           COALESCE(sum(c.recorded)   FILTER (WHERE c.outcome = 'sold' AND c.counted), 0)::NUMERIC AS rec,
           COALESCE(sum(c.estimated)  FILTER (WHERE c.outcome = 'sold' AND c.counted), 0)::NUMERIC AS est,
           COALESCE(sum(c.awaiting)   FILTER (WHERE c.outcome = 'sold' AND c.counted), 0)::NUMERIC AS awa
      FROM cash c
  )
  SELECT p_period_type, v_start, v_end,
         pl.cnt, pl.val,
         ac.offered, ac.sold, ac.start_total, ac.win,
         ac.rec + ac.est, ac.rec, ac.est, ac.awa,
         CASE WHEN pl.cnt > 0 THEN floor(ac.sold::NUMERIC * 100 / pl.cnt)::INT END
    FROM pl CROSS JOIN ac;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_period_metrics(UUID, TEXT, DATE) IS
  'Kế hoạch so thực tế của một kế hoạch trong một kỳ (A5). Bản sao SQL của planVsActual() — src/lib/auctionPlan/period.ts. Kế hoạch lấy từ BẢN MỐC, thực tế từ auction_plan_outcome_rows, tiền qua owner_report_recovery.';

REVOKE ALL ON FUNCTION public.auction_plan_period_metrics(UUID, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_period_metrics(UUID, TEXT, DATE) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. Mốc đến hạn / quá hạn của cả Trạm — "Vận hành tháng" + số đếm nav
-- ───────────────────────────────────────────────────────────────────────────────

-- SECURITY INVOKER: RLS của `auction_plan_item_steps` / `_items` / `auction_plans`
-- (đều qua `auction_plan_read_ok`) LÀ cổng — không viết lại luật phạm vi.
-- Trả về mọi mốc chưa xong có ngày dự kiến ≤ p_through, kể cả quá hạn; client
-- phân "quá hạn" / "đến hạn trong kỳ" bằng cách so với hôm nay.
CREATE OR REPLACE FUNCTION public.auction_plan_due_steps(p_workspace_id UUID, p_through DATE)
RETURNS TABLE (
  step_id         UUID,
  plan_id         UUID,
  plan_title      TEXT,
  plan_status     TEXT,
  plan_year       INT,
  branch_id       UUID,
  admin_unit_code TEXT,
  item_id         UUID,
  item_code       TEXT,
  item_title      TEXT,
  planned_month   DATE,
  forecast_month  DATE,
  step            TEXT,
  sort_order      INT,
  planned_date    DATE
)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, p.id, p.title, p.status, p.plan_year, i.branch_id, p.admin_unit_code,
         i.id, i.item_code, i.title, i.planned_month, i.forecast_month,
         s.step, s.sort_order, s.planned_date
    FROM public.auction_plan_item_steps s
    JOIN public.auction_plan_items i ON i.id = s.item_id
    JOIN public.auction_plans p      ON p.id = s.plan_id
   WHERE s.workspace_id = p_workspace_id
     AND s.done_on IS NULL
     AND s.planned_date IS NOT NULL
     AND s.planned_date <= p_through
     AND i.exec_status = 'active'
     AND p.status <> 'closed'
   ORDER BY s.planned_date, i.seq, s.sort_order;
$$;

COMMENT ON FUNCTION public.auction_plan_due_steps(UUID, DATE) IS
  'Mốc công việc chưa xong có ngày dự kiến ≤ p_through, mọi kế hoạch chưa đóng của Trạm. SECURITY INVOKER ⇒ RLS theo chi nhánh là cổng. Nguồn của trang "Vận hành tháng" và số đếm nav auction-plan-due.';

REVOKE ALL ON FUNCTION public.auction_plan_due_steps(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_due_steps(UUID, DATE) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6. Tài sản của một kỳ kèm sức khoẻ — "Vận hành tháng"
-- ───────────────────────────────────────────────────────────────────────────────

-- DEFINER + cổng `auction_plan_read_ok` cho TỪNG kế hoạch (như
-- auction_plan_item_health_rows), vì nó gọi auction_plan_outcome_rows.
-- Lọc theo tháng BẢN MỐC hoặc tháng dự kiến mới — tài sản bị dời VÀO kỳ này
-- cũng là việc của kỳ này.
CREATE OR REPLACE FUNCTION public.auction_plan_month_items(
  p_workspace_id UUID,
  p_from         DATE,
  p_to           DATE,
  p_as_of        DATE DEFAULT NULL
)
RETURNS TABLE (
  plan_id         UUID,
  plan_title      TEXT,
  plan_status     TEXT,
  plan_year       INT,
  branch_id       UUID,
  admin_unit_code TEXT,
  item_id         UUID,
  item_code       TEXT,
  item_title      TEXT,
  planned_month   DATE,
  baseline_month  DATE,
  forecast_month  DATE,
  health          TEXT,
  steps_done      INT,
  steps_total     INT,
  next_step       TEXT,
  next_step_date  DATE,
  outcome         TEXT,
  payment_status  TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of DATE := COALESCE(p_as_of, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE);
BEGIN
  RETURN QUERY
  WITH pl AS (
    SELECT p.*
      FROM public.auction_plans p
     WHERE p.workspace_id = p_workspace_id
       AND p.status <> 'closed'
       AND public.auction_plan_read_ok(p.workspace_id, p.branch_id, p.id)
  ),
  bl AS (
    SELECT DISTINCT ON (b.plan_id) b.plan_id, b.payload
      FROM public.auction_plan_baselines b
      JOIN pl ON pl.id = b.plan_id
     ORDER BY b.plan_id, b.version DESC
  ),
  bm AS (
    SELECT bl.plan_id,
           (e->>'id')::UUID                      AS item_id,
           NULLIF(e->>'planned_month', '')::DATE AS month
      FROM bl
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bl.payload->'items', '[]'::jsonb)) e
  ),
  it AS (
    SELECT i.*, pl.title AS p_title, pl.status AS p_status, pl.plan_year AS p_year,
           pl.admin_unit_code AS p_unit,
           COALESCE(bm.month, i.planned_month) AS base_month
      FROM public.auction_plan_items i
      JOIN pl ON pl.id = i.plan_id
      LEFT JOIN bm ON bm.plan_id = i.plan_id AND bm.item_id = i.id
     WHERE i.exec_status = 'active'
  ),
  st AS (
    SELECT s.item_id,
           count(*)::INT         AS total,
           count(s.done_on)::INT AS done,
           jsonb_agg(jsonb_build_object(
             'sort_order',   s.sort_order,
             'planned_date', s.planned_date,
             'done_on',      s.done_on
           ) ORDER BY s.sort_order) AS payload,
           (array_agg(s.step ORDER BY s.sort_order) FILTER (WHERE s.done_on IS NULL))[1]         AS nxt,
           (array_agg(s.planned_date ORDER BY s.sort_order) FILTER (WHERE s.done_on IS NULL))[1] AS nxt_date
      FROM public.auction_plan_item_steps s
      JOIN it ON it.id = s.item_id
     GROUP BY s.item_id
  ),
  oc AS (
    SELECT * FROM public.auction_plan_outcome_rows(p_workspace_id)
  )
  SELECT it.plan_id, it.p_title, it.p_status, it.p_year, it.branch_id, it.p_unit,
         it.id, it.item_code, it.title,
         it.planned_month, it.base_month, it.forecast_month,
         public.auction_plan_item_health(
           it.exec_status,
           it.base_month,
           it.forecast_month,
           COALESCE(st.payload, '[]'::jsonb),
           CASE WHEN o.item_id IS NULL THEN NULL
                ELSE jsonb_build_object('outcome', o.outcome, 'payment_status', o.payment_status) END,
           v_as_of
         ),
         COALESCE(st.done, 0), COALESCE(st.total, 0),
         st.nxt, st.nxt_date,
         o.outcome, o.payment_status
    FROM it
    LEFT JOIN st ON st.item_id = it.id
    LEFT JOIN oc o ON o.item_id = it.id
   WHERE (it.base_month      IS NOT NULL AND it.base_month      BETWEEN p_from AND p_to)
      OR (it.forecast_month  IS NOT NULL AND it.forecast_month  BETWEEN p_from AND p_to)
   ORDER BY COALESCE(it.forecast_month, it.base_month), it.p_title, it.seq;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_month_items(UUID, DATE, DATE, DATE) IS
  'Tài sản kế hoạch có tháng BẢN MỐC hoặc tháng dự kiến mới nằm trong [p_from, p_to], kèm sức khoẻ (auction_plan_item_health) và mốc tiếp theo. Nguồn của trang "Vận hành tháng".';

REVOKE ALL ON FUNCTION public.auction_plan_month_items(UUID, DATE, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_month_items(UUID, DATE, DATE, DATE) TO authenticated;

-- Báo cáo định kỳ của Trạm Điều Hành — Phase 10 của docs/owner-control-tower-plan.md (§A5).
--
-- Cán bộ lập báo cáo kỳ (tháng / quý / năm) gửi lên trụ sở: tiến độ chỉ tiêu · kết
-- quả phiên trong kỳ · tiền đã thu / chờ thu / bỏ cọc · tài sản tồn đọng · kế hoạch
-- kỳ tới · ghi chú của cán bộ. Mỗi con số mang nhãn nguồn (§A3).
--
-- Vòng đời:
--   draft  = bản nháp: số liệu TÍNH LẠI mỗi lần mở (owner_build_report_payload).
--            Cán bộ ('write', trong phạm vi chi nhánh) tạo / sửa / xoá được.
--   final  = đã chốt: payload JSONB ĐÓNG BĂNG do SERVER dựng lúc chốt
--            (owner_finalize_report, chỉ 'send_report'). Không sửa, không xoá
--            (người dùng chốt 2026-09-26) — muốn đính chính thì lập báo cáo mới.
-- Client KHÔNG BAO GIỜ gửi số liệu: quyền cột chặn ghi status / payload / finalized_*.
--
-- Payload không bao giờ chứa workspace_id, danh tính người trúng hay evidence_urls
-- (Phase 11 sẽ công khai nó qua link /r/:token). Tài sản định danh bằng asset_code
-- (8 ký tự hex đầu của listing id, như "Mã" ở trang Kết quả phiên) + tên.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Bảng
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.owner_report_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- NULL = cả đơn vị. Xoá chi nhánh ⇒ NULL; tên phạm vi của báo cáo đã chốt vẫn
  -- nằm nguyên trong payload.meta.scope.
  branch_id     UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  period_type   TEXT NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  period_start  DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 4000),
  plan_note     TEXT CHECK (plan_note IS NULL OR char_length(plan_note) <= 4000),
  payload       JSONB,
  finalized_at  TIMESTAMPTZ,
  finalized_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cùng luật với owt_period_aligned (chỉ tiêu, Phase 9).
  CONSTRAINT ors_period_aligned CHECK (
    extract(day FROM period_start) = 1
    AND CASE period_type
          WHEN 'month'   THEN true
          WHEN 'quarter' THEN extract(month FROM period_start) IN (1, 4, 7, 10)
          WHEN 'year'    THEN extract(month FROM period_start) = 1
        END
  ),
  CONSTRAINT ors_final_frozen CHECK (
    (status = 'final') = (payload IS NOT NULL AND finalized_at IS NOT NULL)
  )
);

CREATE INDEX idx_ors_ws_period    ON public.owner_report_snapshots (workspace_id, period_start DESC);
CREATE INDEX idx_ors_branch       ON public.owner_report_snapshots (branch_id);
CREATE INDEX idx_ors_created_by   ON public.owner_report_snapshots (created_by);
CREATE INDEX idx_ors_finalized_by ON public.owner_report_snapshots (finalized_by);

CREATE TRIGGER owner_report_snapshots_updated_at
  BEFORE UPDATE ON public.owner_report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Trigger bảo vệ — chạy TRƯỚC _updated_at (thứ tự tên).
--    SECURITY DEFINER: kiểm chi nhánh không phụ thuộc RLS của người gọi.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_report_snapshots_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      -- Người lập là người đang đăng nhập; báo cáo luôn sinh ra ở dạng nháp.
      NEW.created_by := auth.uid();
      IF NEW.status <> 'draft' OR NEW.payload IS NOT NULL
         OR NEW.finalized_at IS NOT NULL OR NEW.finalized_by IS NOT NULL THEN
        RAISE EXCEPTION 'Báo cáo mới phải ở dạng nháp';
      END IF;
    END IF;
  ELSE
    IF OLD.status = 'final' THEN
      -- Đã chốt ⇒ đóng băng. Ngoại lệ duy nhất: hành động SET NULL của FK khi
      -- chi nhánh bị xoá (updated_at do trigger kế tiếp tự đặt).
      IF (to_jsonb(NEW) - 'branch_id' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'branch_id' - 'updated_at')
         OR (NEW.branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM OLD.branch_id) THEN
        RAISE EXCEPTION 'Báo cáo đã chốt không thể sửa';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'Không thể chuyển báo cáo sang không gian khác';
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_id IS DISTINCT FROM OLD.branch_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.workspace_branches wb
        WHERE wb.id = NEW.branch_id AND wb.workspace_id = NEW.workspace_id
     ) THEN
    RAISE EXCEPTION 'Chi nhánh không thuộc đơn vị này';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_report_snapshots_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_report_snapshots_guard
  BEFORE INSERT OR UPDATE ON public.owner_report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.owner_report_snapshots_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Quyền bảng + RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.owner_report_snapshots ENABLE ROW LEVEL SECURITY;

-- Báo cáo nợ xấu là dữ liệu nhạy cảm: anon không có quyền bảng.
REVOKE ALL ON public.owner_report_snapshots FROM anon;
-- Quyền CỘT: client chỉ ghi được kỳ / phạm vi / ghi chú. status, payload,
-- finalized_* chỉ do owner_finalize_report (SECURITY DEFINER) ghi.
REVOKE INSERT, UPDATE ON public.owner_report_snapshots FROM authenticated;
GRANT INSERT (workspace_id, branch_id, period_type, period_start, notes, plan_note)
  ON public.owner_report_snapshots TO authenticated;
GRANT UPDATE (branch_id, period_type, period_start, notes, plan_note)
  ON public.owner_report_snapshots TO authenticated;

CREATE POLICY "owner_report_snapshots_read" ON public.owner_report_snapshots
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

-- Cán bộ bị giới hạn chi nhánh chỉ lập / sửa / xoá nháp của chi nhánh mình
-- (owner_ws_branch_ok trả false cho báo cáo cả đơn vị — branch_id NULL).
CREATE POLICY "owner_report_snapshots_insert" ON public.owner_report_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'draft'
    AND public.owner_ws_can(workspace_id, 'write')
    AND public.owner_ws_branch_ok(workspace_id, branch_id)
  );

CREATE POLICY "owner_report_snapshots_update" ON public.owner_report_snapshots
  FOR UPDATE TO authenticated
  USING (
    status = 'draft'
    AND public.owner_ws_can(workspace_id, 'write')
    AND public.owner_ws_branch_ok(workspace_id, branch_id)
  )
  WITH CHECK (
    status = 'draft'
    AND public.owner_ws_can(workspace_id, 'write')
    AND public.owner_ws_branch_ok(workspace_id, branch_id)
  );

-- Chỉ xoá được NHÁP. Báo cáo đã chốt không ai xoá được (trừ khi xoá cả không gian).
CREATE POLICY "owner_report_snapshots_delete" ON public.owner_report_snapshots
  FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND public.owner_ws_can(workspace_id, 'write')
    AND public.owner_ws_branch_ok(workspace_id, branch_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Luật "Đã thu" — BẢN SAO của recoveryOf() trong src/lib/ownerTargets.ts.
--    SỬA MỘT BÊN THÌ PHẢI SỬA CẢ HAI.
--    paid → paid_amount ?? giá · partial → paid_amount (phần còn lại chờ thu) ·
--    pending → 0 (cả giá chờ thu) · defaulted → loại hẳn (không đếm, không tiền) ·
--    nguồn không theo dõi thu tiền (NULL / giá trị lạ — như oneOf() trả null) →
--    tạm tính bằng giá trúng. Mọi số ≤ 0 / NULL coi là 0 (positive()).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_report_recovery(
  p_price          NUMERIC,
  p_payment_status TEXT,
  p_paid_amount    NUMERIC
)
RETURNS TABLE (counted BOOLEAN, recorded NUMERIC, estimated NUMERIC, awaiting NUMERIC)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT p_payment_status IS DISTINCT FROM 'defaulted',
         CASE p_payment_status
           WHEN 'paid'    THEN CASE WHEN p_paid_amount IS NOT NULL THEN x.paid ELSE x.price END
           WHEN 'partial' THEN x.paid
           ELSE 0
         END,
         CASE WHEN p_payment_status IN ('paid', 'partial', 'pending', 'defaulted') THEN 0 ELSE x.price END,
         CASE p_payment_status
           WHEN 'partial' THEN greatest(0, x.price - x.paid)
           WHEN 'pending' THEN x.price
           ELSE 0
         END
    FROM (SELECT CASE WHEN p_price > 0 THEN p_price ELSE 0 END             AS price,
                 CASE WHEN p_paid_amount > 0 THEN p_paid_amount ELSE 0 END AS paid) x
$$;

GRANT EXECUTE ON FUNCTION public.owner_report_recovery(NUMERIC, TEXT, NUMERIC) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Dựng payload báo cáo (version 1).
--
--    Nguồn số liệu = các dòng owner_outcomes_overview (Phase 8) — CÙNG nguồn với
--    trang "Kết quả phiên" và Chỉ tiêu (Phase 9); KHÔNG gộp nguồn lần hai.
--    Hai loại mục:
--      • theo KỲ  (targets / results / money): ngày phiên (resolved_date) trong kỳ,
--        tính cả hai đầu; dòng không ngày không thuộc kỳ nào.
--      • theo TRẠNG THÁI tính đến as_of (hôm nay, giờ VN): money.carry_over,
--        stuck, plan.
--    Tồn đọng (§A5): chưa bán (và không rút khỏi đấu giá) sau ≥ 3 lượt, HOẶC đã hơn
--    90 ngày kể từ lần đầu được biết tới (phiên giá sớm nhất / lượt tự khai sớm nhất
--    / ngày tin lên sàn) — người dùng chốt 2026-09-26.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_build_report_payload(
  p_workspace_id UUID,
  p_period_type  TEXT,
  p_period_start DATE,
  p_branch_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
  tg AS (
    SELECT t.*, br.name AS branch_name
      FROM public.owner_workspace_targets t
      LEFT JOIN br ON br.id = t.branch_id
     WHERE t.workspace_id = p_workspace_id
       AND t.period_type = p_period_type
       AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
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
$$;

REVOKE ALL ON FUNCTION public.owner_build_report_payload(UUID, TEXT, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_build_report_payload(UUID, TEXT, DATE, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Chốt báo cáo — chỉ 'send_report'. Server tự dựng payload (client không gửi
--    số), chèn ghi chú + người lập / người chốt, rồi đóng băng.
--    Trả {ok:false, reason} cho thất bại dự kiến ⇒ client phải kiểm ok.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_finalize_report(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r         public.owner_report_snapshots%ROWTYPE;
  v_payload JSONB;
  v_now     TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO r FROM public.owner_report_snapshots WHERE id = p_report_id FOR UPDATE;
  -- Không phải thành viên ⇒ giả như không tồn tại (không lộ id của không gian khác).
  IF NOT FOUND OR NOT public.owner_ws_can(r.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_can(r.workspace_id, 'send_report') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF r.status = 'final' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_final');
  END IF;

  v_payload := public.owner_build_report_payload(r.workspace_id, r.period_type, r.period_start, r.branch_id)
    || jsonb_build_object(
         'notes', jsonb_build_object(
           'officer', NULLIF(btrim(r.notes), ''),
           'plan',    NULLIF(btrim(r.plan_note), '')),
         'people', jsonb_build_object(
           'prepared_by',  (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.id = r.created_by),
           'finalized_by', (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.id = auth.uid())),
         'finalized_at', v_now);

  UPDATE public.owner_report_snapshots
     SET status       = 'final',
         payload      = v_payload,
         finalized_at = v_now,
         finalized_by = auth.uid()
   WHERE id = r.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_finalize_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_finalize_report(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.owner_report_snapshots'::regclass) THEN
    RAISE EXCEPTION 'owner_report_snapshots self-check: chưa bật RLS';
  END IF;

  IF has_table_privilege('anon', 'public.owner_report_snapshots', 'SELECT') THEN
    RAISE EXCEPTION 'owner_report_snapshots self-check: anon còn quyền đọc bảng';
  END IF;

  IF has_column_privilege('authenticated', 'public.owner_report_snapshots', 'payload', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.owner_report_snapshots', 'status', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.owner_report_snapshots', 'payload', 'INSERT')
     OR has_column_privilege('authenticated', 'public.owner_report_snapshots', 'status', 'INSERT') THEN
    RAISE EXCEPTION 'owner_report_snapshots self-check: client còn ghi được status/payload';
  END IF;

  IF has_function_privilege('authenticated', 'public.owner_report_snapshots_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_report_snapshots self-check: trigger guard đang mở cho authenticated';
  END IF;

  IF has_function_privilege('anon', 'public.owner_build_report_payload(uuid, text, date, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_finalize_report(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_report_snapshots self-check: anon gọi được RPC báo cáo';
  END IF;
END;
$$;

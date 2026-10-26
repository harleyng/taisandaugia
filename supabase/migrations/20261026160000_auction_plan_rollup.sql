-- Kế hoạch đấu giá — Phase 7: tổng hợp toàn tỉnh.
-- docs/owner-auction-planning-plan.md §A2 (hai hình triển khai), §A4.1 (đợt lập
-- kế hoạch), §A5 (bảng chỉ số + roll-up), §A6 (màn "Toàn tỉnh").
--
-- Bốn hàm:
--   1. `auction_plan_province_ok(ws)`     — cổng của mọi màn CẤP TỈNH.
--   2. `auction_plan_rollup(...)`         — một dòng / một đơn vị hành chính.
--   3. `auction_plan_consolidated(ws, y)` — danh mục hợp nhất để in / xuất Excel.
--   4. `auction_plan_cycle_candidates(ws)`— các xã có thể đưa vào một đợt.
--
-- ⚠️ KHÔNG định nghĩa lại bất cứ luật nào:
--   · chỉ số kỳ  → `auction_plan_period_metrics(plan, type, start)` (Phase 6);
--   · sức khoẻ   → `auction_plan_item_health_rows(plan, as_of)` (Phase 5);
--   · kết quả    → nằm trong hai hàm trên, gốc là `auction_plan_outcome_rows`.
--   Nhờ vậy "tổng của tỉnh = tổng các số 'Theo kỳ' của từng xã" đúng do CẤU TRÚC
--   chứ không do may mắn.
--
-- ⚠️ `auction_plan_due_steps` là SECURITY INVOKER (RLS là cổng) ⇒ hàm DEFINER ở
-- đây KHÔNG gọi lại được nó (sẽ không thấy gì). Vì thế roll-up tự lọc kế hoạch
-- bằng `auction_plan_read_ok`, đúng cách `auction_plan_month_items` làm.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Cổng của màn cấp tỉnh
-- ═════════════════════════════════════════════════════════════════════════════

-- "Toàn tỉnh" là màn của CẤP TRÊN (§A6: reviewers only). Hai kiểu người được mở:
--   · người duyệt — `auction_plan_can_approve` (đã bao gồm "không bị giới hạn
--     chi nhánh", §A7);
--   · thành viên KHÔNG bị giới hạn chi nhánh có `ke-hoach:view` — phạm vi của họ
--     CHÍNH LÀ cả Trạm, nên họ đọc được bảng tổng hợp (§A5 "reviewer or read").
-- Cán bộ xã (có `branch_scope`) rơi ra ở cả hai nhánh: `owner_ws_branch_ok(ws, NULL)`
-- trả false khi `branch_scope` khác NULL — đây là tiêu chí nghiệm thu của pha này.
CREATE OR REPLACE FUNCTION public.auction_plan_province_ok(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.auction_plan_can_approve(p_workspace_id)
      OR (public.owner_ws_has(p_workspace_id, 'ke-hoach', 'view')
          AND public.owner_ws_branch_ok(p_workspace_id, NULL))
$$;

COMMENT ON FUNCTION public.auction_plan_province_ok(UUID) IS
  'Người đang đăng nhập được mở màn CẤP TỈNH của Kế hoạch đấu giá (Toàn tỉnh, đợt lập kế hoạch, danh mục hợp nhất): người duyệt, hoặc thành viên có ke-hoach:view mà KHÔNG bị giới hạn chi nhánh. Cán bộ bị giới hạn chi nhánh luôn false.';

REVOKE ALL ON FUNCTION public.auction_plan_province_ok(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_province_ok(UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. auction_plan_rollup — một dòng cho mỗi đơn vị hành chính
-- ═════════════════════════════════════════════════════════════════════════════

-- Tập đơn vị = HỢP của bốn nguồn, nên một xã chưa trình (thậm chí chưa lập) vẫn
-- có dòng:
--   ① xã được gọi tên trong một đợt của năm (hình A: `branch_id`, hình B: `child_workspace_id`);
--   ② chi nhánh đang hoạt động có mã ĐVHC (hình A, kể cả khi tỉnh chưa mở đợt);
--   ③ Trạm con đã liên kết có mã ĐVHC (hình B);
--   ④ mã ĐVHC của các kế hoạch năm đó (gồm cả kế hoạch CẤP TỈNH, `level='province'`).
--
-- Số của kỳ (planned_* / offered / sold / winning / collected…) = TỔNG các dòng
-- `auction_plan_period_metrics` của từng kế hoạch của xã đó trong năm (năm +
-- bổ sung). `late_count` / `at_risk_count` tính trên TOÀN kế hoạch, không theo
-- kỳ — câu hỏi của tỉnh là "xã nào đang trễ", không phải "trễ trong tháng nào".
CREATE OR REPLACE FUNCTION public.auction_plan_rollup(
  p_workspace_id UUID,
  p_year         INT,
  p_period_type  TEXT,
  p_period_start DATE
)
RETURNS TABLE (
  admin_unit_code      TEXT,
  unit_name            TEXT,
  unit_level           TEXT,
  shape                TEXT,
  branch_id            UUID,
  child_workspace_id   UUID,
  in_cycle             BOOLEAN,
  cycle_id             UUID,
  cycle_kind           TEXT,
  cycle_status         TEXT,
  submit_deadline      DATE,
  cycle_plan_id        UUID,
  cycle_plan_status    TEXT,
  assigned_revenue     NUMERIC,
  assigned_count       INT,
  plan_count           INT,
  plan_id              UUID,
  plan_status          TEXT,
  plan_statuses        TEXT[],
  has_submitted        BOOLEAN,
  is_returned          BOOLEAN,
  period_type          TEXT,
  period_start         DATE,
  period_end           DATE,
  planned_count        INT,
  planned_start_value  NUMERIC,
  offered_count        INT,
  sold_count           INT,
  actual_start_value   NUMERIC,
  winning_total        NUMERIC,
  collected            NUMERIC,
  recorded             NUMERIC,
  estimated            NUMERIC,
  awaiting             NUMERIC,
  done_pct             INT,
  late_count           INT,
  at_risk_count        INT,
  last_update          TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
  v_as_of DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;
BEGIN
  IF p_period_type IS NULL OR p_period_type NOT IN ('month', 'quarter', 'year') THEN
    RAISE EXCEPTION 'bad_period_type' USING ERRCODE = '22023';
  END IF;
  IF p_year IS NULL OR NOT public.auction_plan_province_ok(p_workspace_id) THEN
    RETURN;
  END IF;

  v_start := date_trunc(CASE p_period_type WHEN 'month' THEN 'month'
                                           WHEN 'quarter' THEN 'quarter'
                                           ELSE 'year' END,
                        COALESCE(p_period_start, make_date(p_year, 1, 1)))::DATE;
  v_end   := (v_start + CASE p_period_type WHEN 'month'   THEN INTERVAL '1 month'
                                           WHEN 'quarter' THEN INTERVAL '3 months'
                                           ELSE INTERVAL '1 year' END
              - INTERVAL '1 day')::DATE;

  RETURN QUERY
  WITH pl AS (
    -- Kế hoạch của năm mà NGƯỜI GỌI đọc được: hình A (cùng Trạm, mọi chi nhánh)
    -- + hình B (Trạm con đã liên kết). `auction_plan_read_ok` là cổng duy nhất.
    SELECT p.id AS p_id, p.admin_unit_code AS code, p.kind AS p_kind, p.status AS p_status,
           p.cycle_id AS p_cycle, p.updated_at AS p_updated, p.created_at AS p_created
      FROM public.auction_plans p
     WHERE p.plan_year = p_year
       AND (p.workspace_id = p_workspace_id
            OR p.workspace_id IN (SELECT w.id FROM public.asset_owner_workspaces w
                                   WHERE w.parent_workspace_id = p_workspace_id))
       AND public.auction_plan_read_ok(p.workspace_id, p.branch_id, p.id)
  ),
  cu AS (
    SELECT u.admin_unit_code AS code, u.branch_id AS b_id, u.child_workspace_id AS w_id,
           u.assigned_revenue AS a_rev, u.assigned_count AS a_cnt,
           c.id AS c_id, c.kind AS c_kind, c.status AS c_status, c.submit_deadline AS c_deadline
      FROM public.auction_plan_cycle_units u
      JOIN public.auction_plan_cycles c ON c.id = u.cycle_id
     WHERE c.workspace_id = p_workspace_id AND c.plan_year = p_year
  ),
  cu_pick AS (
    -- Một xã có thể nằm trong HAI đợt cùng năm (đợt năm + đợt bổ sung): dòng hiển
    -- thị lấy đợt ĐANG MỞ trước, rồi hạn trình muộn nhất.
    SELECT DISTINCT ON (cu.code) cu.*
      FROM cu
     ORDER BY cu.code, (cu.c_status = 'open') DESC, cu.c_deadline DESC NULLS LAST, cu.c_id
  ),
  cu_sum AS (
    SELECT cu.code,
           sum(cu.a_rev)    AS a_rev,
           sum(cu.a_cnt)::INT AS a_cnt
      FROM cu GROUP BY cu.code
  ),
  br AS (
    SELECT DISTINCT ON (b.admin_unit_code) b.admin_unit_code AS code, b.id AS b_id
      FROM public.workspace_branches b
     WHERE b.workspace_id = p_workspace_id
       AND b.admin_unit_code IS NOT NULL
       AND b.is_active
     ORDER BY b.admin_unit_code, b.id
  ),
  ch AS (
    SELECT DISTINCT ON (w.admin_unit_code) w.admin_unit_code AS code, w.id AS w_id
      FROM public.asset_owner_workspaces w
     WHERE w.parent_workspace_id = p_workspace_id
       AND w.admin_unit_code IS NOT NULL
     ORDER BY w.admin_unit_code, w.id
  ),
  codes AS (
    SELECT cu.code FROM cu
    UNION SELECT br.code FROM br
    UNION SELECT ch.code FROM ch
    UNION SELECT pl.code FROM pl
  ),
  unit AS (
    SELECT k.code,
           COALESCE(a.name, k.code)                           AS u_name,
           COALESCE(a.level, 'commune')                       AS u_level,
           COALESCE(cp.b_id, br.b_id)                         AS b_id,
           COALESCE(cp.w_id, ch.w_id)                         AS w_id,
           (cp.code IS NOT NULL)                              AS flag_cycle,
           cp.c_id, cp.c_kind, cp.c_status, cp.c_deadline,
           cs.a_rev, cs.a_cnt
      FROM codes k
      LEFT JOIN public.admin_units a ON a.code = k.code
      LEFT JOIN cu_pick cp ON cp.code = k.code
      LEFT JOIN cu_sum  cs ON cs.code = k.code
      LEFT JOIN br ON br.code = k.code
      LEFT JOIN ch ON ch.code = k.code
  ),
  pl_pick AS (
    -- Kế hoạch "đại diện" của xã: kế hoạch NĂM nếu có, sau đó bản mới nhất.
    SELECT DISTINCT ON (pl.code) pl.code, pl.p_id, pl.p_status
      FROM pl
     ORDER BY pl.code, (pl.p_kind = 'annual') DESC, pl.p_created DESC
  ),
  pl_agg AS (
    SELECT pl.code,
           count(*)::INT AS n_plans,
           array_agg(pl.p_status ORDER BY (pl.p_kind = 'annual') DESC, pl.p_created) AS st_list,
           bool_or(pl.p_status IN ('submitted', 'approved', 'adjusting', 'closed')) AS f_submitted,
           bool_or(pl.p_status = 'returned') AS f_returned,
           max(pl.p_updated) AS p_updated
      FROM pl GROUP BY pl.code
  ),
  cyc_plan AS (
    -- Kế hoạch mà xã đã lập CHO ĐÚNG đợt đang hiển thị (cột `cycle_id` của kế
    -- hoạch). NULL ⇒ xã chưa lập kế hoạch cho đợt đó, dù năm đó đã có kế hoạch
    -- khác — đó là cơ sở của thẻ "Chưa trình" ở tầng L2.
    SELECT DISTINCT ON (pl.code) pl.code, pl.p_id AS cp_id, pl.p_status AS cp_status
      FROM pl
      JOIN cu_pick cp ON cp.code = pl.code AND pl.p_cycle = cp.c_id
     ORDER BY pl.code, pl.p_created DESC
  ),
  met AS (
    SELECT pl.code,
           m.planned_count       AS m_planned,
           m.planned_start_value AS m_pval,
           m.offered_count       AS m_offered,
           m.sold_count          AS m_sold,
           m.actual_start_value  AS m_sval,
           m.winning_total       AS m_win,
           m.collected           AS m_coll,
           m.recorded            AS m_rec,
           m.estimated           AS m_est,
           m.awaiting            AS m_awa
      FROM pl
      CROSS JOIN LATERAL public.auction_plan_period_metrics(pl.p_id, p_period_type, v_start) m
  ),
  met_agg AS (
    SELECT met.code,
           sum(met.m_planned)::INT AS m_planned,
           sum(met.m_pval)         AS m_pval,
           sum(met.m_offered)::INT AS m_offered,
           sum(met.m_sold)::INT    AS m_sold,
           sum(met.m_sval)         AS m_sval,
           sum(met.m_win)          AS m_win,
           sum(met.m_coll)         AS m_coll,
           sum(met.m_rec)          AS m_rec,
           sum(met.m_est)          AS m_est,
           sum(met.m_awa)          AS m_awa
      FROM met GROUP BY met.code
  ),
  hl AS (
    SELECT pl.code,
           count(*) FILTER (WHERE h.health = 'late')::INT    AS h_late,
           count(*) FILTER (WHERE h.health = 'at_risk')::INT AS h_risk
      FROM pl
      CROSS JOIN LATERAL public.auction_plan_item_health_rows(pl.p_id, v_as_of) h
     GROUP BY pl.code
  ),
  iu AS (
    SELECT pl.code, max(i.updated_at) AS i_updated
      FROM pl JOIN public.auction_plan_items i ON i.plan_id = pl.p_id
     GROUP BY pl.code
  )
  SELECT u.code,
         u.u_name,
         u.u_level,
         CASE WHEN u.b_id IS NOT NULL THEN 'branch'
              WHEN u.w_id IS NOT NULL THEN 'child'
              ELSE 'none' END,
         u.b_id,
         u.w_id,
         COALESCE(u.flag_cycle, false),
         u.c_id, u.c_kind, u.c_status, u.c_deadline,
         cq.cp_id, cq.cp_status,
         u.a_rev, u.a_cnt,
         COALESCE(pa.n_plans, 0),
         pp.p_id, pp.p_status,
         COALESCE(pa.st_list, '{}'::TEXT[]),
         COALESCE(pa.f_submitted, false),
         COALESCE(pa.f_returned, false),
         p_period_type, v_start, v_end,
         COALESCE(ma.m_planned, 0), COALESCE(ma.m_pval, 0),
         COALESCE(ma.m_offered, 0), COALESCE(ma.m_sold, 0),
         COALESCE(ma.m_sval, 0),    COALESCE(ma.m_win, 0),
         COALESCE(ma.m_coll, 0),    COALESCE(ma.m_rec, 0),
         COALESCE(ma.m_est, 0),     COALESCE(ma.m_awa, 0),
         -- Cùng luật với planVsActual / auction_plan_period_metrics: làm tròn
         -- XUỐNG, và NULL (hiện "—") khi kỳ không có tài sản theo kế hoạch.
         CASE WHEN COALESCE(ma.m_planned, 0) > 0
              THEN floor(COALESCE(ma.m_sold, 0)::NUMERIC * 100 / ma.m_planned)::INT END,
         COALESCE(hl.h_late, 0),
         COALESCE(hl.h_risk, 0),
         GREATEST(pa.p_updated, iu.i_updated)
    FROM unit u
    LEFT JOIN cyc_plan cq ON cq.code = u.code
    LEFT JOIN pl_pick pp ON pp.code = u.code
    LEFT JOIN pl_agg  pa ON pa.code = u.code
    LEFT JOIN met_agg ma ON ma.code = u.code
    LEFT JOIN hl         ON hl.code = u.code
    LEFT JOIN iu         ON iu.code = u.code
   ORDER BY u.u_level DESC, u.u_name, u.code;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_rollup(UUID, INT, TEXT, DATE) IS
  'Tổng hợp "Toàn tỉnh" (§A5): một dòng cho mỗi đơn vị hành chính của Trạm tỉnh trong một năm — tình trạng kế hoạch, chỉ tiêu giao, kế hoạch so thực tế của kỳ (TỔNG các auction_plan_period_metrics), số tài sản trễ / nguy cơ trễ (auction_plan_item_health_rows), lần cập nhật cuối. Cổng: auction_plan_province_ok. Hình A (chi nhánh) và hình B (Trạm con) dùng cùng một khoá: mã ĐVHC.';

REVOKE ALL ON FUNCTION public.auction_plan_rollup(UUID, INT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_rollup(UUID, INT, TEXT, DATE) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. auction_plan_consolidated — danh mục hợp nhất của cả tỉnh
-- ═════════════════════════════════════════════════════════════════════════════

-- Nguồn là BẢN MỐC mới nhất của mọi kế hoạch ĐÃ TỪNG ĐƯỢC DUYỆT (`baseline_version
-- >= 1` và trạng thái `approved` / `adjusting` / `closed`) — kể cả kế hoạch cấp
-- tỉnh (`level='province'`). Bản mốc là cam kết đã ký; danh mục đang soạn không
-- vào bảng hợp nhất. Giữ kế hoạch `adjusting` để một xã đang điều chỉnh không
-- biến mất khỏi bảng tổng hợp của tỉnh (bản in vẫn là bản mốc đã ký).
CREATE OR REPLACE FUNCTION public.auction_plan_consolidated(p_workspace_id UUID, p_year INT)
RETURNS TABLE (
  admin_unit_code      TEXT,
  unit_name            TEXT,
  unit_level           TEXT,
  plan_id              UUID,
  plan_title           TEXT,
  plan_kind            TEXT,
  plan_level           TEXT,
  plan_status          TEXT,
  baseline_version     INT,
  approval_doc_no      TEXT,
  approval_doc_date    DATE,
  seq                  INT,
  item_code            TEXT,
  asset_type           TEXT,
  title                TEXT,
  lot_labels           TEXT,
  lot_count            INT,
  map_sheet            TEXT,
  parcel_no            TEXT,
  location             TEXT,
  area_m2              NUMERIC,
  land_use_code        TEXT,
  allocation_form      TEXT,
  unit_start_price     NUMERIC,
  expected_start_value NUMERIC,
  planned_month        DATE,
  planned_method       TEXT,
  executing_unit       TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_year IS NULL OR NOT public.auction_plan_province_ok(p_workspace_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH pl AS (
    SELECT p.id, p.admin_unit_code AS code, p.title, p.kind, p.level, p.status
      FROM public.auction_plans p
     WHERE p.plan_year = p_year
       AND p.baseline_version >= 1
       AND p.status IN ('approved', 'adjusting', 'closed')
       AND (p.workspace_id = p_workspace_id
            OR p.workspace_id IN (SELECT w.id FROM public.asset_owner_workspaces w
                                   WHERE w.parent_workspace_id = p_workspace_id))
       AND public.auction_plan_read_ok(p.workspace_id, p.branch_id, p.id)
  ),
  bl AS (
    SELECT DISTINCT ON (b.plan_id)
           b.plan_id, b.version, b.approval_doc_no, b.approval_doc_date, b.payload
      FROM public.auction_plan_baselines b
      JOIN pl ON pl.id = b.plan_id
     ORDER BY b.plan_id, b.version DESC
  )
  SELECT pl.code,
         COALESCE(a.name, pl.code),
         COALESCE(a.level, 'commune'),
         pl.id, pl.title, pl.kind, pl.level, pl.status,
         bl.version, bl.approval_doc_no, bl.approval_doc_date,
         (e->>'seq')::INT,
         e->>'item_code',
         e->>'asset_type',
         e->>'title',
         e->>'lot_labels',
         NULLIF(e->>'lot_count', '')::INT,
         e->>'map_sheet',
         e->>'parcel_no',
         e->>'location',
         NULLIF(e->>'area_m2', '')::NUMERIC,
         e->>'land_use_code',
         e->>'allocation_form',
         NULLIF(e->>'unit_start_price', '')::NUMERIC,
         NULLIF(e->>'expected_start_value', '')::NUMERIC,
         NULLIF(e->>'planned_month', '')::DATE,
         e->>'planned_method',
         e->>'executing_unit'
    FROM bl
    JOIN pl ON pl.id = bl.plan_id
    LEFT JOIN public.admin_units a ON a.code = pl.code
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bl.payload->'items', '[]'::jsonb)) e
   ORDER BY COALESCE(a.level, 'commune') DESC, COALESCE(a.name, pl.code),
            (pl.kind = 'annual') DESC, (e->>'seq')::INT;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_consolidated(UUID, INT) IS
  'Danh mục hợp nhất toàn tỉnh của một năm: mọi tài sản trong BẢN MỐC mới nhất của các kế hoạch đã từng được duyệt (gồm kế hoạch cấp tỉnh), nhóm theo đơn vị hành chính. Nguồn của bản in tổng hợp và của Excel một sheet mỗi xã. Cổng: auction_plan_province_ok.';

REVOKE ALL ON FUNCTION public.auction_plan_consolidated(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_consolidated(UUID, INT) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. auction_plan_cycle_candidates — các xã chọn được khi mở đợt
-- ═════════════════════════════════════════════════════════════════════════════

-- Hộp thoại "Mở đợt lập kế hoạch" cần đúng hai hình của §A2 trong một danh sách:
-- chi nhánh có mã ĐVHC (hình A) và Trạm con đã liên kết có mã ĐVHC (hình B).
-- CHỈ đơn vị cấp xã — một đợt là việc tỉnh giao cho xã, không giao cho chính mình.
CREATE OR REPLACE FUNCTION public.auction_plan_cycle_candidates(p_workspace_id UUID)
RETURNS TABLE (
  admin_unit_code    TEXT,
  unit_name          TEXT,
  unit_type          TEXT,
  shape              TEXT,
  branch_id          UUID,
  child_workspace_id UUID,
  display_name       TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auction_plan_province_ok(p_workspace_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.code, a.name, a.unit_type, 'branch'::TEXT, b.id, NULL::UUID,
         COALESCE(NULLIF(b.display_name, ''), a.name)
    FROM public.workspace_branches b
    JOIN public.admin_units a ON a.code = b.admin_unit_code
   WHERE b.workspace_id = p_workspace_id AND b.is_active AND a.level = 'commune'
  UNION ALL
  SELECT a.code, a.name, a.unit_type, 'child'::TEXT, NULL::UUID, w.id,
         COALESCE(NULLIF(w.primary_name, ''), a.name)
    FROM public.asset_owner_workspaces w
    JOIN public.admin_units a ON a.code = w.admin_unit_code
   WHERE w.parent_workspace_id = p_workspace_id AND a.level = 'commune'
   ORDER BY 2, 1;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_cycle_candidates(UUID) IS
  'Các đơn vị cấp xã có thể đưa vào một đợt lập kế hoạch: chi nhánh có mã ĐVHC (hình A) + Trạm con đã liên kết có mã ĐVHC (hình B). Cổng: auction_plan_province_ok.';

REVOKE ALL ON FUNCTION public.auction_plan_cycle_candidates(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_cycle_candidates(UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. auction_plan_cycle_board — bảng theo dõi MỘT đợt lập kế hoạch
-- ═════════════════════════════════════════════════════════════════════════════

-- `auction_plan_rollup` nhìn theo NĂM (và chọn đợt đang mở để hiển thị hạn trình).
-- Trang chi tiết một đợt cần nhìn theo ĐÚNG đợt đó — kể cả đợt ĐÃ ĐÓNG — nên có
-- hàm riêng. Khớp kế hoạch theo hai bước: `auction_plans.cycle_id` trước, rồi
-- (năm + loại + mã ĐVHC) cho đơn vị lập kế hoạch mà không chọn đợt.
CREATE OR REPLACE FUNCTION public.auction_plan_cycle_board(p_cycle_id UUID)
RETURNS TABLE (
  admin_unit_code    TEXT,
  unit_name          TEXT,
  shape              TEXT,
  branch_id          UUID,
  child_workspace_id UUID,
  assigned_revenue   NUMERIC,
  assigned_count     INT,
  plan_id            UUID,
  plan_status        TEXT,
  linked_to_cycle    BOOLEAN,
  item_count         INT,
  expected_total     NUMERIC,
  submitted_at       TIMESTAMPTZ,
  reviewed_at        TIMESTAMPTZ,
  review_comment     TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.auction_plan_cycles%ROWTYPE;
BEGIN
  SELECT * INTO v_cycle FROM public.auction_plan_cycles WHERE id = p_cycle_id;
  IF NOT FOUND OR NOT public.auction_plan_province_ok(v_cycle.workspace_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH pl AS (
    SELECT p.id AS p_id, p.admin_unit_code AS code, p.kind AS p_kind, p.status AS p_status,
           p.cycle_id AS p_cycle, p.submitted_at AS p_sub, p.reviewed_at AS p_rev,
           p.review_comment AS p_note, p.created_at AS p_created
      FROM public.auction_plans p
     WHERE p.plan_year = v_cycle.plan_year
       AND (p.workspace_id = v_cycle.workspace_id
            OR p.workspace_id IN (SELECT w.id FROM public.asset_owner_workspaces w
                                   WHERE w.parent_workspace_id = v_cycle.workspace_id))
       AND public.auction_plan_read_ok(p.workspace_id, p.branch_id, p.id)
  ),
  pick AS (
    SELECT DISTINCT ON (pl.code) pl.*, (pl.p_cycle = p_cycle_id) AS p_linked
      FROM pl
     WHERE pl.p_cycle = p_cycle_id OR (pl.p_cycle IS NULL AND pl.p_kind = v_cycle.kind)
     ORDER BY pl.code, (pl.p_cycle = p_cycle_id) DESC, pl.p_created DESC
  ),
  it AS (
    SELECT i.plan_id AS i_plan, count(*)::INT AS n_items,
           COALESCE(sum(i.expected_start_value), 0) AS exp_total
      FROM public.auction_plan_items i
      JOIN pick ON pick.p_id = i.plan_id
     WHERE i.exec_status = 'active'
     GROUP BY i.plan_id
  )
  SELECT u.admin_unit_code,
         COALESCE(a.name, u.admin_unit_code),
         CASE WHEN u.branch_id IS NOT NULL THEN 'branch'
              WHEN u.child_workspace_id IS NOT NULL THEN 'child'
              ELSE 'none' END,
         u.branch_id, u.child_workspace_id,
         u.assigned_revenue, u.assigned_count,
         pk.p_id, pk.p_status, COALESCE(pk.p_linked, false),
         COALESCE(it.n_items, 0), COALESCE(it.exp_total, 0),
         pk.p_sub, pk.p_rev, pk.p_note
    FROM public.auction_plan_cycle_units u
    LEFT JOIN public.admin_units a ON a.code = u.admin_unit_code
    LEFT JOIN pick pk ON pk.code = u.admin_unit_code
    LEFT JOIN it ON it.i_plan = pk.p_id
   WHERE u.cycle_id = p_cycle_id
   ORDER BY COALESCE(a.name, u.admin_unit_code), u.admin_unit_code;
END;
$$;

COMMENT ON FUNCTION public.auction_plan_cycle_board(UUID) IS
  'Bảng theo dõi một ĐỢT lập kế hoạch: mỗi đơn vị trong đợt + chỉ tiêu giao + kế hoạch đã lập cho đợt (khớp theo auction_plans.cycle_id, dự phòng theo năm + loại) + tình trạng trình / trả lại. Cổng: auction_plan_province_ok.';

REVOKE ALL ON FUNCTION public.auction_plan_cycle_board(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_cycle_board(UUID) TO authenticated;

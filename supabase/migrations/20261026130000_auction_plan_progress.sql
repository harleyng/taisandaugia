-- Kế hoạch đấu giá — Phase 5: theo dõi thực hiện (mốc, sức khoẻ, mốc do sàn suy ra).
-- docs/owner-auction-planning-plan.md · A4.4 + A5 · quyết định D3 (bảng mốc dùng NGUYÊN VĂN).
--
-- Pha 2 đã dựng bảng `auction_plan_item_steps`, bản mẫu `auction_plan_step_template`
-- và trigger tự sinh mốc khi thêm tài sản. Migration này chỉ làm phần CHƯA có:
--
--   1. Vá mốc thiếu cho tài sản cũ (idempotent — bình thường là 0 dòng).
--   2. `auction_plan_item_health(...)` — BẢN SAO SQL của `planItemHealth()` trong
--      src/lib/auctionPlan/health.ts. Cặp nhân bản SQL ↔ TS thứ NĂM của dự án:
--      sửa một bên PHẢI sửa bên kia cùng lần và chạy lại bảng đối chiếu.
--   3. `auction_plan_item_outcomes(plan)` — kết quả THỰC TẾ của từng tài sản.
--   4. `auction_plan_item_health_rows(plan)` — bộ gom dữ liệu cho P6 / P7 / P8.
--   5. `auction_plan_platform_steps(plan)` — mốc 4,5,6,7,9 do dữ liệu sàn xác nhận.
--   6. `auction_plan_sync_platform_steps(plan)` — GHI các mốc đó (`source='platform'`).
--   7. Trigger "ngày của sàn thắng": một lần tự khai KHÔNG ghi đè được ngày do sàn
--      xác nhận; ngày tự khai được giữ trong `note` (luật A4.4).
--
-- ⚠️ `source` của `auction_plan_item_steps` KHÔNG nằm trong GRANT của client —
-- nhãn "Sàn xác nhận" là lời của sàn. Vì thế mọi hàm ghi `source` phải là
-- SECURITY DEFINER.
-- ⚠️ Bảng của sàn đấu giá trực tuyến (`auction_sessions`, `auction_session_items`,
-- `auction_lot_states`) chỉ ĐỌC — docs/platform-ownership.md.

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Vá mốc thiếu cho tài sản đã có
-- ───────────────────────────────────────────────────────────────────────────────

INSERT INTO public.auction_plan_item_steps (item_id, plan_id, workspace_id, branch_id, step, sort_order)
SELECT i.id, i.plan_id, i.workspace_id, i.branch_id, t.step, t.sort_order
  FROM public.auction_plan_items i
  CROSS JOIN LATERAL public.auction_plan_step_template(i.asset_type) t
ON CONFLICT (item_id, step) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Sức khoẻ của một tài sản — bản sao SQL của planItemHealth() (A5)
-- ───────────────────────────────────────────────────────────────────────────────

-- Hàm THUẦN: mọi dữ liệu truyền vào, không đọc bảng nào ⇒ đối chiếu được 1:1 với TS.
--  p_planned_month  = tháng của BẢN MỐC (A5 nói "end of baseline planned_month");
--                     kế hoạch chưa từng duyệt thì truyền tháng hiện tại.
--  p_steps          = [{sort_order, planned_date, done_on}, …]
--  p_outcome        = {outcome, payment_status} hoặc NULL (chưa liên kết / chưa có kết quả)
--  p_as_of          = hôm nay theo giờ Asia/Ho_Chi_Minh
-- Biên BAO GỒM: đúng ngày cuối tháng kế hoạch CHƯA trễ; mốc đến hạn đúng hôm nay
-- CHƯA quá hạn.
CREATE OR REPLACE FUNCTION public.auction_plan_item_health(
  p_exec_status    TEXT,
  p_planned_month  DATE,
  p_forecast_month DATE,
  p_steps          JSONB,
  p_outcome        JSONB,
  p_as_of          DATE
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH o AS (
    SELECT NULLIF(p_outcome->>'outcome', '')        AS outcome,
           NULLIF(p_outcome->>'payment_status', '') AS pay
  ),
  s AS (
    SELECT (e->>'sort_order')::INT                AS sort_order,
           NULLIF(e->>'planned_date', '')::DATE   AS planned_date,
           NULLIF(e->>'done_on', '')::DATE        AS done_on
      FROM jsonb_array_elements(COALESCE(p_steps, '[]'::jsonb)) e
  )
  SELECT CASE
    -- ① done — bán được và người trúng không bỏ cọc
    WHEN (SELECT o.outcome = 'sold' AND COALESCE(o.pay, '') <> 'defaulted' FROM o)
      THEN 'done'
    -- ② dropped
    WHEN p_exec_status = 'dropped'
      THEN 'dropped'
    -- ③ failed_retry — không thành, hoặc bán được nhưng BỎ CỌC (phải đấu lại)
    WHEN (SELECT (o.outcome = 'sold' AND o.pay = 'defaulted')
                 OR o.outcome IN ('unsold', 'postponed', 'cancelled', 'withdrawn') FROM o)
      THEN 'failed_retry'
    -- ④ late — đã qua ngày cuối tháng của bản mốc mà chưa đấu thành
    WHEN p_planned_month IS NOT NULL
         AND p_as_of > (date_trunc('month', p_planned_month) + INTERVAL '1 month - 1 day')::DATE
      THEN 'late'
    -- ⑤ at_risk — mốc có ngày dự kiến đã qua mà chưa xong
    WHEN EXISTS (SELECT 1 FROM s
                  WHERE s.planned_date IS NOT NULL AND s.done_on IS NULL AND s.planned_date < p_as_of)
      THEN 'at_risk'
    -- ⑥ at_risk — đã dời dự kiến sang tháng muộn hơn tháng của bản mốc
    WHEN p_forecast_month IS NOT NULL AND p_planned_month IS NOT NULL
         AND p_forecast_month > p_planned_month
      THEN 'at_risk'
    -- ⑦ at_risk — còn ≤ 30 ngày tới tháng kế hoạch (hoặc đã vào tháng đó) mà mốc
    --    ĐẦU TIÊN của bản mẫu chưa xong (tài sản công không có legal_ready nên
    --    "mốc đầu tiên" là sort_order nhỏ nhất, không cứ là 1)
    WHEN p_planned_month IS NOT NULL
         AND (p_as_of + 30) >= p_planned_month
         AND EXISTS (SELECT 1 FROM s
                      WHERE s.done_on IS NULL
                        AND s.sort_order = (SELECT min(s2.sort_order) FROM s s2))
      THEN 'at_risk'
    ELSE 'on_track'
  END
$$;

COMMENT ON FUNCTION public.auction_plan_item_health(TEXT, DATE, DATE, JSONB, JSONB, DATE) IS
  'Sức khoẻ một tài sản trong kế hoạch (A5). BẢN SAO SQL của planItemHealth() trong src/lib/auctionPlan/health.ts — sửa một bên phải sửa bên kia.';

REVOKE ALL ON FUNCTION public.auction_plan_item_health(TEXT, DATE, DATE, JSONB, JSONB, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_item_health(TEXT, DATE, DATE, JSONB, JSONB, DATE) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. Kết quả thực tế của từng tài sản trong kế hoạch
-- ───────────────────────────────────────────────────────────────────────────────

-- A5: "kết quả thực tế của một tài sản = dòng owner_outcomes_overview khớp theo
-- asset_posting_id HOẶC listing_id".
--
-- ⚠️ Thực tế của mã nguồn (kiểm 2026-10-26): `owner_outcomes_overview` khoá theo
-- `listing_id` hoặc `title_key` và nhánh ngoài sàn của nó đòi
-- `asset_posting_id IS NULL`, nên kết quả gắn với HỒ SƠ SỐ HOÁ không xuất hiện ở
-- đó. Vì vậy:
--   • tin đăng  (listing_id) → đi qua `owner_outcomes_overview_core` (bộ hợp nhất
--     của sàn — KHÔNG viết lại luật "đã bán", xem common-pitfalls);
--   • hồ sơ số hoá (asset_posting_id) → đọc lượt MỚI NHẤT của
--     `owner_asset_outcomes` cho hồ sơ đó.
-- Tài sản gắn cả hai thì tin đăng thắng (dữ liệu sàn xác nhận).
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
  round_no       INT
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
  WITH it AS (
    SELECT i.id, i.asset_posting_id, i.listing_id
      FROM public.auction_plan_items i
     WHERE i.plan_id = p_plan_id
  ),
  lst AS (
    SELECT it.id                   AS item_id,
           'listing'::TEXT         AS link,
           r.resolved_outcome      AS outcome,
           r.payment_status        AS payment_status,
           r.resolved_date         AS auction_date,
           r.starting_price        AS starting_price,
           r.resolved_price        AS winning_price,
           r.paid_amount           AS paid_amount,
           NULL::DATE              AS paid_at,
           NULL::INT               AS round_no
      FROM it
      JOIN public.owner_outcomes_overview_core(v_plan.workspace_id) r ON r.listing_id = it.listing_id
     WHERE it.listing_id IS NOT NULL
  ),
  pst AS (
    SELECT DISTINCT ON (it.id)
           it.id                   AS item_id,
           'posting'::TEXT         AS link,
           o.outcome               AS outcome,
           o.payment_status        AS payment_status,
           o.auction_date          AS auction_date,
           o.starting_price        AS starting_price,
           CASE WHEN o.outcome = 'sold' THEN o.winning_price END AS winning_price,
           o.paid_amount           AS paid_amount,
           o.paid_at               AS paid_at,
           o.round_no              AS round_no
      FROM it
      JOIN public.owner_asset_outcomes o ON o.asset_posting_id = it.asset_posting_id
     WHERE it.asset_posting_id IS NOT NULL
       AND o.workspace_id = v_plan.workspace_id
     ORDER BY it.id, o.round_no DESC, o.auction_date DESC NULLS LAST, o.updated_at DESC
  )
  SELECT * FROM lst
  UNION ALL
  SELECT p.* FROM pst p WHERE NOT EXISTS (SELECT 1 FROM lst l WHERE l.item_id = p.item_id);
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_item_outcomes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_item_outcomes(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. Sức khoẻ của cả danh mục — bộ gom dữ liệu (P6 / P7 / P8 dùng lại)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auction_plan_item_health_rows(p_plan_id UUID, p_as_of DATE DEFAULT NULL)
RETURNS TABLE (
  item_id        UUID,
  item_code      TEXT,
  health         TEXT,
  baseline_month DATE,
  planned_month  DATE,
  forecast_month DATE,
  exec_status    TEXT,
  steps_done     INT,
  steps_total    INT,
  outcome        TEXT,
  payment_status TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan    public.auction_plans%ROWTYPE;
  v_payload JSONB;
  v_as_of   DATE := COALESCE(p_as_of, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE);
BEGIN
  SELECT * INTO v_plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.auction_plan_read_ok(v_plan.workspace_id, v_plan.branch_id, p_plan_id) THEN
    RETURN;
  END IF;

  -- Bản mốc MỚI NHẤT; không có (chưa từng duyệt) ⇒ dùng tháng hiện tại của tài sản.
  SELECT b.payload INTO v_payload
    FROM public.auction_plan_baselines b
   WHERE b.plan_id = p_plan_id
   ORDER BY b.version DESC
   LIMIT 1;

  RETURN QUERY
  WITH oc AS (
    SELECT * FROM public.auction_plan_item_outcomes(p_plan_id)
  ),
  st AS (
    SELECT s.item_id,
           count(*)::INT                                        AS total,
           count(s.done_on)::INT                                AS done,
           jsonb_agg(jsonb_build_object(
             'sort_order',   s.sort_order,
             'planned_date', s.planned_date,
             'done_on',      s.done_on
           ) ORDER BY s.sort_order)                              AS payload
      FROM public.auction_plan_item_steps s
     WHERE s.plan_id = p_plan_id
     GROUP BY s.item_id
  )
  SELECT i.id,
         i.item_code,
         public.auction_plan_item_health(
           i.exec_status,
           CASE WHEN bl.found THEN bl.bm ELSE i.planned_month END,
           i.forecast_month,
           COALESCE(st.payload, '[]'::jsonb),
           CASE WHEN o.item_id IS NULL THEN NULL
                ELSE jsonb_build_object('outcome', o.outcome, 'payment_status', o.payment_status) END,
           v_as_of
         ),
         CASE WHEN bl.found THEN bl.bm ELSE i.planned_month END,
         i.planned_month,
         i.forecast_month,
         i.exec_status,
         COALESCE(st.done, 0),
         COALESCE(st.total, 0),
         o.outcome,
         o.payment_status
    FROM public.auction_plan_items i
    LEFT JOIN st ON st.item_id = i.id
    LEFT JOIN oc o ON o.item_id = i.id
    LEFT JOIN LATERAL (
      SELECT NULLIF(e->>'planned_month', '')::DATE AS bm, TRUE AS found
        FROM jsonb_array_elements(COALESCE(v_payload->'items', '[]'::jsonb)) e
       WHERE e->>'id' = i.id::TEXT
       LIMIT 1
    ) bl ON TRUE
   WHERE i.plan_id = p_plan_id
   ORDER BY i.seq;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_item_health_rows(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_item_health_rows(UUID, DATE) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. Mốc do sàn suy ra (A4.4, mốc 4 · 5 · 6 · 7 · 9)
-- ───────────────────────────────────────────────────────────────────────────────

-- Chỉ ĐỌC. Trả về ngày sàn tự thấy cho từng (tài sản, mốc) — chưa ghi gì.
--   org_selected    ← yêu cầu dịch vụ của hồ sơ đã ở trạng thái 'selected'
--   contract_signed ← hợp đồng ký gửi (dịch vụ đấu giá) của hồ sơ đã 'signed'
--   announced       ← lô nằm trong phiên đã CÔNG BỐ (bảng của sàn — chỉ đọc)
--   auction_held    ← đã có kết quả phiên (lượt mới nhất)
--   paid            ← kết quả phiên ghi đã thu đủ (payment_status = 'paid')
CREATE OR REPLACE FUNCTION public.auction_plan_platform_steps(p_plan_id UUID)
RETURNS TABLE (
  item_id       UUID,
  step          TEXT,
  platform_date DATE,
  detail        TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  public.auction_plans%ROWTYPE;
  v_today DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;
BEGIN
  SELECT * INTO v_plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.auction_plan_read_ok(v_plan.workspace_id, v_plan.branch_id, p_plan_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH it AS (
    SELECT i.id, i.asset_posting_id, i.listing_id
      FROM public.auction_plan_items i
     WHERE i.plan_id = p_plan_id
       AND (i.asset_posting_id IS NOT NULL OR i.listing_id IS NOT NULL)
  ),
  oc AS (
    SELECT * FROM public.auction_plan_item_outcomes(p_plan_id)
  ),
  -- mốc 4: tổ chức đấu giá đã được chốt trên hồ sơ số hoá
  s_org AS (
    SELECT it.id AS item_id,
           'org_selected'::TEXT AS step,
           min((r.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE) AS platform_date,
           'Hồ sơ số hoá đã chốt tổ chức đấu giá'::TEXT AS detail
      FROM it
      JOIN public.asset_service_requests r ON r.asset_posting_id = it.asset_posting_id
     WHERE it.asset_posting_id IS NOT NULL
       AND r.status = 'selected'
     GROUP BY it.id
  ),
  -- mốc 5: hợp đồng dịch vụ đấu giá đã ký
  s_contract AS (
    SELECT it.id AS item_id,
           'contract_signed'::TEXT AS step,
           min(COALESCE(c.signed_date, (c.signed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE)) AS platform_date,
           'Hợp đồng dịch vụ đấu giá đã ký'::TEXT AS detail
      FROM it
      JOIN public.consignment_contracts c ON c.asset_posting_id = it.asset_posting_id
     WHERE it.asset_posting_id IS NOT NULL
       AND c.status = 'signed'
     GROUP BY it.id
  ),
  -- mốc 6: lô đã nằm trong một phiên ĐÃ CÔNG BỐ (bảng của sàn, chỉ đọc)
  s_announced AS (
    SELECT it.id AS item_id,
           'announced'::TEXT AS step,
           min((s.published_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE) AS platform_date,
           'Lô đã nằm trong phiên đã công bố'::TEXT AS detail
      FROM it
      JOIN public.auction_session_items si
        ON (si.listing_id IS NOT NULL AND si.listing_id = it.listing_id)
        OR (si.asset_posting_id IS NOT NULL AND si.asset_posting_id = it.asset_posting_id)
      JOIN public.auction_sessions s ON s.id = si.session_id
     WHERE s.status = 'published'
       AND s.published_at IS NOT NULL
     GROUP BY it.id
  ),
  -- mốc 7: đã có kết quả phiên
  s_held AS (
    SELECT o.item_id,
           'auction_held'::TEXT AS step,
           o.auction_date AS platform_date,
           'Đã có kết quả phiên'::TEXT AS detail
      FROM oc o
     WHERE o.outcome IS NOT NULL AND o.auction_date IS NOT NULL
  ),
  -- mốc 9: người trúng đã nộp đủ tiền
  s_paid AS (
    SELECT o.item_id,
           'paid'::TEXT AS step,
           COALESCE(o.paid_at, o.auction_date) AS platform_date,
           'Kết quả phiên ghi đã thu đủ tiền'::TEXT AS detail
      FROM oc o
     WHERE o.outcome = 'sold' AND o.payment_status = 'paid'
  ),
  all_steps AS (
    SELECT * FROM s_org
    UNION ALL SELECT * FROM s_contract
    UNION ALL SELECT * FROM s_announced
    UNION ALL SELECT * FROM s_held
    UNION ALL SELECT * FROM s_paid
  )
  -- Guard của bảng mốc từ chối `done_on` ở TƯƠNG LAI ⇒ lọc trước khi trả về.
  SELECT a.item_id, a.step, a.platform_date, a.detail
    FROM all_steps a
   WHERE a.platform_date IS NOT NULL
     AND a.platform_date <= v_today;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_platform_steps(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_platform_steps(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6. GHI các mốc do sàn suy ra
-- ───────────────────────────────────────────────────────────────────────────────

-- `source` không nằm trong GRANT của client ⇒ chỉ hàm DEFINER này đặt được
-- 'platform'. Cần `ke-hoach:update` đúng chi nhánh (giống mọi ghi mốc khác).
--
-- Luật A4.4: "một lần tự khai KHÔNG ghi đè ngày của sàn — ngày của sàn thắng và
-- ngày tự khai được giữ trong note". Ở đây là CHIỀU NGƯỢC (sàn đến SAU khi đơn
-- vị đã tự khai): giữ ngày tự khai lại trong `note` rồi thay `done_on` bằng ngày
-- của sàn. Chiều còn lại (tự khai đến sau ngày của sàn) do trigger ở mục 7 chặn.
CREATE OR REPLACE FUNCTION public.auction_plan_sync_platform_steps(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan    public.auction_plans%ROWTYPE;
  v_updated INT := 0;
  v_kept    INT := 0;
  r         RECORD;
  v_note    TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_plan FROM public.auction_plans WHERE id = p_plan_id;
  IF NOT FOUND OR NOT public.auction_plan_read_ok(v_plan.workspace_id, v_plan.branch_id, p_plan_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has_in(v_plan.workspace_id, 'ke-hoach', 'update', v_plan.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Cờ riêng (KHÔNG dùng `auction_plan.rpc`) để trigger "sàn thắng" tự tránh, mà
  -- nhật ký hoạt động vẫn ghi được việc đồng bộ này.
  PERFORM set_config('auction_plan.platform_sync', 'on', true);

  FOR r IN
    SELECT p.item_id, p.step, p.platform_date, p.detail,
           s.id AS step_id, s.done_on, s.source, s.note
      FROM public.auction_plan_platform_steps(p_plan_id) p
      JOIN public.auction_plan_item_steps s ON s.item_id = p.item_id AND s.step = p.step
  LOOP
    IF r.done_on = r.platform_date AND r.source = 'platform' THEN
      CONTINUE;  -- đã đồng bộ
    END IF;

    v_note := r.note;
    IF r.done_on IS NOT NULL AND r.source <> 'platform' AND r.done_on <> r.platform_date THEN
      v_note := btrim(COALESCE(v_note || E'\n', '') ||
                      'Đơn vị tự khai hoàn thành ' || to_char(r.done_on, 'DD/MM/YYYY') ||
                      ' · sàn xác nhận ' || to_char(r.platform_date, 'DD/MM/YYYY') || '.');
      v_kept := v_kept + 1;
    END IF;

    UPDATE public.auction_plan_item_steps
       SET done_on = r.platform_date,
           source  = 'platform',
           note    = v_note
     WHERE id = r.step_id;
    v_updated := v_updated + 1;
  END LOOP;

  PERFORM set_config('auction_plan.platform_sync', 'off', true);

  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'kept_manual', v_kept);
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_sync_platform_steps(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_sync_platform_steps(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7. Trigger: ngày của SÀN thắng một lần tự khai (A4.4)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auction_plan_steps_platform_wins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Chính hàm đồng bộ đang ghi ⇒ để nó ghi.
  IF COALESCE(current_setting('auction_plan.platform_sync', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF OLD.source = 'platform' AND OLD.done_on IS NOT NULL
     AND NEW.done_on IS DISTINCT FROM OLD.done_on THEN
    IF NEW.done_on IS NOT NULL THEN
      NEW.note := btrim(COALESCE(NEW.note || E'\n', '') ||
                        'Đơn vị tự khai hoàn thành ' || to_char(NEW.done_on, 'DD/MM/YYYY') ||
                        ' · giữ ngày sàn xác nhận ' || to_char(OLD.done_on, 'DD/MM/YYYY') || '.');
    END IF;
    NEW.done_on := OLD.done_on;
    NEW.source  := 'platform';
  END IF;

  RETURN NEW;
END;
$$;

-- Chạy SAU `auction_plan_item_steps_guard` (thứ tự theo tên: _guard < _platform_wins)
-- nên `done_on` tương lai đã bị guard chặn trước khi tới đây.
DROP TRIGGER IF EXISTS auction_plan_item_steps_platform_wins ON public.auction_plan_item_steps;
CREATE TRIGGER auction_plan_item_steps_platform_wins
  BEFORE UPDATE ON public.auction_plan_item_steps
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_steps_platform_wins();

-- ───────────────────────────────────────────────────────────────────────────────
-- 8. Chỉ số đọc mốc theo kế hoạch (lưới 12 tháng đọc cả danh mục một lần)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS auction_plan_item_steps_plan_due_idx
  ON public.auction_plan_item_steps (plan_id, planned_date)
  WHERE done_on IS NULL;

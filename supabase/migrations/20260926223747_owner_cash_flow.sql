-- Phase 15a của docs/owner-control-tower-plan.md — "Dòng tiền" của Trạm / Tháp Điều Hành.
--
-- Tiền của một kết quả phiên (owner_asset_outcomes) không còn là 4 cột tự ghi mà là
-- các KHOẢN THU CHI có ngày (owner_cash_events): tiền đặt trước / tiền thanh toán /
-- phí & chi phí / hoàn trả. Các cột cũ paid_amount / paid_at / auction_fee /
-- payment_status được GIỮ nhưng thành TỔNG TÍNH SẴN do trigger dựng lại từ sổ ⇒ mọi
-- chỗ đọc cũ (owner_asset_outcomes_resolved, owner_outcomes_overview, Chỉ tiêu,
-- báo cáo định kỳ, /r/:token, Nhịp đập) chạy y nguyên.
--
-- Quyết định (người dùng, 2026-09-26): khoản thu chi SỬA được và xoá được (không có
-- bút toán đảo); dự báo gồm tiền còn phải thu + ước tính từ phiên sắp tới.
--
-- Nội dung:
--   1. Bảng owner_cash_events + trigger guard / sync + RLS qua owner_cash_event_ok().
--   2. Cột owner_asset_outcomes.payment_due_on (hạn thanh toán của người trúng).
--   3. Trigger owner_asset_outcomes_money: nơi DUY NHẤT tính các cột tiền.
--   4. RPC owner_cash_settle ("Đã thu đủ" — số còn lại tính ở server).
--   5. RPC owner_cash_flow (trang /chu-tai-san/dong-tien; trụ sở gộp các Trạm con).
--   6. Sửa 1 dòng thân owner_outcomes_overview_core: paid_amount chỉ khi nguồn thắng
--      là bản tự khai (chữ ký giữ nguyên).
--   7. Chuyển dữ liệu cũ + tự kiểm.

LOCK TABLE public.owner_asset_outcomes IN SHARE ROW EXCLUSIVE MODE;

-- Ảnh chụp trước khi chuyển, để tự kiểm lệch ở cuối file.
CREATE TEMP TABLE _p15_before ON COMMIT DROP AS
  SELECT id, outcome, payment_status, paid_amount, winning_price
    FROM public.owner_asset_outcomes;

-- ─── 1. Bảng khoản thu chi ───────────────────────────────────────────────────

CREATE TABLE public.owner_cash_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Suy từ kết quả phiên (trigger guard), client không gửi.
  workspace_id UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  outcome_id   UUID NOT NULL REFERENCES public.owner_asset_outcomes(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('deposit', 'payment', 'fee', 'refund')),
  amount       NUMERIC(18,0) NOT NULL CHECK (amount > 0),
  occurred_on  DATE NOT NULL,
  note         TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  -- Xoá tài khoản KHÔNG được xoá sổ tiền ⇒ SET NULL.
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.owner_cash_events IS
  'Phase 15a: khoản thu chi của một kết quả phiên. deposit/payment = tiền về, refund = trả lại (giảm số đã thu), fee = phí & chi phí (tiền ra, không đụng số đã thu). Chi nhánh luôn lấy từ kết quả phiên.';

CREATE INDEX owner_cash_events_outcome_idx ON public.owner_cash_events (outcome_id);
CREATE INDEX owner_cash_events_ws_date_idx ON public.owner_cash_events (workspace_id, occurred_on DESC);

CREATE OR REPLACE FUNCTION public.owner_cash_events_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws      UUID;
  v_outcome TEXT;
  v_by      UUID;
  v_today   DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.outcome_id IS DISTINCT FROM OLD.outcome_id THEN
      RAISE EXCEPTION 'Không thể chuyển khoản thu chi sang kết quả phiên khác';
    END IF;
    -- Chỉ đổi người tạo / người sửa (FK SET NULL khi xoá tài khoản): để nguyên.
    IF (NEW.kind, NEW.amount, NEW.occurred_on, NEW.note, NEW.workspace_id)
       IS NOT DISTINCT FROM (OLD.kind, OLD.amount, OLD.occurred_on, OLD.note, OLD.workspace_id) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT o.workspace_id, o.outcome, o.reported_by
    INTO v_ws, v_outcome, v_by
    FROM public.owner_asset_outcomes o
   WHERE o.id = NEW.outcome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy kết quả phiên của khoản này';
  END IF;

  NEW.workspace_id := v_ws;
  NEW.note := NULLIF(btrim(NEW.note), '');

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), v_by);
    NEW.created_at := now();
    NEW.updated_by := NULL;
    NEW.updated_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.occurred_on IS DISTINCT FROM OLD.occurred_on)
     AND NEW.occurred_on > v_today THEN
    RAISE EXCEPTION 'Ngày ghi nhận không được sau hôm nay';
  END IF;

  -- Tiền thanh toán chỉ có ở phiên thành. Tiền đặt trước (bị giữ khi bỏ cọc),
  -- hoàn trả và phí thì phiên nào cũng có thể có. Kết quả đổi SAU khi ghi: không chặn.
  IF NEW.kind = 'payment'
     AND (TG_OP = 'INSERT' OR OLD.kind IS DISTINCT FROM 'payment')
     AND v_outcome <> 'sold' THEN
    RAISE EXCEPTION 'Tiền thanh toán chỉ ghi cho phiên đấu thành';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_cash_events_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_cash_events_guard
  BEFORE INSERT OR UPDATE ON public.owner_cash_events
  FOR EACH ROW EXECUTE FUNCTION public.owner_cash_events_guard();

-- Quyền trên một khoản = quyền trên kết quả phiên cha (chi nhánh luôn lấy từ cha,
-- không lưu bản sao ⇒ không bao giờ lệch khi cha đổi chi nhánh).
CREATE OR REPLACE FUNCTION public.owner_cash_event_ok(p_outcome_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE p_action
             WHEN 'read'  THEN public.owner_ws_can(o.workspace_id, 'read')
             WHEN 'write' THEN public.owner_ws_can(o.workspace_id, 'write')
                               AND public.owner_ws_branch_ok(o.workspace_id, o.branch_id)
             ELSE false
           END
      FROM public.owner_asset_outcomes o
     WHERE o.id = p_outcome_id
  ), false)
$$;

REVOKE ALL ON FUNCTION public.owner_cash_event_ok(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_cash_event_ok(UUID, TEXT) TO authenticated;

ALTER TABLE public.owner_cash_events ENABLE ROW LEVEL SECURITY;

-- Đọc: như kết quả phiên — kể cả Trưởng đơn vị trụ sở đã liên kết (Phase 14).
CREATE POLICY owner_cash_events_read ON public.owner_cash_events
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY owner_cash_events_insert ON public.owner_cash_events
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_cash_event_ok(outcome_id, 'write'));

CREATE POLICY owner_cash_events_update ON public.owner_cash_events
  FOR UPDATE TO authenticated
  USING (public.owner_cash_event_ok(outcome_id, 'write'))
  WITH CHECK (public.owner_cash_event_ok(outcome_id, 'write'));

CREATE POLICY owner_cash_events_delete ON public.owner_cash_events
  FOR DELETE TO authenticated
  USING (public.owner_cash_event_ok(outcome_id, 'write'));

-- Client chỉ ghi được đúng các cột nghiệp vụ; workspace_id / người tạo / thời điểm do server.
REVOKE ALL ON public.owner_cash_events FROM anon, authenticated;
GRANT SELECT, DELETE ON public.owner_cash_events TO authenticated;
GRANT INSERT (outcome_id, kind, amount, occurred_on, note) ON public.owner_cash_events TO authenticated;
GRANT UPDATE (kind, amount, occurred_on, note) ON public.owner_cash_events TO authenticated;

-- ─── 2. Hạn thanh toán ───────────────────────────────────────────────────────

ALTER TABLE public.owner_asset_outcomes ADD COLUMN payment_due_on DATE;

COMMENT ON COLUMN public.owner_asset_outcomes.payment_due_on IS
  'Phase 15a: hạn người trúng nộp đủ tiền. NULL ⇒ dự báo dùng ngày phiên + 30 ngày (như payment_due_at của phiên trên sàn).';
COMMENT ON COLUMN public.owner_asset_outcomes.paid_amount IS
  'TÍNH SẴN (Phase 15a): Σ tiền đặt trước + thanh toán − hoàn trả trong owner_cash_events, không âm; NULL khi chưa có khoản nào. Không ghi trực tiếp.';
COMMENT ON COLUMN public.owner_asset_outcomes.paid_at IS
  'TÍNH SẴN (Phase 15a): ngày của khoản tiền về gần nhất. Không ghi trực tiếp.';
COMMENT ON COLUMN public.owner_asset_outcomes.auction_fee IS
  'TÍNH SẴN (Phase 15a): Σ phí & chi phí trong owner_cash_events. Không ghi trực tiếp.';
COMMENT ON COLUMN public.owner_asset_outcomes.payment_status IS
  'TÍNH SẴN (Phase 15a) từ số đã thu so với giá trúng; riêng "defaulted" (người trúng bỏ cọc) là cờ tay, giữ tới khi client ghi giá trị khác.';

-- ─── 7a. Chuyển dữ liệu cũ thành khoản thu chi (trước khi bật trigger tính tổng) ─
-- (0 dòng trên production lúc viết; vẫn làm đúng cho mọi môi trường.)

INSERT INTO public.owner_cash_events (outcome_id, kind, amount, occurred_on, note)
SELECT o.id,
       CASE WHEN o.outcome = 'sold' THEN 'payment' ELSE 'deposit' END,
       o.paid_amount,
       LEAST(COALESCE(o.paid_at, o.auction_date), (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
       'Chuyển từ số đã thu trước khi có sổ thu chi'
  FROM public.owner_asset_outcomes o
 WHERE o.paid_amount > 0;

-- "Đã thu đủ" cũ không kèm số ⇒ một khoản bằng giá trúng.
INSERT INTO public.owner_cash_events (outcome_id, kind, amount, occurred_on, note)
SELECT o.id, 'payment', o.winning_price,
       LEAST(COALESCE(o.paid_at, o.auction_date), (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
       'Chuyển từ trạng thái "đã thu đủ" trước khi có sổ thu chi'
  FROM public.owner_asset_outcomes o
 WHERE o.outcome = 'sold' AND o.payment_status = 'paid'
   AND (o.paid_amount IS NULL OR o.paid_amount <= 0)
   AND o.winning_price > 0;

INSERT INTO public.owner_cash_events (outcome_id, kind, amount, occurred_on, note)
SELECT o.id, 'fee', o.auction_fee,
       LEAST(COALESCE(o.paid_at, o.auction_date), (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
       'Chuyển từ phí đấu giá trước khi có sổ thu chi'
  FROM public.owner_asset_outcomes o
 WHERE o.auction_fee > 0;

-- ─── 3. Tổng tính sẵn trên kết quả phiên ──────────────────────────────────────

-- Tên "…_money" ⇒ chạy SAU các trigger _guard* (thứ tự chữ cái) và TRƯỚC _updated_at.
CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_money()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_in     NUMERIC;
  v_refund NUMERIC;
  v_fee    NUMERIC;
  v_n      INT;
  v_last   DATE;
  v_net    NUMERIC;
BEGIN
  -- Câu lệnh trực tiếp của client (độ sâu 1) không được tự ghi số tiền: số đó dựng
  -- từ sổ. Lời nhắc rõ ràng thay vì lặng lẽ bỏ qua (tab cũ chưa tải lại trang).
  IF pg_trigger_depth() = 1 THEN
    IF TG_OP = 'INSERT' AND (NEW.paid_amount IS NOT NULL OR NEW.paid_at IS NOT NULL OR NEW.auction_fee IS NOT NULL) THEN
      RAISE EXCEPTION 'Số đã thu được tính từ sổ thu chi. Hãy tải lại trang rồi ghi khoản thu.';
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.paid_amount, NEW.paid_at, NEW.auction_fee)
           IS DISTINCT FROM (OLD.paid_amount, OLD.paid_at, OLD.auction_fee) THEN
      RAISE EXCEPTION 'Số đã thu được tính từ sổ thu chi. Hãy tải lại trang rồi ghi khoản thu.';
    END IF;
  END IF;

  -- Không dùng CHECK: lỗi 23514 của bảng này đang được client hiểu là "thiếu giá trúng".
  IF NEW.payment_due_on IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.payment_due_on IS DISTINCT FROM OLD.payment_due_on)
     AND NEW.payment_due_on < NEW.auction_date THEN
    RAISE EXCEPTION 'Hạn thanh toán không được trước ngày phiên';
  END IF;

  SELECT COALESCE(sum(e.amount) FILTER (WHERE e.kind IN ('deposit', 'payment')), 0),
         COALESCE(sum(e.amount) FILTER (WHERE e.kind = 'refund'), 0),
         sum(e.amount) FILTER (WHERE e.kind = 'fee'),
         count(*) FILTER (WHERE e.kind <> 'fee'),
         max(e.occurred_on) FILTER (WHERE e.kind IN ('deposit', 'payment'))
    INTO v_in, v_refund, v_fee, v_n, v_last
    FROM public.owner_cash_events e
   WHERE e.outcome_id = NEW.id;

  v_net := greatest(v_in - v_refund, 0);

  NEW.paid_amount := CASE WHEN v_n > 0 THEN v_net END;
  NEW.paid_at     := v_last;
  NEW.auction_fee := v_fee;
  NEW.payment_status := CASE
    WHEN NEW.outcome <> 'sold'                         THEN 'pending'
    WHEN NEW.payment_status = 'defaulted'              THEN 'defaulted'
    WHEN v_net > 0 AND v_net >= NEW.winning_price      THEN 'paid'
    WHEN v_net > 0                                     THEN 'partial'
    ELSE 'pending'
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_asset_outcomes_money() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_asset_outcomes_money
  BEFORE INSERT OR UPDATE ON public.owner_asset_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.owner_asset_outcomes_money();

-- Mỗi khoản đổi ⇒ "chạm" kết quả phiên cha để trigger trên dựng lại tổng.
-- DEFINER để chủ bảng bỏ qua RLS: policy UPDATE của cha không được lặng lẽ bỏ sót dòng.
CREATE OR REPLACE FUNCTION public.owner_cash_events_sync()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.owner_asset_outcomes o
     SET updated_at = o.updated_at
   WHERE o.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.outcome_id ELSE NEW.outcome_id END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_cash_events_sync() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_cash_events_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.owner_cash_events
  FOR EACH ROW EXECUTE FUNCTION public.owner_cash_events_sync();

-- ─── 7b. Dựng lại tổng cho các dòng có dính tiền + tự kiểm lệch ─────────────────

UPDATE public.owner_asset_outcomes o
   SET updated_at = o.updated_at
 WHERE o.paid_amount IS NOT NULL OR o.paid_at IS NOT NULL OR o.auction_fee IS NOT NULL
    OR o.payment_status <> 'pending'
    OR EXISTS (SELECT 1 FROM public.owner_cash_events e WHERE e.outcome_id = o.id);

DO $$
DECLARE
  v_bad INT;
BEGIN
  SELECT count(*) INTO v_bad
    FROM _p15_before b
    JOIN public.owner_asset_outcomes o ON o.id = b.id
   WHERE b.outcome = 'sold'
     AND (o.payment_status IS DISTINCT FROM b.payment_status
          OR (b.paid_amount > 0 AND o.paid_amount IS DISTINCT FROM b.paid_amount)
          OR (b.payment_status = 'paid' AND (b.paid_amount IS NULL OR b.paid_amount <= 0)
              AND o.paid_amount IS DISTINCT FROM b.winning_price));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'P15a: % kết quả phiên đổi trạng thái thu tiền khi chuyển sang sổ thu chi', v_bad;
  END IF;
END;
$$;

-- ─── 4. "Đã thu đủ" — số còn lại tính ở server ────────────────────────────────
-- INVOKER: SELECT … FOR UPDATE áp policy UPDATE của owner_asset_outcomes (cổng quyền
-- ghi + phạm vi chi nhánh), rồi INSERT đi qua RLS + guard của sổ như ghi tay.

CREATE OR REPLACE FUNCTION public.owner_cash_settle(p_outcome_id UUID, p_occurred_on DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_outcome TEXT;
  v_price   NUMERIC;
  v_status  TEXT;
  v_paid    NUMERIC;
  v_left    NUMERIC;
  v_id      UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT o.outcome, o.winning_price, o.payment_status, o.paid_amount
    INTO v_outcome, v_price, v_status, v_paid
    FROM public.owner_asset_outcomes o
   WHERE o.id = p_outcome_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_outcome <> 'sold' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_sold');
  END IF;
  IF v_status = 'defaulted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'defaulted');
  END IF;

  v_left := COALESCE(v_price, 0) - COALESCE(v_paid, 0);
  IF v_left <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  INSERT INTO public.owner_cash_events (outcome_id, kind, amount, occurred_on)
  VALUES (p_outcome_id, 'payment', v_left,
          COALESCE(p_occurred_on, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'amount', v_left);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_cash_settle(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_cash_settle(UUID, DATE) TO authenticated;

-- ─── 5. Trang "Dòng tiền" ────────────────────────────────────────────────────
-- Một lần đọc cho cả trang. p_include_linked: trụ sở gộp thêm các Trạm con mà người
-- gọi ĐỌC được (owner_ws_can — tức Trưởng đơn vị trụ sở, Phase 14).
-- Không bao giờ trả: danh tính người trúng, đường dẫn biên bản, id người dùng; tên
-- người ghi sổ chỉ khi người gọi là thành viên TRỰC TIẾP của đơn vị đó (trụ sở không
-- được thấy nhân sự chi nhánh — quyết định P14).

CREATE OR REPLACE FUNCTION public.owner_cash_flow(p_workspace_id UUID, p_include_linked BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_as_of  DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_units  UUID[];
  v_result JSONB;
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(w.id) INTO v_units
    FROM public.asset_owner_workspaces w
   WHERE w.id = p_workspace_id
      OR (p_include_linked
          AND w.parent_workspace_id = p_workspace_id
          AND public.owner_ws_can(w.id, 'read'));

  WITH
  units AS MATERIALIZED (
    SELECT w.id,
           w.primary_name AS name,
           (w.id = p_workspace_id) AS is_self,
           (public.owner_ws_role(w.id) IS NOT NULL) AS can_see_people
      FROM public.asset_owner_workspaces w
     WHERE w.id = ANY (v_units)
  ),
  br AS MATERIALIZED (
    SELECT wb.id,
           COALESCE(NULLIF(btrim(wb.display_name), ''), ao.name, 'Chi nhánh chưa đặt tên') AS name
      FROM public.workspace_branches wb
      LEFT JOIN public.asset_owners ao ON ao.id = wb.asset_owner_id
     WHERE wb.workspace_id = ANY (v_units)
  ),
  -- Cùng các dòng với "Kết quả phiên" / Chỉ tiêu / báo cáo định kỳ.
  ov AS MATERIALIZED (
    SELECT u.id AS unit_id, o.*
      FROM units u
      CROSS JOIN LATERAL public.owner_outcomes_overview_core(u.id) o
  ),
  row_list AS (
    SELECT jsonb_agg(jsonb_build_object(
             'unit_id',          ov.unit_id,
             'row_key',          ov.row_key,
             'listing_id',       ov.listing_id,
             'own_outcome_id',   ov.own_outcome_id,
             'best_kind',        ov.best_kind,
             'asset_title',      ov.asset_title,
             'asset_code',       CASE WHEN ov.listing_id IS NOT NULL THEN upper(left(ov.listing_id::text, 8)) END,
             'branch_id',        ov.branch_id,
             'branch_name',      br.name,
             'resolved_outcome', ov.resolved_outcome,
             'resolved_date',    ov.resolved_date,
             'starting_price',   CASE WHEN ov.best_kind = 'owner_report'
                                      THEN COALESCE(oo.starting_price, ov.starting_price)
                                      ELSE ov.starting_price END,
             'resolved_price',   ov.resolved_price,
             'payment_status',   ov.payment_status,
             'paid_amount',      ov.paid_amount,
             'payment_due_on',   CASE WHEN ov.best_kind = 'owner_report' THEN oo.payment_due_on END,
             'confidence_label', ov.confidence_label
           ) ORDER BY ov.resolved_date DESC NULLS LAST, ov.row_key) AS list
      FROM ov
      LEFT JOIN public.owner_asset_outcomes oo ON oo.id = ov.own_outcome_id
      LEFT JOIN br ON br.id = ov.branch_id
  ),
  -- Tài sản của khoản lấy từ CHÍNH kết quả phiên của khoản (kể cả lượt cũ: tiền đặt
  -- trước bị giữ ở lượt 1 trước khi đấu lại vẫn phải hiện).
  event_list AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id',              e.id,
             'unit_id',         e.workspace_id,
             'outcome_id',      e.outcome_id,
             'row_key',         CASE WHEN o.listing_id IS NOT NULL THEN 'l:' || o.listing_id::text
                                     WHEN o.asset_posting_id IS NOT NULL THEN 'p:' || o.asset_posting_id::text
                                     ELSE 't:' || o.title_key END,
             'asset_title',     COALESCE(l.title::text, o.asset_title),
             'asset_code',      CASE WHEN o.listing_id IS NOT NULL THEN upper(left(o.listing_id::text, 8)) END,
             'branch_id',       o.branch_id,
             'branch_name',     br.name,
             'round_no',        o.round_no,
             'outcome',         o.outcome,
             'kind',            e.kind,
             'amount',          e.amount,
             'occurred_on',     e.occurred_on,
             'note',            e.note,
             'created_at',      e.created_at,
             'updated_at',      e.updated_at,
             'created_by_name', CASE WHEN u.can_see_people THEN pc.name END,
             'updated_by_name', CASE WHEN u.can_see_people THEN pu.name END
           ) ORDER BY e.occurred_on DESC, e.created_at DESC) AS list
      FROM public.owner_cash_events e
      JOIN units u                        ON u.id = e.workspace_id
      JOIN public.owner_asset_outcomes o  ON o.id = e.outcome_id
      LEFT JOIN public.listings l         ON l.id = o.listing_id
      LEFT JOIN br                        ON br.id = o.branch_id
      LEFT JOIN public.profiles pc        ON pc.id = e.created_by
      LEFT JOIN public.profiles pu        ON pu.id = e.updated_by
  ),
  -- ── Phiên sắp tới — BẢN SAO #2 của luật "plan" trong owner_build_report_payload
  --    (Phase 10, 20260926172328): sửa luật thì sửa cả hai. Cửa sổ [hôm nay, +60 ngày]
  --    để tiền ước tính (ngày phiên + 30) rơi trong 90 ngày của dự báo.
  claimed AS (
    SELECT DISTINCT c.workspace_id AS unit_id, c.listing_id AS lid
      FROM public.asset_owner_claims c
     WHERE c.workspace_id = ANY (v_units)
       AND c.status IN ('auto_claimed', 'pending_confirmation', 'confirmed')
       AND c.listing_id IS NOT NULL
  ),
  branch_of AS (
    SELECT DISTINCT ON (c.workspace_id, c.listing_id)
           c.workspace_id AS unit_id, c.listing_id AS lid, wb.id AS bid
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = ANY (v_units) AND c.listing_id IS NOT NULL
     ORDER BY c.workspace_id, c.listing_id, c.created_at
  ),
  lst AS (
    SELECT cl.unit_id, l.id AS lid, bo.bid, l.title, l.price, l.price_unit, l.auction_org_id,
           (public.try_timestamptz(COALESCE(l.custom_attributes->>'auction_time',
                                            l.custom_attributes->>'auction_date'))
              AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ca_date
      FROM claimed cl
      JOIN public.listings l  ON l.id = cl.lid
      LEFT JOIN branch_of bo  ON bo.unit_id = cl.unit_id AND bo.lid = cl.lid
  ),
  upcoming AS (
    SELECT DISTINCT ON (x.unit_id, x.lid) x.unit_id, x.lid, x.d, x.src, x.org_name
      FROM (
        SELECT lst.unit_id, i.listing_id AS lid,
               (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d,
               'platform'::text AS src,
               ao.name AS org_name
          FROM public.auction_session_items i
          JOIN lst                         ON lst.lid = i.listing_id
          JOIN public.auction_sessions s   ON s.id = i.session_id AND s.status = 'published'
          LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
         WHERE i.source = 'listing'
           AND (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN v_as_of AND v_as_of + 60
        UNION ALL
        SELECT lst.unit_id, lst.lid, lst.ca_date, 'listing'::text, ao.name
          FROM lst
          LEFT JOIN public.auction_organizations ao ON ao.id = lst.auction_org_id
         WHERE lst.ca_date BETWEEN v_as_of AND v_as_of + 60
      ) x
     ORDER BY x.unit_id, x.lid, x.d, x.src DESC
  ),
  upcoming_list AS (
    SELECT jsonb_agg(jsonb_build_object(
             'unit_id',        up.unit_id,
             'row_key',        'l:' || up.lid::text,
             'listing_id',     up.lid,
             'asset_title',    lst.title,
             'asset_code',     upper(left(up.lid::text, 8)),
             'branch_id',      lst.bid,
             'branch_name',    br.name,
             'auction_date',   up.d,
             'source',         up.src,
             'org_name',       up.org_name,
             'starting_price', CASE WHEN lst.price_unit::text = 'TOTAL' AND lst.price > 0 THEN lst.price END
           ) ORDER BY up.d, lst.title) AS list
      FROM upcoming up
      JOIN lst       ON lst.unit_id = up.unit_id AND lst.lid = up.lid
      LEFT JOIN br   ON br.id = lst.bid
      LEFT JOIN ov o ON o.unit_id = up.unit_id AND o.listing_id = up.lid
     WHERE o.resolved_outcome IS DISTINCT FROM 'sold'
       AND o.resolved_outcome IS DISTINCT FROM 'withdrawn'
  )
  SELECT jsonb_build_object(
           'as_of', v_as_of,
           'units', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'id',             u.id,
                      'name',           u.name,
                      'is_self',        u.is_self,
                      'can_see_people', u.can_see_people
                    ) ORDER BY u.is_self DESC, u.name)
               FROM units u), '[]'::jsonb),
           'rows',     COALESCE((SELECT list FROM row_list), '[]'::jsonb),
           'events',   COALESCE((SELECT list FROM event_list), '[]'::jsonb),
           'upcoming', COALESCE((SELECT list FROM upcoming_list), '[]'::jsonb)
         )
    INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_cash_flow(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_cash_flow(UUID, BOOLEAN) TO authenticated;

-- ─── 6. owner_outcomes_overview_core: paid_amount chỉ khi bản tự khai THẮNG ──
-- (dán từ bản đang chạy, đổi đúng 1 dòng — sinh bằng script từ pg_get_functiondef)
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
    ) lbl;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_outcomes_overview_core(UUID) FROM PUBLIC, anon, authenticated;

-- ─── Tự kiểm ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.owner_cash_events'::regclass) THEN
    RAISE EXCEPTION 'P15a: owner_cash_events chưa bật RLS';
  END IF;
  IF has_table_privilege('anon', 'public.owner_cash_events', 'SELECT')
     OR has_table_privilege('authenticated', 'public.owner_cash_events', 'INSERT')
     OR has_column_privilege('authenticated', 'public.owner_cash_events', 'workspace_id', 'INSERT')
     OR has_column_privilege('authenticated', 'public.owner_cash_events', 'created_by', 'UPDATE') THEN
    RAISE EXCEPTION 'P15a: quyền bảng owner_cash_events sai';
  END IF;
  IF has_function_privilege('anon', 'public.owner_cash_flow(uuid, boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_cash_settle(uuid, date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_asset_outcomes_money()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_cash_events_sync()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_cash_events_guard()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.owner_cash_flow(uuid, boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.owner_cash_settle(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P15a: quyền EXECUTE sai';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE NOT tgisinternal
         AND tgname IN ('owner_cash_events_guard', 'owner_cash_events_sync', 'owner_asset_outcomes_money')) <> 3 THEN
    RAISE EXCEPTION 'P15a: thiếu trigger';
  END IF;
  IF pg_get_function_result('public.owner_outcomes_overview(uuid)'::regprocedure) NOT LIKE '%paid_amount numeric%'
     OR position('r.sources->0->>''kind'' = ''owner_report''' IN
                 pg_get_functiondef('public.owner_outcomes_overview_core(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'P15a: owner_outcomes_overview_core chưa được sửa đúng';
  END IF;
END;
$$;

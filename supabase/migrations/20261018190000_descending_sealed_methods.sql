-- Hai phương thức trả giá còn lại của phiên đấu giá trực tuyến:
--
--   • 'descending' — ĐẶT GIÁ XUỐNG. Lô mở ở giá khởi điểm, máy chủ hạ 1 bước giá
--     sau mỗi auction_sessions.price_drop_seconds giây, không thấp hơn giá sàn của
--     lô (auction_session_items.floor_price). Người đủ điều kiện ĐẦU TIÊN bấm
--     "Chấp nhận giá" (accept_descending_price) trúng NGAY ở giá máy chủ tại thời
--     điểm đó — lô đóng luôn. Hết floor + 1 nhịp mà không ai nhận ⇒ không thành.
--     Giá hiện tại KHÔNG lưu từng nhịp: tính từ mốc (price_anchor_at,
--     price_anchor_amount) ⇒ client tự tính cùng công thức (src/lib/bidding/descending.ts).
--     Tạm dừng: giá đứng ở paused_at; tiếp tục: mốc dời đúng bằng khoảng dừng (như ends_at).
--
--   • 'sealed' — BỎ PHIẾU KÍN. Mỗi người MỘT phiếu mỗi vòng, không sửa được
--     (submit_sealed_bid). Tổ chức BẮT BUỘC đặt thời lượng khi mở lô. Phiếu nằm ở
--     auction_sealed_bids (KHÔNG realtime, RLS: người nộp đọc phiếu mình; người
--     khác chỉ đọc vòng đã công bố). Hết giờ (_close_lot):
--       – một người cao nhất ⇒ chép mọi phiếu sang auction_bids (người trúng là
--         seq cuối) rồi đóng như trả giá lên — biên bản/hợp đồng/quyết toán đọc
--         auction_bids + winner_* như cũ;
--       – nhiều người cùng cao nhất ⇒ lô sang 'tied' (tie_amount, tied_bidder_nos);
--         tổ chức mở vòng phụ (org_open_tie_round) chỉ cho những người đó, giá
--         ≥ tie_amount, lặp tới khi còn một người;
--       – vòng phụ không ai nộp ⇒ người nộp SỚM NHẤT trong nhóm bằng giá vòng trước trúng.
--     Vòng phụ mở được cả sau giờ kết thúc phiên (phiên còn 'published'), nếu
--     không lô bằng giá kẹt mãi và không chốt được phiên.
--     Nhật ký (auction_lot_events — tổ chức đọc được) KHÔNG chứa số tiền phiếu kín
--     khi vòng còn mở.
--
-- place_bid / org_open_lot / org_resume_lot / org_withdraw_lot / close_due_lots /
-- hai trigger khoá cấu hình là hàm DÙNG CHUNG đã bị vá live nhiều lần ⇒ vá bằng
-- replace() trên pg_get_functiondef LIVE + assert mốc (như 20261018160000).
-- _close_lot chỉ định nghĩa ở 20260913000001 ⇒ CREATE OR REPLACE nguyên hàm.

-- ─── 0. Vá hàm dùng chung theo mốc ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.patch_fn(_sig TEXT, _marker TEXT, _pairs TEXT[])
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_def TEXT := pg_get_functiondef(_sig::regprocedure);
  i     INT;
BEGIN
  IF position(_marker IN v_def) > 0 THEN
    RAISE NOTICE '% đã vá (%) — bỏ qua', _sig, _marker;
    RETURN;
  END IF;
  FOR i IN 1 .. array_length(_pairs, 1) / 2 LOOP
    IF position(_pairs[2 * i - 1] IN v_def) = 0 THEN
      RAISE EXCEPTION '%: không thấy mốc «%» — bản LIVE đã đổi, vá tay', _sig, _pairs[2 * i - 1];
    END IF;
    v_def := replace(v_def, _pairs[2 * i - 1], _pairs[2 * i]);
  END LOOP;
  EXECUTE v_def;
END; $$;

-- ─── 1. Cấu hình ────────────────────────────────────────────────────────────
ALTER TABLE public.auction_sessions DROP CONSTRAINT IF EXISTS auction_sessions_bidding_method_check;
ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_bidding_method_check
    CHECK (bidding_method IN ('ascending', 'descending', 'sealed'));

ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS price_drop_seconds INT NOT NULL DEFAULT 60;
ALTER TABLE public.auction_sessions DROP CONSTRAINT IF EXISTS auction_sessions_price_drop_seconds_check;
ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_price_drop_seconds_check CHECK (price_drop_seconds BETWEEN 10 AND 3600);

COMMENT ON COLUMN public.auction_sessions.bidding_method IS
  'Phương thức trả giá: ascending (trả giá lên) | descending (đặt giá xuống) | sealed (bỏ phiếu kín).';
COMMENT ON COLUMN public.auction_sessions.price_drop_seconds IS
  'Đặt giá xuống: số giây giữa hai lần hạ một bước giá.';

ALTER TABLE public.auction_session_items
  ADD COLUMN IF NOT EXISTS floor_price NUMERIC(18,0);
ALTER TABLE public.auction_session_items DROP CONSTRAINT IF EXISTS auction_session_items_floor_price_check;
ALTER TABLE public.auction_session_items
  ADD CONSTRAINT auction_session_items_floor_price_check CHECK (floor_price IS NULL OR floor_price > 0);
COMMENT ON COLUMN public.auction_session_items.floor_price IS
  'Đặt giá xuống: giá thấp nhất máy chủ hạ tới (≤ giá khởi điểm, trên lưới bước giá). Kiểm khi mở lô.';

-- ─── 2. Trạng thái lô ───────────────────────────────────────────────────────
ALTER TABLE public.auction_lot_states
  ADD COLUMN IF NOT EXISTS price_anchor_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_anchor_amount NUMERIC(18,0),
  ADD COLUMN IF NOT EXISTS round_no            INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_bid_count     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tie_amount          NUMERIC(18,0),
  ADD COLUMN IF NOT EXISTS tied_bidder_nos     INT[];

ALTER TABLE public.auction_lot_states DROP CONSTRAINT IF EXISTS auction_lot_states_round_no_check;
ALTER TABLE public.auction_lot_states
  ADD CONSTRAINT auction_lot_states_round_no_check CHECK (round_no >= 1 AND round_bid_count >= 0);

ALTER TABLE public.auction_lot_states DROP CONSTRAINT IF EXISTS auction_lot_states_status_check;
ALTER TABLE public.auction_lot_states
  ADD CONSTRAINT auction_lot_states_status_check
    CHECK (status IN ('pending', 'open', 'paused', 'tied', 'closed', 'withdrawn'));
ALTER TABLE public.auction_lot_states DROP CONSTRAINT IF EXISTS als_tied_shape;
ALTER TABLE public.auction_lot_states
  ADD CONSTRAINT als_tied_shape CHECK (
    status <> 'tied' OR (tie_amount IS NOT NULL AND cardinality(tied_bidder_nos) >= 2)
  );

COMMENT ON COLUMN public.auction_lot_states.price_anchor_at IS
  'Đặt giá xuống: mốc tính giá (mở lô; dời theo khoảng tạm dừng). Giá = max(sàn, anchor_amount − ⌊(t − anchor_at)/nhịp⌋ × bước).';
COMMENT ON COLUMN public.auction_lot_states.round_no IS
  'Bỏ phiếu kín: vòng hiện tại (1 = vòng chính, ≥ 2 = vòng phụ cho người bằng giá).';
COMMENT ON COLUMN public.auction_lot_states.tied_bidder_nos IS
  'Bỏ phiếu kín: số báo danh cùng trả giá cao nhất ở vòng vừa xong — chỉ họ nộp được ở vòng phụ.';

-- Mỗi phiên một lô "đang diễn ra" — lô bằng giá chờ vòng phụ cũng chiếm sân khấu.
DROP INDEX IF EXISTS public.uq_auction_lot_states_one_live;
CREATE UNIQUE INDEX uq_auction_lot_states_one_live
  ON public.auction_lot_states (session_id)
  WHERE status IN ('open', 'paused', 'tied');

-- Loại sự kiện mới. THIẾU loại nào là _close_lot raise ⇒ cron close_due_lots
-- (một transaction cho mọi phiên) chết theo.
ALTER TABLE public.auction_lot_events DROP CONSTRAINT IF EXISTS auction_lot_events_kind_check;
ALTER TABLE public.auction_lot_events
  ADD CONSTRAINT auction_lot_events_kind_check CHECK (kind IN (
    'open', 'pause', 'resume', 'bid', 'bid_rejected', 'extend', 'withdraw_bid',
    'close', 'withdraw_lot', 'finalize', 'minutes', 'payment',
    'accept', 'sealed_bid', 'tie', 'tie_round'));

-- ─── 3. Phiếu kín ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_sealed_bids (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id       UUID NOT NULL REFERENCES public.auction_session_items(id) ON DELETE RESTRICT,
  session_id   UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE RESTRICT,
  contract_id  UUID NOT NULL REFERENCES public.auction_bidding_contracts(id) ON DELETE RESTRICT,
  bidder_no    INT NOT NULL CHECK (bidder_no > 0),
  round_no     INT NOT NULL DEFAULT 1 CHECK (round_no >= 1),
  amount       NUMERIC(18,0) NOT NULL CHECK (amount > 0),
  placed_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  client_nonce TEXT NOT NULL CHECK (length(client_nonce) BETWEEN 8 AND 100),
  CONSTRAINT auction_sealed_bids_one_per_round UNIQUE (lot_id, contract_id, round_no),
  CONSTRAINT auction_sealed_bids_nonce_uq UNIQUE (contract_id, client_nonce)
);
CREATE INDEX IF NOT EXISTS idx_auction_sealed_bids_lot ON public.auction_sealed_bids (lot_id, round_no);
CREATE INDEX IF NOT EXISTS idx_auction_sealed_bids_session ON public.auction_sealed_bids (session_id);

COMMENT ON TABLE public.auction_sealed_bids IS
  'Phiếu bỏ giá kín — chỉ ghi qua submit_sealed_bid, không sửa/xoá. Vòng chưa công bố chỉ người nộp đọc được.';

DROP TRIGGER IF EXISTS auction_sealed_bids_append_only ON public.auction_sealed_bids;
CREATE TRIGGER auction_sealed_bids_append_only
  BEFORE UPDATE OR DELETE ON public.auction_sealed_bids
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

ALTER TABLE public.auction_sealed_bids ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.auction_sealed_bids FROM anon, authenticated;

-- Vòng đã công bố: lô đã đóng / đang chờ vòng phụ, hoặc vòng đã qua.
CREATE OR REPLACE FUNCTION public.sealed_round_revealed(_lot_id UUID, _round_no INT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.auction_lot_states st
                  WHERE st.lot_id = _lot_id
                    AND (st.status IN ('closed', 'tied') OR _round_no < st.round_no))
$$;
REVOKE EXECUTE ON FUNCTION public.sealed_round_revealed(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sealed_round_revealed(UUID, INT) TO anon, authenticated;

DROP POLICY IF EXISTS "auction_sealed_bids_own_read" ON public.auction_sealed_bids;
CREATE POLICY "auction_sealed_bids_own_read" ON public.auction_sealed_bids
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auction_bidding_contracts c
                  WHERE c.id = contract_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "auction_sealed_bids_public_read" ON public.auction_sealed_bids;
CREATE POLICY "auction_sealed_bids_public_read" ON public.auction_sealed_bids
  FOR SELECT TO anon, authenticated
  USING (public.auction_session_is_public(session_id) AND public.sealed_round_revealed(lot_id, round_no));
DROP POLICY IF EXISTS "auction_sealed_bids_org_read" ON public.auction_sealed_bids;
CREATE POLICY "auction_sealed_bids_org_read" ON public.auction_sealed_bids
  FOR SELECT TO authenticated
  USING ((public.can_run_auction_session(session_id, 'view')
          OR public.can_manage_auction_session_items(session_id, 'view'))
         AND public.sealed_round_revealed(lot_id, round_no));
DROP POLICY IF EXISTS "auction_sealed_bids_admin_read" ON public.auction_sealed_bids;
CREATE POLICY "auction_sealed_bids_admin_read" ON public.auction_sealed_bids
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role) AND public.sealed_round_revealed(lot_id, round_no));

-- ─── 4. Khoá cấu hình khi đã bắt đầu trả giá ────────────────────────────────
SELECT pg_temp.patch_fn('public.auction_sessions_bidding_guard()', 'NEW.price_drop_seconds', ARRAY[
  '(NEW.bidding_method, NEW.extension_seconds,', '(NEW.bidding_method, NEW.price_drop_seconds, NEW.extension_seconds,',
  '(OLD.bidding_method, OLD.extension_seconds,', '(OLD.bidding_method, OLD.price_drop_seconds, OLD.extension_seconds,'
]);
SELECT pg_temp.patch_fn('public.auction_session_items_bidding_lock()', 'NEW.floor_price', ARRAY[
  '(NEW.starting_price, NEW.bid_step,', '(NEW.starting_price, NEW.floor_price, NEW.bid_step,',
  '(OLD.starting_price, OLD.bid_step,', '(OLD.starting_price, OLD.floor_price, OLD.bid_step,'
]);

-- ─── 5. Helper ──────────────────────────────────────────────────────────────
-- Giá đặt giá xuống tại thời điểm _at (đứng yên khi tạm dừng).
CREATE OR REPLACE FUNCTION public._descending_price(_st public.auction_lot_states, _floor NUMERIC,
                                                    _step NUMERIC, _drop INT, _at TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$
  SELECT GREATEST(_floor, _st.price_anchor_amount - floor(
           GREATEST(0, extract(epoch FROM (CASE WHEN _st.status = 'paused' THEN _st.paused_at ELSE _at END)
                                          - _st.price_anchor_at)) / _drop) * _step)
$$;

-- Lý do từ chối mở lô theo phương thức (NULL = mở được).
CREATE OR REPLACE FUNCTION public._lot_open_reject(_lot_id UUID, _duration_seconds INT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN s.bidding_method = 'descending' AND i.floor_price IS NULL THEN 'floor_missing'
    WHEN s.bidding_method = 'descending'
         AND (i.floor_price > i.starting_price OR mod(i.starting_price - i.floor_price, i.bid_step) <> 0)
      THEN 'floor_invalid'
    WHEN s.bidding_method = 'sealed' AND _duration_seconds IS NULL THEN 'duration_required'
  END
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id
$$;

-- Mốc kết thúc khi mở lô. Đặt giá xuống: hạ hết tới sàn + giữ sàn thêm một nhịp.
CREATE OR REPLACE FUNCTION public._lot_open_ends(_lot_id UUID, _now TIMESTAMPTZ, _default TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN s.bidding_method = 'descending'
              THEN LEAST(s.ends_at, _now + make_interval(secs =>
                     (((i.starting_price - i.floor_price) / i.bid_step) + 1) * s.price_drop_seconds))
              ELSE _default END
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id
$$;

CREATE OR REPLACE FUNCTION public._lot_after_open(_lot_id UUID, _now TIMESTAMPTZ)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.auction_lot_states st
     SET price_anchor_at     = CASE WHEN s.bidding_method = 'descending' THEN _now END,
         price_anchor_amount = CASE WHEN s.bidding_method = 'descending' THEN i.starting_price END,
         round_no            = 1,
         round_bid_count     = 0
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE st.lot_id = _lot_id AND i.id = _lot_id
$$;

REVOKE EXECUTE ON FUNCTION public._descending_price(public.auction_lot_states, NUMERIC, NUMERIC, INT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lot_open_reject(UUID, INT)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lot_open_ends(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lot_after_open(UUID, TIMESTAMPTZ)             FROM PUBLIC, anon, authenticated;

-- ─── 6. Đóng lô / vòng ──────────────────────────────────────────────────────
-- Hết giờ một vòng bỏ phiếu kín. Người gọi (_close_lot) đã khoá lô + dòng trạng thái.
CREATE OR REPLACE FUNCTION public._close_sealed_round(_lot_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  st     public.auction_lot_states;
  v_top  NUMERIC;
  v_n    INT;
  v_tied INT[];
  v_win  public.auction_sealed_bids;
  v_bid  UUID;
  v_seq  INT := 0;
  r      public.auction_sealed_bids;
BEGIN
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id;

  SELECT max(b.amount) INTO v_top
    FROM public.auction_sealed_bids b
    JOIN public.auction_bidding_contracts c ON c.id = b.contract_id
   WHERE b.lot_id = _lot_id AND b.round_no = st.round_no AND c.deposit_status <> 'forfeited';

  IF v_top IS NULL THEN
    IF st.round_no > 1 THEN
      -- Vòng phụ không ai nộp ⇒ người nộp sớm nhất trong nhóm bằng giá vòng trước.
      SELECT b.* INTO v_win
        FROM public.auction_sealed_bids b
        JOIN public.auction_bidding_contracts c ON c.id = b.contract_id
       WHERE b.lot_id = _lot_id AND b.round_no = st.round_no - 1 AND b.amount = st.tie_amount
         AND b.bidder_no = ANY (st.tied_bidder_nos) AND c.deposit_status <> 'forfeited'
       ORDER BY b.placed_at, b.id
       LIMIT 1;
    END IF;
  ELSE
    SELECT array_agg(b.bidder_no ORDER BY b.bidder_no), count(*) INTO v_tied, v_n
      FROM public.auction_sealed_bids b
      JOIN public.auction_bidding_contracts c ON c.id = b.contract_id
     WHERE b.lot_id = _lot_id AND b.round_no = st.round_no AND b.amount = v_top
       AND c.deposit_status <> 'forfeited';

    IF v_n > 1 THEN
      UPDATE public.auction_lot_states
         SET status = 'tied', tie_amount = v_top, tied_bidder_nos = v_tied
       WHERE lot_id = _lot_id;
      PERFORM public._lot_event(st.session_id, _lot_id, 'tie', jsonb_build_object(
        'round_no', st.round_no, 'tie_amount', v_top, 'bidder_nos', to_jsonb(v_tied),
        'round_bid_count', st.round_bid_count, 'ends_at', st.ends_at));
      RETURN true;
    END IF;

    SELECT b.* INTO v_win
      FROM public.auction_sealed_bids b
      JOIN public.auction_bidding_contracts c ON c.id = b.contract_id
     WHERE b.lot_id = _lot_id AND b.round_no = st.round_no AND b.amount = v_top
       AND c.deposit_status <> 'forfeited'
     LIMIT 1;
  END IF;

  -- Công bố: chép mọi phiếu sang sổ trả giá, người trúng là lượt cuối.
  FOR r IN
    SELECT b.* FROM public.auction_sealed_bids b
     WHERE b.lot_id = _lot_id AND b.id IS DISTINCT FROM v_win.id
     ORDER BY b.round_no, b.amount, b.placed_at DESC, b.id
  LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.auction_bids (lot_id, session_id, contract_id, bidder_no, seq, amount, placed_at, client_nonce)
    VALUES (r.lot_id, r.session_id, r.contract_id, r.bidder_no, v_seq, r.amount, r.placed_at, r.client_nonce);
  END LOOP;
  IF v_win.id IS NOT NULL THEN
    v_seq := v_seq + 1;
    INSERT INTO public.auction_bids (lot_id, session_id, contract_id, bidder_no, seq, amount, placed_at, client_nonce)
    VALUES (v_win.lot_id, v_win.session_id, v_win.contract_id, v_win.bidder_no, v_seq, v_win.amount,
            v_win.placed_at, v_win.client_nonce)
    RETURNING id INTO v_bid;
  END IF;

  UPDATE public.auction_lot_states
     SET status             = 'closed',
         closed_at          = st.ends_at,
         result             = CASE WHEN v_win.id IS NULL THEN 'unsold' ELSE 'sold' END,
         winner_contract_id = v_win.contract_id,
         winning_amount     = v_win.amount,
         payment_due_at     = CASE WHEN v_win.id IS NULL THEN NULL ELSE st.ends_at + interval '30 days' END,
         payment_status     = CASE WHEN v_win.id IS NULL THEN NULL ELSE 'pending' END,
         current_bid_id     = v_bid,
         current_price      = v_win.amount,
         leading_bidder_no  = v_win.bidder_no,
         bid_count          = v_seq
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(st.session_id, _lot_id, 'close', jsonb_build_object(
    'result',         CASE WHEN v_win.id IS NULL THEN 'unsold' ELSE 'sold' END,
    'winning_amount', v_win.amount,
    'bidder_no',      v_win.bidder_no,
    'bid_count',      v_seq,
    'round_no',       st.round_no,
    'ends_at',        st.ends_at));
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public._close_sealed_round(UUID) FROM PUBLIC, anon, authenticated;

-- Đóng lô đã đến giờ (bỏ phiếu kín: đóng VÒNG — có thể sang 'tied').
CREATE OR REPLACE FUNCTION public._close_lot(_lot_id UUID, _at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  st       public.auction_lot_states;
  v_winner UUID;
BEGIN
  PERFORM public._lot_lock(_lot_id);
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status <> 'open' OR st.ends_at > _at THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = st.session_id AND bidding_method = 'sealed') THEN
    RETURN public._close_sealed_round(_lot_id);
  END IF;

  IF st.current_bid_id IS NOT NULL THEN
    SELECT contract_id INTO v_winner FROM public.auction_bids WHERE id = st.current_bid_id;
  END IF;

  UPDATE public.auction_lot_states
     SET status             = 'closed',
         closed_at          = st.ends_at,
         result             = CASE WHEN v_winner IS NULL THEN 'unsold' ELSE 'sold' END,
         winner_contract_id = v_winner,
         winning_amount     = CASE WHEN v_winner IS NULL THEN NULL ELSE st.current_price END,
         payment_due_at     = CASE WHEN v_winner IS NULL THEN NULL ELSE st.ends_at + interval '30 days' END,
         payment_status     = CASE WHEN v_winner IS NULL THEN NULL ELSE 'pending' END
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(st.session_id, _lot_id, 'close', jsonb_build_object(
    'result',         CASE WHEN v_winner IS NULL THEN 'unsold' ELSE 'sold' END,
    'winning_amount', CASE WHEN v_winner IS NULL THEN NULL ELSE st.current_price END,
    'bidder_no',      CASE WHEN v_winner IS NULL THEN NULL ELSE st.leading_bidder_no END,
    'bid_count',      st.bid_count,
    'ends_at',        st.ends_at));
  RETURN true;
END; $$;

-- ─── 7. Vá RPC dùng chung ───────────────────────────────────────────────────
-- place_bid chỉ cho trả giá lên.
SELECT pg_temp.patch_fn('public.place_bid(uuid, numeric, text)', 'method_mismatch', ARRAY[
  E'  PERFORM public._lot_lock(_lot_id);\n  v_now := clock_timestamp();\n',
  E'  -- Phương thức (20261018190000): place_bid chỉ dành cho trả giá lên.\n'
  || E'  IF (SELECT bidding_method FROM public.auction_sessions WHERE id = it.session_id) <> ''ascending'' THEN\n'
  || E'    RETURN jsonb_build_object(''ok'', false, ''reason'', ''method_mismatch'');\n'
  || E'  END IF;\n\n'
  || E'  PERFORM public._lot_lock(_lot_id);\n  v_now := clock_timestamp();\n'
]);

-- org_open_lot: kiểm cấu hình theo phương thức, mốc kết thúc/mốc giá, lô bằng giá chiếm sân khấu.
SELECT pg_temp.patch_fn('public.org_open_lot(uuid, integer)', '_lot_open_reject', ARRAY[
  E'  -- Lô khác đã quá giờ nhưng cron chưa đóng',
  E'  -- Phương thức (20261018190000): giá sàn cho đặt giá xuống, thời lượng cho bỏ phiếu kín.\n'
  || E'  IF public._lot_open_reject(_lot_id, _duration_seconds) IS NOT NULL THEN\n'
  || E'    RETURN jsonb_build_object(''ok'', false, ''reason'', public._lot_open_reject(_lot_id, _duration_seconds));\n'
  || E'  END IF;\n\n'
  || E'  -- Lô khác đã quá giờ nhưng cron chưa đóng',
  E'     AND st2.status IN (''open'', ''paused'')',
  E'     AND st2.status IN (''open'', ''paused'', ''tied'')',
  E'     SET status = ''open'', opened_at = v_now, ends_at = v_ends\n   WHERE lot_id = _lot_id;\n',
  E'     SET status = ''open'', opened_at = v_now, ends_at = v_ends\n   WHERE lot_id = _lot_id;\n'
  || E'  PERFORM public._lot_after_open(_lot_id, v_now);\n',
  E'  UPDATE public.auction_lot_states\n     SET status = ''open'', opened_at',
  E'  v_ends := public._lot_open_ends(_lot_id, v_now, v_ends);\n\n'
  || E'  UPDATE public.auction_lot_states\n     SET status = ''open'', opened_at'
]);

-- org_resume_lot: mốc giá đặt giá xuống dời đúng bằng khoảng tạm dừng.
SELECT pg_temp.patch_fn('public.org_resume_lot(uuid)', 'price_anchor_at', ARRAY[
  E'     SET status = ''open'', paused_at = NULL, pause_reason = NULL, ends_at = v_ends\n',
  E'     SET status = ''open'', paused_at = NULL, pause_reason = NULL, ends_at = v_ends,\n'
  || E'         price_anchor_at = price_anchor_at + (v_now - st.paused_at)\n'
]);

-- Lô bằng giá rút được (thủ công và khi phiên bị huỷ).
SELECT pg_temp.patch_fn('public.org_withdraw_lot(uuid, text)', '''paused'', ''tied''', ARRAY[
  E'''pending'', ''open'', ''paused'')', E'''pending'', ''open'', ''paused'', ''tied'')'
]);
SELECT pg_temp.patch_fn('public.close_due_lots()', '''paused'', ''tied''', ARRAY[
  E'''pending'', ''open'', ''paused'')', E'''pending'', ''open'', ''paused'', ''tied'')'
]);

-- ─── 8. RPC mới ─────────────────────────────────────────────────────────────
-- Chấp nhận giá (đặt giá xuống). THỨ TỰ KIỂM TRA (client src/lib/bidding/descending.ts theo đúng):
--   not_authenticated → lot_not_found → method_mismatch → session_not_live → lot_not_open
--   → lot_paused → lot_closed → not_eligible → lot_not_registered → invalid_nonce → price_changed
-- _amount = giá người dùng đang thấy. Máy chủ ghi GIÁ CỦA MÁY CHỦ (≤ _amount vì giá chỉ
-- giảm); _amount < giá máy chủ (client chạy trước đồng hồ) ⇒ price_changed.
CREATE OR REPLACE FUNCTION public.accept_descending_price(_lot_id UUID, _amount NUMERIC, _nonce TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_nonce  TEXT := btrim(COALESCE(_nonce, ''));
  it       RECORD;
  c        RECORD;
  st       public.auction_lot_states;
  v_dup    RECORD;
  v_now    TIMESTAMPTZ;
  v_price  NUMERIC;
  v_bid_id UUID;
  v_seq    INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT i.id, i.session_id, i.starting_price, i.bid_step, i.floor_price,
         s.status AS session_status, s.auction_format, s.starts_at, s.bidding_method, s.price_drop_seconds
    INTO it
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR it.session_status NOT IN ('published', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_found');
  END IF;
  IF it.bidding_method <> 'descending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'method_mismatch');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO c
    FROM public.auction_bidding_contracts
   WHERE session_id = it.session_id AND user_id = v_uid AND status = 'paid';

  IF c.id IS NOT NULL AND v_nonce <> '' THEN
    SELECT b.id, b.seq, b.amount, b.lot_id INTO v_dup
      FROM public.auction_bids b WHERE b.contract_id = c.id AND b.client_nonce = v_nonce;
    IF v_dup.id IS NOT NULL THEN
      IF v_dup.lot_id <> _lot_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_nonce');
      END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'bid_id', v_dup.id,
                                'amount', v_dup.amount, 'bidder_no', c.bidder_no);
    END IF;
  END IF;

  IF it.session_status <> 'published' OR it.auction_format NOT IN ('truc_tuyen', 'ca_hai')
     OR v_now < it.starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status IN ('pending', 'withdrawn') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_open');
  END IF;
  IF st.status = 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_paused');
  END IF;
  IF NOT public.lot_is_open(st, v_now) THEN
    PERFORM public._close_lot(_lot_id, v_now);
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;

  IF c.id IS NULL OR c.bidder_no IS NULL OR c.deposit_status <> 'received'
     OR c.checked_in_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;
  IF NOT public._contract_lot_ok(c.id, _lot_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_registered');
  END IF;
  IF length(v_nonce) NOT BETWEEN 8 AND 100 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_nonce');
  END IF;

  v_price := public._descending_price(st, it.floor_price, it.bid_step, it.price_drop_seconds, v_now);
  IF _amount IS NULL OR _amount < v_price THEN
    PERFORM public._lot_event(it.session_id, _lot_id, 'bid_rejected', jsonb_build_object(
      'reason', 'price_changed', 'amount', _amount, 'bidder_no', c.bidder_no, 'current_price', v_price));
    RETURN jsonb_build_object('ok', false, 'reason', 'price_changed', 'current_price', v_price);
  END IF;

  v_seq := st.bid_count + 1;
  INSERT INTO public.auction_bids (lot_id, session_id, contract_id, bidder_no, seq, amount, placed_at, client_nonce)
  VALUES (_lot_id, it.session_id, c.id, c.bidder_no, v_seq, v_price, v_now, v_nonce)
  RETURNING id INTO v_bid_id;

  UPDATE public.auction_lot_states
     SET current_price     = v_price,
         current_bid_id    = v_bid_id,
         leading_bidder_no = c.bidder_no,
         bid_count         = v_seq,
         ends_at           = v_now
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'accept', jsonb_build_object(
    'bid_id', v_bid_id, 'seq', v_seq, 'amount', v_price, 'bidder_no', c.bidder_no));
  PERFORM public._close_lot(_lot_id, v_now);

  RETURN jsonb_build_object('ok', true, 'bid_id', v_bid_id, 'amount', v_price, 'bidder_no', c.bidder_no);
END; $$;

REVOKE ALL ON FUNCTION public.accept_descending_price(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_descending_price(UUID, NUMERIC, TEXT) TO authenticated;

-- Nộp phiếu kín. THỨ TỰ KIỂM TRA (client src/lib/bidding/sealed.ts theo đúng):
--   not_authenticated → lot_not_found → method_mismatch → session_not_live → lot_not_open
--   → round_closed → lot_paused → lot_closed → not_eligible → lot_not_registered
--   → not_in_tie_round → already_submitted → invalid_nonce → bid_too_low → bid_step_mismatch
-- Nhật ký KHÔNG ghi số tiền (tổ chức đọc được nhật ký khi vòng còn mở).
CREATE OR REPLACE FUNCTION public.submit_sealed_bid(_lot_id UUID, _amount NUMERIC, _nonce TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_nonce  TEXT := btrim(COALESCE(_nonce, ''));
  it       RECORD;
  c        RECORD;
  st       public.auction_lot_states;
  v_dup    RECORD;
  v_now    TIMESTAMPTZ;
  v_min    NUMERIC;
  v_reason TEXT;
  v_id     UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT i.id, i.session_id, i.starting_price, i.bid_step,
         s.status AS session_status, s.auction_format, s.starts_at, s.bidding_method
    INTO it
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR it.session_status NOT IN ('published', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_found');
  END IF;
  IF it.bidding_method <> 'sealed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'method_mismatch');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO c
    FROM public.auction_bidding_contracts
   WHERE session_id = it.session_id AND user_id = v_uid AND status = 'paid';

  IF c.id IS NOT NULL AND v_nonce <> '' THEN
    SELECT b.id, b.amount, b.round_no, b.lot_id INTO v_dup
      FROM public.auction_sealed_bids b WHERE b.contract_id = c.id AND b.client_nonce = v_nonce;
    IF v_dup.id IS NOT NULL THEN
      IF v_dup.lot_id <> _lot_id THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_nonce');
      END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'bid_id', v_dup.id, 'amount', v_dup.amount,
                                'round_no', v_dup.round_no, 'bidder_no', c.bidder_no);
    END IF;
  END IF;

  IF it.session_status <> 'published' OR it.auction_format NOT IN ('truc_tuyen', 'ca_hai')
     OR v_now < it.starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status IN ('pending', 'withdrawn') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_open');
  END IF;
  IF st.status = 'tied' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'round_closed');
  END IF;
  IF st.status = 'paused' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_paused');
  END IF;
  IF NOT public.lot_is_open(st, v_now) THEN
    PERFORM public._close_lot(_lot_id, v_now);
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_closed');
  END IF;

  IF c.id IS NULL OR c.bidder_no IS NULL OR c.deposit_status <> 'received'
     OR c.checked_in_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;
  IF NOT public._contract_lot_ok(c.id, _lot_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_registered');
  END IF;

  v_min := CASE WHEN st.round_no > 1 THEN st.tie_amount ELSE it.starting_price END;

  IF st.round_no > 1 AND NOT (c.bidder_no = ANY (COALESCE(st.tied_bidder_nos, '{}'))) THEN
    v_reason := 'not_in_tie_round';
  ELSIF EXISTS (SELECT 1 FROM public.auction_sealed_bids
                 WHERE lot_id = _lot_id AND contract_id = c.id AND round_no = st.round_no) THEN
    v_reason := 'already_submitted';
  ELSIF length(v_nonce) NOT BETWEEN 8 AND 100 THEN
    v_reason := 'invalid_nonce';
  ELSIF _amount IS NULL OR _amount < v_min THEN
    v_reason := 'bid_too_low';
  ELSIF _amount <> trunc(_amount) OR mod(_amount - it.starting_price, it.bid_step) <> 0 THEN
    v_reason := 'bid_step_mismatch';
  END IF;

  IF v_reason IS NOT NULL THEN
    PERFORM public._lot_event(it.session_id, _lot_id, 'bid_rejected', jsonb_build_object(
      'reason', v_reason, 'bidder_no', c.bidder_no, 'round_no', st.round_no));
    RETURN jsonb_build_object('ok', false, 'reason', v_reason, 'min_amount', v_min, 'round_no', st.round_no);
  END IF;

  INSERT INTO public.auction_sealed_bids (lot_id, session_id, contract_id, bidder_no, round_no, amount, placed_at, client_nonce)
  VALUES (_lot_id, it.session_id, c.id, c.bidder_no, st.round_no, _amount, v_now, v_nonce)
  RETURNING id INTO v_id;

  UPDATE public.auction_lot_states
     SET bid_count = bid_count + 1, round_bid_count = round_bid_count + 1
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'sealed_bid', jsonb_build_object(
    'bid_id', v_id, 'bidder_no', c.bidder_no, 'round_no', st.round_no));

  RETURN jsonb_build_object('ok', true, 'bid_id', v_id, 'amount', _amount, 'round_no', st.round_no,
                            'bidder_no', c.bidder_no);
END; $$;

REVOKE ALL ON FUNCTION public.submit_sealed_bid(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_sealed_bid(UUID, NUMERIC, TEXT) TO authenticated;

-- Mở vòng phụ cho người bằng giá. Thời lượng BẮT BUỘC (60 giây .. 24 giờ), không
-- cắt theo giờ kết thúc phiên — vòng phụ có thể rơi sau giờ đó.
CREATE OR REPLACE FUNCTION public.org_open_tie_round(_lot_id UUID, _duration_seconds INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it     RECORD;
  st     public.auction_lot_states;
  v_now  TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
BEGIN
  SELECT i.id, i.session_id, s.organization_id, s.status AS session_status
    INTO it
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_run_auction(it.organization_id, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF _duration_seconds IS NULL OR _duration_seconds < 60 OR _duration_seconds > 86400 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_duration',
                              'min_seconds', 60, 'max_seconds', 86400);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('session-live-lot:' || it.session_id::text, 0));
  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  IF it.session_status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.lot_id IS NULL OR st.status <> 'tied' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', st.status);
  END IF;

  v_ends := v_now + make_interval(secs => _duration_seconds);
  UPDATE public.auction_lot_states
     SET status = 'open', round_no = round_no + 1, round_bid_count = 0,
         opened_at = v_now, ends_at = v_ends
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'tie_round', jsonb_build_object(
    'round_no', st.round_no + 1, 'ends_at', v_ends, 'duration_seconds', _duration_seconds,
    'tie_amount', st.tie_amount, 'bidder_nos', to_jsonb(st.tied_bidder_nos)));
  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends, 'round_no', st.round_no + 1);
END; $$;

REVOKE ALL ON FUNCTION public.org_open_tie_round(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_open_tie_round(UUID, INT) TO authenticated;

-- ─── Kiểm chứng ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['place_bid', 'org_open_lot', 'org_resume_lot', 'org_withdraw_lot', 'close_due_lots',
                           '_close_lot', 'accept_descending_price', 'submit_sealed_bid', 'org_open_tie_round']
  LOOP
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = f) <> 1 THEN
      RAISE EXCEPTION '% có nhiều hơn / ít hơn 1 bản', f;
    END IF;
  END LOOP;
  IF position('method_mismatch' IN pg_get_functiondef('public.place_bid(uuid, numeric, text)'::regprocedure)) = 0
     OR position('lot_not_registered' IN pg_get_functiondef('public.place_bid(uuid, numeric, text)'::regprocedure)) = 0
     OR position('checked_in_at' IN pg_get_functiondef('public.place_bid(uuid, numeric, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'place_bid mất một trong các vá (method_mismatch / lot_not_registered / checked_in_at)';
  END IF;
  IF position('_lot_after_open' IN pg_get_functiondef('public.org_open_lot(uuid, integer)'::regprocedure)) = 0
     OR position('_lot_open_ends' IN pg_get_functiondef('public.org_open_lot(uuid, integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'vá org_open_lot không ăn';
  END IF;
  IF has_function_privilege('anon', 'public.submit_sealed_bid(uuid, numeric, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.accept_descending_price(uuid, numeric, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.org_open_tie_round(uuid, int)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._close_sealed_round(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'quyền gọi hàm sai';
  END IF;
  IF has_table_privilege('authenticated', 'public.auction_sealed_bids', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated ghi thẳng được auction_sealed_bids';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables
              WHERE pubname = 'supabase_realtime' AND tablename = 'auction_sealed_bids') THEN
    RAISE EXCEPTION 'auction_sealed_bids không được nằm trong realtime';
  END IF;
  RAISE NOTICE 'OK: đặt giá xuống + bỏ phiếu kín';
END $$;

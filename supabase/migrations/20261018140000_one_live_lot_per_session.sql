-- Mỗi phiên chỉ MỘT lô đang diễn ra (mở hoặc tạm dừng) tại một thời điểm.
--
-- Các lô trong phiên đấu LẦN LƯỢT: lô sau chỉ được mở khi lô trước đã đóng hoặc
-- bị rút. Màn Điều hành (BiddingControlRoom) vốn chỉ hiện nút "Mở lô" khi không
-- có lô nào live/paused, nhưng org_open_lot ở 20260913000003 chỉ khoá THEO LÔ —
-- hai tab điều hành (hoặc gọi RPC thẳng) vẫn mở được hai lô cùng lúc.
--
-- Hai lớp chặn:
--   1. org_open_lot giữ khoá tư vấn THEO PHIÊN trước khoá lô, rồi từ chối với
--      reason = 'another_lot_live' (kèm lot_no của lô đang chiếm sân khấu).
--      Lô 'open' ĐÃ QUÁ ends_at nhưng cron close_due_lots (10 giây) chưa kịp
--      đóng thì đóng luôn tại chỗ bằng _close_lot — client đã coi lô đó là
--      "đã đóng" (lotPhaseOf) và hiện nút mở lô kế tiếp, không được bắt đấu giá
--      viên chờ cron.
--   2. Unique index một phần trên auction_lot_states(session_id) cho status
--      IN ('open','paused') — bất biến ở tầng dữ liệu, kể cả với seed / SQL tay.
--      org_resume_lot (paused → open) không vi phạm vì là CÙNG một dòng.
--
-- Thứ tự khoá: phiên → lô → (lô cũ trong _close_lot). Không hàm nào khác giữ khoá
-- lô rồi mới xin khoá phiên, nên không có vòng chờ.
--
-- Giữ nguyên chữ ký (UUID, INT) ⇒ CREATE OR REPLACE được, quyền giữ nguyên.

-- ─── 0. Dữ liệu hiện có phải sạch trước khi dựng index ─────────────────────
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(s.code || ' (' || x.n || ' lô)', ', ') INTO v_bad
    FROM (SELECT session_id, count(*) AS n
            FROM public.auction_lot_states
           WHERE status IN ('open', 'paused')
           GROUP BY session_id HAVING count(*) > 1) x
    JOIN public.auction_sessions s ON s.id = x.session_id;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Phiên đang có nhiều lô mở/tạm dừng cùng lúc: % — đóng bớt trước khi áp migration', v_bad;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_auction_lot_states_one_live
  ON public.auction_lot_states (session_id)
  WHERE status IN ('open', 'paused');

-- ─── 1. org_open_lot ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_open_lot(_lot_id UUID, _duration_seconds INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it      RECORD;
  st      public.auction_lot_states;
  other   RECORD;
  v_now   TIMESTAMPTZ;
  v_ends  TIMESTAMPTZ;
BEGIN
  SELECT i.id, i.session_id, i.starting_price, i.bid_step,
         s.organization_id, s.status AS session_status, s.auction_format, s.starts_at, s.ends_at
    INTO it
    FROM public.auction_session_items i
    JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_run_auction(it.organization_id, 'operate') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- 60 giây .. 24 giờ. NULL = đóng theo giờ kết thúc phiên.
  IF _duration_seconds IS NOT NULL
     AND (_duration_seconds < 60 OR _duration_seconds > 86400) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_duration',
                              'min_seconds', 60, 'max_seconds', 86400);
  END IF;

  -- Khoá PHIÊN trước khoá lô: hai lời mở hai lô khác nhau của cùng phiên phải
  -- xếp hàng, nếu không cả hai cùng thấy "không có lô nào đang mở".
  PERFORM pg_advisory_xact_lock(hashtextextended('session-live-lot:' || it.session_id::text, 0));
  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  IF it.session_status <> 'published' OR it.auction_format NOT IN ('truc_tuyen', 'ca_hai')
     OR v_now < it.starts_at OR v_now >= it.ends_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;
  IF it.starting_price IS NULL OR it.bid_step IS NULL OR it.bid_step <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_configured');
  END IF;

  -- Lô khác đã quá giờ nhưng cron chưa đóng ⇒ đóng tại chỗ (_close_lot tự khoá
  -- lô đó và kiểm lại ends_at sau khi khoá).
  FOR other IN
    SELECT lot_id FROM public.auction_lot_states
     WHERE session_id = it.session_id AND lot_id <> _lot_id
       AND status = 'open' AND ends_at <= v_now
     ORDER BY lot_id
  LOOP
    PERFORM public._close_lot(other.lot_id, v_now);
  END LOOP;

  SELECT st2.lot_id, i2.lot_no, st2.status INTO other
    FROM public.auction_lot_states st2
    JOIN public.auction_session_items i2 ON i2.id = st2.lot_id
   WHERE st2.session_id = it.session_id AND st2.lot_id <> _lot_id
     AND st2.status IN ('open', 'paused')
   LIMIT 1;
  IF other.lot_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'another_lot_live',
                              'lot_no', other.lot_no, 'status', other.status);
  END IF;

  INSERT INTO public.auction_lot_states (lot_id, session_id) VALUES (_lot_id, it.session_id)
  ON CONFLICT (lot_id) DO NOTHING;
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', st.status);
  END IF;

  v_ends := CASE WHEN _duration_seconds IS NULL THEN it.ends_at
                 ELSE LEAST(it.ends_at, v_now + make_interval(secs => _duration_seconds)) END;

  UPDATE public.auction_lot_states
     SET status = 'open', opened_at = v_now, ends_at = v_ends
   WHERE lot_id = _lot_id;

  PERFORM public._lot_event(it.session_id, _lot_id, 'open', jsonb_build_object(
    'ends_at', v_ends, 'duration_seconds', _duration_seconds));
  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends);
END; $$;

-- ─── Kiểm chứng ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND proname = 'org_open_lot';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'org_open_lot bị nạp chồng (% bản)', v_count;
  END IF;
  IF has_function_privilege('anon', 'public.org_open_lot(uuid, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'org_open_lot vẫn gọi được bởi anon';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.org_open_lot(uuid, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated chưa gọi được org_open_lot';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'public' AND indexname = 'uq_auction_lot_states_one_live') THEN
    RAISE EXCEPTION 'Thiếu uq_auction_lot_states_one_live';
  END IF;
  RAISE NOTICE 'OK: mỗi phiên chỉ một lô mở/tạm dừng';
END $$;

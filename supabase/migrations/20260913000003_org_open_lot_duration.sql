-- Cửa sổ đóng lô cho màn điều hành (Bước 5 của docs/online-auction-plan.md).
--
-- org_open_lot nhận thêm _duration_seconds: đấu giá viên chọn 15 / 30 / 60 phút,
-- một số phút tuỳ ý, hoặc "đến hết phiên" (NULL). Mốc đóng KHÔNG bao giờ vượt
-- quá giờ kết thúc phiên — LEAST(session.ends_at, now + thời lượng).
--
-- Vì sao cần: bản 20260913000001 đặt cứng ends_at của lô = ends_at của PHIÊN.
-- Phiên demo kết thúc 31/12/2026 nên lô mở ra chạy hơn ba tháng: đồng hồ hiện
-- "còn 110 ngày", cơ chế gia hạn mềm (ends_at - now < extension_seconds) không
-- bao giờ chạm tới, và close_due_lots không có gì để đóng.
--
-- PHẢI DROP TRƯỚC: CREATE OR REPLACE KHÔNG đổi được chữ ký, nó tạo thêm một hàm
-- NẠP CHỒNG, và lời gọi 1 tham số của PostgREST sẽ nhập nhằng (PGRST203) —
-- typecheck vẫn xanh, chỉ có RPC là hỏng lúc chạy. DROP cũng xoá luôn quyền nên
-- phải áp lại đúng khối REVOKE/GRANT của 20260913000001 (dòng 1360 và 1368),
-- nếu không bất biến "hàm ghi không gọi được bởi anon" ở mục 12 của file đó
-- không còn đúng nữa.

DROP FUNCTION IF EXISTS public.org_open_lot(UUID);

CREATE FUNCTION public.org_open_lot(_lot_id UUID, _duration_seconds INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it     RECORD;
  st     public.auction_lot_states;
  v_now  TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
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

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  IF it.session_status <> 'published' OR it.auction_format NOT IN ('truc_tuyen', 'ca_hai')
     OR v_now < it.starts_at OR v_now >= it.ends_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_live');
  END IF;
  IF it.starting_price IS NULL OR it.bid_step IS NULL OR it.bid_step <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_configured');
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

  -- Ghi mốc ĐÃ CHỌN, không phải giờ kết thúc phiên; kèm thời lượng để nhật ký
  -- điều hành nói được "mở 15 phút".
  PERFORM public._lot_event(it.session_id, _lot_id, 'open', jsonb_build_object(
    'ends_at', v_ends, 'duration_seconds', _duration_seconds));
  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends);
END; $$;

REVOKE ALL ON FUNCTION public.org_open_lot(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_open_lot(UUID, INT) TO authenticated;

-- ─── Kiểm chứng ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND proname = 'org_open_lot';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'org_open_lot bị nạp chồng (% bản) — lời gọi 1 tham số sẽ nhập nhằng', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'org_open_lot'
                AND has_function_privilege('anon', p.oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'org_open_lot vẫn gọi được bởi anon';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.org_open_lot(uuid, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated chưa gọi được org_open_lot';
  END IF;

  RAISE NOTICE 'OK: org_open_lot nhận cửa sổ đóng lô';
END $$;

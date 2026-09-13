-- Thêm MỘT người trả giá demo vào phiên PDG000013 [DEMO] (đấu giá trực tuyến:
-- đất thổ cư Đồng Nai và nhà phố Đống Đa) để tài khoản secsosoo@gmail.com vào
-- được PHÒNG ĐẤU GIÁ /sessions/f10d0009-.../dau-gia.
--
-- Cổng phòng (roomAccess.ts + useMyBidderStatus.ts, bản sao của chốt
-- `not_eligible` trong place_bid) đòi ĐỦ BA: hồ sơ status='paid',
-- deposit_status='received', có bidder_no. Thiếu một là chặn cả trang.
--
-- Tiền đặt trước tính theo PHIÊN (phủ cả 2 lô) nên bằng tổng deposit_amount của
-- auction_session_items — giống hệt 2 hồ sơ trong 20260913000002.
-- Dòng sổ tiền đặt trước KHÔNG chèn tay: trigger
-- auction_bidding_contracts_deposit_ledger_ins tự ghi khi INSERT đã 'received'.
--
-- Idempotent: có hồ sơ rồi thì thôi (uq_abc_session_user chỉ chặn hồ sơ chưa huỷ).
--
-- GỠ (chạy tay, tắt trigger vì sổ tiền đặt trước là chỉ-ghi-thêm):
--   BEGIN;
--   ALTER TABLE public.auction_deposit_events DISABLE TRIGGER auction_deposit_events_append_only;
--   DELETE FROM public.auction_deposit_events    WHERE contract_id = 'f10d0009-0000-4000-8000-000000000023';
--   DELETE FROM public.auction_bidding_contracts WHERE id = 'f10d0009-0000-4000-8000-000000000023';
--   ALTER TABLE public.auction_deposit_events ENABLE TRIGGER auction_deposit_events_append_only;
--   COMMIT;

DO $seed$
DECLARE
  c_session  CONSTANT UUID := 'f10d0009-0000-4000-8000-000000000001';
  c_org      CONSTANT UUID := 'c9d00002-0000-4000-8000-000000000001';
  c_owner    CONSTANT UUID := '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f';  -- chủ tổ chức Bảo Tín
  c_contract CONSTANT UUID := 'f10d0009-0000-4000-8000-000000000023';
  c_email    CONSTANT TEXT := 'secsosoo@gmail.com';
  v_user     UUID;
  v_name     TEXT;
  v_phone    TEXT;
  v_deposit  NUMERIC;
  v_no       INT;
  v_now      TIMESTAMPTZ := date_trunc('minute', now());
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(c_email);
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản % — sửa seed trước khi áp.', c_email;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = c_session AND status = 'published') THEN
    RAISE EXCEPTION 'Phiên PDG000013 không tồn tại hoặc chưa công bố.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.auction_bidding_contracts
              WHERE session_id = c_session AND user_id = v_user AND status <> 'cancelled') THEN
    RAISE NOTICE 'Tài khoản % đã có hồ sơ ở PDG000013 — bỏ qua.', c_email;
    RETURN;
  END IF;

  -- Tên lấy từ profiles.name nếu hợp lệ (CHECK full_name >= 3 ký tự), số điện
  -- thoại từ auth.users.phone nếu đúng dạng (CHECK ^0[0-9]{9}$) — profiles
  -- KHÔNG có cột phone. Không đạt thì dùng dữ liệu mẫu.
  SELECT NULLIF(btrim(p.name), '') INTO v_name FROM public.profiles p WHERE p.id = v_user;
  SELECT NULLIF(btrim(u.phone), '') INTO v_phone FROM auth.users u WHERE u.id = v_user;
  IF v_name IS NULL OR length(v_name) < 3 THEN v_name := 'Trần Minh Khoa'; END IF;
  IF v_phone IS NULL OR v_phone !~ '^0[0-9]{9}$' THEN v_phone := '0903456789'; END IF;

  SELECT sum(deposit_amount) INTO v_deposit
    FROM public.auction_session_items WHERE session_id = c_session;
  SELECT COALESCE(max(bidder_no), 0) + 1 INTO v_no
    FROM public.auction_bidding_contracts WHERE session_id = c_session;

  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender,
    phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at,
    deposit_status_changed_at, deposit_note, deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    c_contract, 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'),
    c_session, c_org, v_user,
    v_name, 'cccd', '079085006789', DATE '1985-02-20', 'male',
    v_phone, c_email, '45 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'manual',
    500000, 'paid', v_now - interval '3 days', 'DEMO-VNP-PDG13-0003',
    'received', v_deposit, v_now - interval '1 day', v_now - interval '1 day',
    'Chuyển khoản tiền đặt trước (dữ liệu mẫu)', c_owner, v_no, v_now - interval '1 day' + interval '1 minute',
    v_now - interval '3 days', v_now - interval '1 day'
  );

  -- ── Kiểm chứng: đúng ba điều kiện mà cổng phòng đòi ──
  IF NOT EXISTS (SELECT 1 FROM public.auction_bidding_contracts
                  WHERE id = c_contract AND status = 'paid'
                    AND deposit_status = 'received' AND bidder_no IS NOT NULL) THEN
    RAISE EXCEPTION 'Seed: hồ sơ của % chưa đủ điều kiện trả giá.', c_email;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.auction_deposit_events
                  WHERE contract_id = c_contract AND kind = 'received') THEN
    RAISE EXCEPTION 'Seed: thiếu dòng sổ tiền đặt trước cho %.', c_email;
  END IF;

  RAISE NOTICE 'OK: % vào được phòng đấu giá PDG000013, số báo danh %', c_email, v_no;
END $seed$;

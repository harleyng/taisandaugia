-- Bộ demo GIAI ĐOẠN SAU ĐẤU GIÁ — phiên PDG000014 [DEMO] đã chốt kết quả.
--
-- PDG000013 là demo ĐANG đấu giá; PDG000014 là demo SAU đấu giá. Hai bộ độc
-- lập, không bộ nào cần bộ kia đã chạy.
--
-- Phiên có 2 lô, CẢ HAI đều bán được, cố ý mỗi lô một CHUỖI BÊN BÁN khác nhau
-- để `org_create_sale_contract` được thử cả hai nhánh:
--   lô 1 — hồ sơ ký gửi (posting) có hợp đồng dịch vụ đã ký
--          ⇒ seller_kind = 'owner_user', chủ tài sản secsosoo@gmail.com tự vào
--            cổng chủ tài sản ký hợp đồng mua bán
--   lô 2 — tin đăng (listing) có chủ tài sản danh bạ, KHÔNG tài khoản
--          ⇒ seller_kind = 'org_on_behalf', tổ chức ký thay
--
-- Vì Bảo Tín chỉ còn ĐÚNG một tin đăng và một hồ sơ ký gửi rảnh, phiên này
-- không có lô ế và không có cọc `pending_refund` — hai tình huống đó vẫn xem ở
-- PDG000013.
--
-- KHÔNG seed sẵn hợp đồng mua bán: tạo hợp đồng chính là thao tác đầu tiên của
-- luồng, để nguyên cho người demo bấm.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- GỠ BỘ DEMO (chạy tay, một giao dịch). Hợp đồng mua bán phải xoá TRƯỚC vì
-- lot_id/session_id là FK RESTRICT; lot_states xoá TRƯỚC bids vì
-- current_bid_id cũng là RESTRICT.
--
--   BEGIN;
--   ALTER TABLE public.auction_sale_payments        DISABLE TRIGGER auction_sale_payments_append_only;
--   ALTER TABLE public.auction_sale_contract_events DISABLE TRIGGER auction_sale_contract_events_append_only;
--   ALTER TABLE public.auction_bids                 DISABLE TRIGGER auction_bids_guard;
--   ALTER TABLE public.auction_lot_events           DISABLE TRIGGER auction_lot_events_append_only;
--   ALTER TABLE public.auction_deposit_events       DISABLE TRIGGER auction_deposit_events_append_only;
--   ALTER TABLE public.auction_session_minutes      DISABLE TRIGGER auction_session_minutes_append_only;
--
--   DELETE FROM public.auction_sale_contract_events e USING public.auction_sale_contracts c
--     WHERE e.contract_id = c.id AND c.session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_sale_payments p USING public.auction_sale_contracts c
--     WHERE p.contract_id = c.id AND c.session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_sale_installments i USING public.auction_sale_contracts c
--     WHERE i.contract_id = c.id AND c.session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_sale_contracts    WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_session_minutes   WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_lot_states        WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_bids              WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_lot_events        WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_deposit_events    WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_bidding_contracts WHERE session_id = 'f10d000e-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_sessions          WHERE id         = 'f10d000e-0000-4000-8000-000000000001';
--
--   ALTER TABLE public.auction_session_minutes      ENABLE TRIGGER auction_session_minutes_append_only;
--   ALTER TABLE public.auction_deposit_events       ENABLE TRIGGER auction_deposit_events_append_only;
--   ALTER TABLE public.auction_lot_events           ENABLE TRIGGER auction_lot_events_append_only;
--   ALTER TABLE public.auction_bids                 ENABLE TRIGGER auction_bids_guard;
--   ALTER TABLE public.auction_sale_contract_events ENABLE TRIGGER auction_sale_contract_events_append_only;
--   ALTER TABLE public.auction_sale_payments        ENABLE TRIGGER auction_sale_payments_append_only;
--   COMMIT;
--
-- Tệp trong storage `auction-sale-contracts/c9d00002-…/` phải xoá qua Storage API.
-- Dựng lại = gỡ như trên rồi `psql -f` lại file này.
-- ─────────────────────────────────────────────────────────────────────────────

DO $seed$
DECLARE
  c_session  CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000001';
  c_lot1     CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000011';
  c_lot2     CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000012';
  c_ct1      CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000021';
  c_ct2      CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000022';
  c_bid1     CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000031';
  c_bid2     CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000032';

  c_org      CONSTANT UUID := 'c9d00002-0000-4000-8000-000000000001';  -- Bảo Tín
  c_aorg     CONSTANT UUID := 'a2222222-2222-2222-2222-222222222222';
  c_posting  CONSTANT UUID := 'a5e5d001-0000-4000-8000-000000000001';  -- lô 1 (ký gửi)
  c_listing  CONSTANT UUID := 'fe4aea48-ac76-4138-9cab-1c2baebb87f3';  -- lô 2 (tin đăng)
  c_bidder1  CONSTANT UUID := '957b8823-9a29-424d-a0fb-6f859590e236';
  c_bidder2  CONSTANT UUID := '0d4ff00a-ac13-4652-90cc-94f7760bc936';

  -- Giá trên LƯỚI bước giá: (giá trúng − giá khởi điểm) chia hết cho bước giá.
  c_start1   CONSTANT NUMERIC := 12500000000; c_step1 CONSTANT NUMERIC := 100000000;
  c_start2   CONSTANT NUMERIC := 33400000000; c_step2 CONSTANT NUMERIC := 200000000;
  c_win1     CONSTANT NUMERIC := 12700000000; c_dep1  CONSTANT NUMERIC := 1250000000;
  c_win2     CONSTANT NUMERIC := 33800000000; c_dep2  CONSTANT NUMERIC := 3340000000;

  v_owner    UUID;
  v_now      TIMESTAMPTZ := date_trunc('minute', now());
  v_closed   TIMESTAMPTZ;
  v_deposit  NUMERIC;
BEGIN
  v_closed := v_now - interval '1 day';

  -- ── Tiền kiểm ────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = c_session) THEN
    RAISE NOTICE 'Phiên demo sau đấu giá đã có — bỏ qua.'; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE code = 'PDG000014') THEN
    RAISE EXCEPTION 'Mã PDG000014 đã bị phiên khác dùng — sửa seed trước khi chạy.';
  END IF;

  SELECT o.owner_id INTO v_owner FROM public.organizations o
   WHERE o.id = c_org AND o.kyc_status = 'APPROVED';
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Không tìm thấy tổ chức Bảo Tín đã duyệt KYC — bỏ qua seed.'; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id IN (c_bidder1, c_bidder2)
                  GROUP BY 1 HAVING count(*) >= 0) OR
     (SELECT count(*) FROM auth.users WHERE id IN (c_bidder1, c_bidder2)) < 2 THEN
    RAISE NOTICE 'Thiếu tài khoản người trả giá demo — bỏ qua seed.'; RETURN;
  END IF;

  -- Lô 1 chỉ vào phiên được khi hợp đồng ký gửi đã KÝ (cổng 20260912000005).
  IF NOT EXISTS (SELECT 1 FROM public.consignment_contracts c
                  WHERE c.asset_posting_id = c_posting AND c.status = 'signed'
                    AND c.auction_org_id = c_aorg) THEN
    RAISE NOTICE 'Hồ sơ ký gửi demo chưa có hợp đồng đã ký — bỏ qua seed.'; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_session_items WHERE asset_posting_id = c_posting) THEN
    RAISE NOTICE 'Hồ sơ ký gửi demo đã nằm trong phiên khác — bỏ qua seed.'; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.listings l
                  WHERE l.id = c_listing AND l.status = 'ACTIVE'
                    AND l.auction_org_id = c_aorg AND l.asset_owner_id IS NOT NULL) THEN
    RAISE NOTICE 'Tin đăng nguồn của lô 2 không còn hợp lệ (cần ACTIVE + có chủ tài sản) — bỏ qua seed.';
    RETURN;
  END IF;

  -- ── 1. Phiên (mã cố định ⇒ tắt trigger cấp mã) ───────────────────────────
  ALTER TABLE public.auction_sessions DISABLE TRIGGER auction_sessions_fill;
  INSERT INTO public.auction_sessions (
    id, organization_id, auction_org_id, code, title, description,
    auction_format, bidding_method, extension_seconds, max_bid_steps,
    venue, province, registration_start_at, registration_end_at,
    starts_at, ends_at, dossier_fee, status, created_by, created_at, updated_at)
  VALUES (
    c_session, c_org, c_aorg, 'PDG000014',
    'PDG000014 [DEMO] — Phiên đã chốt kết quả (demo hợp đồng mua bán)',
    'Bộ dữ liệu mẫu cho giai đoạn sau đấu giá: lập hợp đồng mua bán, theo dõi thanh toán và bàn giao tài sản.',
    'truc_tuyen', 'ascending', 300, 10,
    'Trực tuyến trên sàn', 'Quảng Nam',
    v_now - interval '20 days', v_now - interval '5 days',
    v_now + interval '1 day', v_now + interval '2 days',
    500000, 'draft', v_owner, v_now - interval '20 days', v_now);
  ALTER TABLE public.auction_sessions ENABLE TRIGGER auction_sessions_fill;
  PERFORM setval('public.auction_session_code_seq',
                 GREATEST((SELECT last_value FROM public.auction_session_code_seq), 14));

  -- ── 2. Hai lô, đi qua trigger THẬT (kiểm hợp đồng ký gửi, cấp lot_no) ────
  INSERT INTO public.auction_session_items (
    id, session_id, source, asset_posting_id, title, category_slug, province, district,
    starting_price, deposit_amount, bid_step, max_registrants)
  VALUES (c_lot1, c_session, 'posting', c_posting,
          'Nhà phố 4 tầng hẻm xe hơi, Quận 5 (demo ký gửi)', 'nha-o', 'TP. Hồ Chí Minh', 'Quận 5',
          c_start1, c_dep1, c_step1, 50);

  INSERT INTO public.auction_session_items (
    id, session_id, source, listing_id, title, category_slug, province, district,
    starting_price, deposit_amount, bid_step, max_registrants)
  VALUES (c_lot2, c_session, 'listing', c_listing,
          'Nhà mặt ngõ 421.3m² tại Trung tâm, Quảng Nam (demo tin đăng)', 'nha-o', 'Quảng Nam', NULL,
          c_start2, c_dep2, c_step2, 50);

  -- ── 3. Công bố qua CỔNG THẬT rồi mới lùi giờ về quá khứ ──────────────────
  UPDATE public.auction_sessions SET status = 'published' WHERE id = c_session;

  PERFORM set_config('app.bidding_rpc', 'on', true);   -- mở guard cấu hình phiên
  ALTER TABLE public.auction_sessions DISABLE TRIGGER auction_sessions_guard;
  UPDATE public.auction_sessions
     SET starts_at = v_now - interval '3 days', ends_at = v_closed,
         published_at = v_now - interval '18 days'
   WHERE id = c_session;
  ALTER TABLE public.auction_sessions ENABLE TRIGGER auction_sessions_guard;

  -- ── 4. Hai hồ sơ tham gia đã mua, đã nộp cọc ─────────────────────────────
  -- Cọc nộp theo PHIÊN (một lần cho mọi lô) — đúng cách engine tính.
  v_deposit := c_dep1 + c_dep2;

  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id,
    full_name, id_type, id_number, date_of_birth, gender, phone, email, address,
    fee_amount, status, paid_at, payment_txn_ref,
    deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    bidder_no, bidder_no_assigned_at, created_at, updated_at)
  VALUES
    (c_ct1, 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'),
     c_session, c_org, c_bidder1,
     'Nguyễn Văn Mua', 'cccd', '079201004567', '1985-04-12', 'male', '0912345679',
     'nguyenvanmua@example.com', '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
     500000, 'paid', v_now - interval '8 days', 'DEMO-PDG14-TXN-1',
     'received', v_deposit, v_now - interval '7 days', v_now - interval '7 days',
     1, v_now - interval '7 days', v_now - interval '9 days', v_now),
    (c_ct2, 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'),
     c_session, c_org, c_bidder2,
     'Trần Thị Bích', 'cccd', '079188002345', '1988-09-30', 'female', '0912345678',
     'tranthibich@example.com', '45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
     500000, 'paid', v_now - interval '8 days', 'DEMO-PDG14-TXN-2',
     'received', v_deposit, v_now - interval '7 days', v_now - interval '7 days',
     2, v_now - interval '7 days', v_now - interval '9 days', v_now);

  -- ── 5. Mỗi lô một lượt trả giá thắng ─────────────────────────────────────
  INSERT INTO public.auction_bids (
    id, lot_id, session_id, contract_id, bidder_no, seq, amount, placed_at, client_nonce)
  VALUES
    (c_bid1, c_lot1, c_session, c_ct1, 1, 1, c_win1, v_closed - interval '25 minutes', 'DEMOPDG14L1B1'),
    (c_bid2, c_lot2, c_session, c_ct2, 2, 1, c_win2, v_closed - interval '18 minutes', 'DEMOPDG14L2B2');

  -- ── 6. Trạng thái lô: đóng, đã bán, chờ thanh toán ───────────────────────
  -- Chèn thẳng với hình dạng hợp lệ của các CHECK `als_*`; KHÔNG để lô nào
  -- `open` với ends_at quá khứ, cron close_due_lots (10 giây/lần) sẽ ghi đè.
  INSERT INTO public.auction_lot_states (
    lot_id, session_id, status, opened_at, closed_at, ends_at,
    current_price, current_bid_id, leading_bidder_no, bid_count, extension_count,
    result, winner_contract_id, winning_amount, payment_due_at, payment_status)
  VALUES
    (c_lot1, c_session, 'closed', v_closed - interval '40 minutes', v_closed, v_closed,
     c_win1, c_bid1, 1, 1, 0, 'sold', c_ct1, c_win1, v_closed + interval '30 days', 'pending'),
    (c_lot2, c_session, 'closed', v_closed - interval '35 minutes', v_closed, v_closed,
     c_win2, c_bid2, 2, 1, 0, 'sold', c_ct2, c_win2, v_closed + interval '30 days', 'pending');

  -- ── 7. Nhật ký lô cho giống thật ─────────────────────────────────────────
  INSERT INTO public.auction_lot_events (session_id, lot_id, kind, actor_id, payload, at) VALUES
    (c_session, c_lot1, 'open',  v_owner, jsonb_build_object('ends_at', v_closed), v_closed - interval '40 minutes'),
    (c_session, c_lot1, 'bid',   c_bidder1, jsonb_build_object('amount', c_win1, 'bidder_no', 1, 'seq', 1), v_closed - interval '25 minutes'),
    (c_session, c_lot1, 'close', NULL, jsonb_build_object('result', 'sold', 'winning_amount', c_win1), v_closed),
    (c_session, c_lot2, 'open',  v_owner, jsonb_build_object('ends_at', v_closed), v_closed - interval '35 minutes'),
    (c_session, c_lot2, 'bid',   c_bidder2, jsonb_build_object('amount', c_win2, 'bidder_no', 2, 'seq', 1), v_closed - interval '18 minutes'),
    (c_session, c_lot2, 'close', NULL, jsonb_build_object('result', 'sold', 'winning_amount', c_win2), v_closed);

  -- ── 8. Chốt phiên: cọc của CẢ HAI người trúng chuyển thành tiền mua ──────
  PERFORM set_config('app.deposit_reason',
    'Trúng đấu giá — tiền đặt trước chuyển thành tiền mua tài sản', true);

  PERFORM set_config('app.deposit_lot_id', c_lot1::text, true);
  UPDATE public.auction_bidding_contracts
     SET deposit_status = 'applied', deposit_status_changed_at = v_closed + interval '5 minutes'
   WHERE id = c_ct1;

  PERFORM set_config('app.deposit_lot_id', c_lot2::text, true);
  UPDATE public.auction_bidding_contracts
     SET deposit_status = 'applied', deposit_status_changed_at = v_closed + interval '5 minutes'
   WHERE id = c_ct2;

  INSERT INTO public.auction_lot_events (session_id, lot_id, kind, actor_id, payload, at)
  VALUES (c_session, NULL, 'finalize', v_owner,
          jsonb_build_object('applied', 2, 'pending_refund', 0, 'sold', 2, 'unsold', 0, 'withdrawn', 0),
          v_closed + interval '5 minutes');

  UPDATE public.auction_sessions
     SET finalized_at = v_closed + interval '5 minutes', finalized_by = v_owner
   WHERE id = c_session;

  PERFORM set_config('app.bidding_rpc', '', true);
  PERFORM set_config('app.deposit_reason', '', true);
  PERFORM set_config('app.deposit_lot_id', '', true);

  -- ── 9. Kiểm chứng ────────────────────────────────────────────────────────
  IF (SELECT count(*) FROM public.auction_session_items WHERE session_id = c_session) <> 2 THEN
    RAISE EXCEPTION 'Phiên demo phải có đúng 2 lô.';
  END IF;
  IF (SELECT count(*) FROM public.auction_lot_states
       WHERE session_id = c_session AND result = 'sold' AND payment_status = 'pending') <> 2 THEN
    RAISE EXCEPTION 'Cả 2 lô phải ở trạng thái đã bán / chờ thanh toán.';
  END IF;
  IF (SELECT finalized_at FROM public.auction_sessions WHERE id = c_session) IS NULL THEN
    RAISE EXCEPTION 'Phiên demo chưa được đánh dấu đã chốt kết quả.';
  END IF;
  IF (SELECT count(*) FROM public.auction_bidding_contracts
       WHERE session_id = c_session AND deposit_status = 'applied') <> 2 THEN
    RAISE EXCEPTION 'Cọc của hai người trúng phải ở trạng thái đã chuyển thành tiền mua.';
  END IF;
  IF (SELECT count(*) FROM public.auction_deposit_events
       WHERE session_id = c_session AND kind = 'applied') <> 2 THEN
    RAISE EXCEPTION 'Sổ tiền đặt trước thiếu bút toán "applied".';
  END IF;

  -- Điểm mấu chốt của bộ demo: CẢ HAI chuỗi bên bán đều giải được.
  IF public.sale_seller_snapshot(c_lot1) ->> 'seller_kind' IS DISTINCT FROM 'owner_user' THEN
    RAISE EXCEPTION 'Lô 1 phải giải ra bên bán là chủ tài sản có tài khoản.';
  END IF;
  IF public.sale_seller_snapshot(c_lot2) ->> 'seller_kind' IS DISTINCT FROM 'org_on_behalf' THEN
    RAISE EXCEPTION 'Lô 2 phải giải ra bên bán là tổ chức ký thay.';
  END IF;
  IF (SELECT count(*) FROM public.auction_sale_contracts WHERE session_id = c_session) <> 0 THEN
    RAISE EXCEPTION 'Bộ demo KHÔNG seed sẵn hợp đồng mua bán.';
  END IF;

  RAISE NOTICE 'OK: PDG000014 [DEMO] đã chốt kết quả — 2 lô bán được, 2 chuỗi bên bán sẵn sàng.';
END $seed$;

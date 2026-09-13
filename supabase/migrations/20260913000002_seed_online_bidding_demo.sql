-- Dữ liệu demo ĐẤU GIÁ TRỰC TUYẾN (Bước 2 của docs/online-auction-plan.md).
--
-- Phiên PDG000013 [DEMO] của Bảo Tín, hình thức cả hai (trực tiếp + trực tuyến),
-- phương thức trả giá lên, ĐANG DIỄN RA (starts_at = lúc áp − 1 giờ, kết thúc
-- 31/12/2026). 2 lô từ tin ACTIVE của Bảo Tín chưa nằm trong phiên nào; 2 người mua
-- demo 09123456789 (số báo danh 1) / 09123456788 (số 2) đã trả hồ sơ + đã nộp tiền
-- đặt trước ⇒ trả giá được ngay sau khi tổ chức mở lô. Lô ở trạng thái chờ (không
-- có dòng auction_lot_states). Không sinh doanh thu: hồ sơ không gắn orders.
--
-- Công bố đi qua CỔNG THẬT của auction_sessions_guard (có lô, KYC, xung đột tài
-- sản) với giờ bắt đầu tạm ở tương lai, rồi mới lùi giờ bắt đầu về quá khứ.
--
-- Mọi dòng mới có id tiền tố f10d0009. GỠ / ĐẶT LẠI (chạy tay, một transaction —
-- sổ trả giá, nhật ký, sổ tiền đặt trước, biên bản là chỉ-ghi-thêm nên phải tắt
-- trigger; thứ tự theo FK RESTRICT):
--   BEGIN;
--   ALTER TABLE public.auction_bids            DISABLE TRIGGER auction_bids_guard;
--   ALTER TABLE public.auction_lot_events      DISABLE TRIGGER auction_lot_events_append_only;
--   ALTER TABLE public.auction_deposit_events  DISABLE TRIGGER auction_deposit_events_append_only;
--   ALTER TABLE public.auction_session_minutes DISABLE TRIGGER auction_session_minutes_append_only;
--   DELETE FROM public.auction_session_minutes   WHERE session_id = 'f10d0009-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_lot_states        WHERE session_id = 'f10d0009-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_bids              WHERE session_id = 'f10d0009-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_lot_events        WHERE session_id = 'f10d0009-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_deposit_events    WHERE session_id = 'f10d0009-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_bidding_contracts WHERE session_id = 'f10d0009-0000-4000-8000-000000000001';
--   DELETE FROM public.auction_sessions          WHERE id = 'f10d0009-0000-4000-8000-000000000001';
--   ALTER TABLE public.auction_bids            ENABLE TRIGGER auction_bids_guard;
--   ALTER TABLE public.auction_lot_events      ENABLE TRIGGER auction_lot_events_append_only;
--   ALTER TABLE public.auction_deposit_events  ENABLE TRIGGER auction_deposit_events_append_only;
--   ALTER TABLE public.auction_session_minutes ENABLE TRIGGER auction_session_minutes_append_only;
--   COMMIT;
--   Biên bản PDF (Bước 6) nằm ở auction-minutes/c9d00002-0000-4000-8000-000000000001/f10d0009-0000-4000-8000-000000000001/
--   — xoá qua Storage API. Đặt lại = gỡ rồi chạy lại file này bằng psql -f.

DO $seed$
DECLARE
  c_session CONSTANT UUID := 'f10d0009-0000-4000-8000-000000000001';
  c_org     CONSTANT UUID := 'c9d00002-0000-4000-8000-000000000001';
  c_aorg    CONSTANT UUID := 'a2222222-2222-2222-2222-222222222222';
  c_owner   CONSTANT UUID := '95d7e29c-f1f5-4361-a3af-e9aeaf792f3f';
  c_bidder1 CONSTANT UUID := '957b8823-9a29-424d-a0fb-6f859590e236';
  c_bidder2 CONSTANT UUID := '0d4ff00a-ac13-4652-90cc-94f7760bc936';
  c_lot1    CONSTANT UUID := 'f10d0009-0000-4000-8000-000000000011';
  c_lot2    CONSTANT UUID := 'f10d0009-0000-4000-8000-000000000012';
  c_listing1 CONSTANT UUID := 'a4c9b5c3-ce4d-4135-89b4-83b3f274c583';
  c_listing2 CONSTANT UUID := '9cd80e46-ee77-4717-9b00-621889fbae82';
  v_now     TIMESTAMPTZ := date_trunc('minute', now());
  v_deposit NUMERIC;
  v_bad     TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE id = c_session) THEN
    RAISE NOTICE 'Phiên demo PDG000013 đã có — bỏ qua.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = c_org AND kyc_status = 'APPROVED' AND auction_org_id = c_aorg) THEN
    RAISE NOTICE 'Không có tổ chức Bảo Tín đã duyệt — bỏ qua seed.';
    RETURN;
  END IF;
  IF (SELECT count(*) FROM auth.users WHERE id IN (c_owner, c_bidder1, c_bidder2)) <> 3 THEN
    RAISE NOTICE 'Thiếu tài khoản chủ tổ chức hoặc người mua demo — bỏ qua seed.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sessions WHERE code = 'PDG000013') THEN
    RAISE EXCEPTION 'Mã phiên PDG000013 đã bị phiên khác dùng — sửa seed trước khi áp.';
  END IF;
  SELECT string_agg(x::text, ', ') INTO v_bad
    FROM unnest(ARRAY[c_listing1, c_listing2]) AS x
   WHERE NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.id = x AND l.status = 'ACTIVE' AND l.auction_org_id = c_aorg);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tin nguồn không còn ACTIVE ở Bảo Tín: %', v_bad;
  END IF;

  -- ── 1. Phiên nháp, mã cố định (tắt trigger cấp mã, tự điền đúng những gì trigger điền) ──
  ALTER TABLE public.auction_sessions DISABLE TRIGGER auction_sessions_fill;
  INSERT INTO public.auction_sessions (
    id, organization_id, auction_org_id, code, title, description, auction_format, venue, province,
    registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at,
    max_registrants, dossier_fee, bidding_method, extension_seconds, max_bid_steps,
    status, created_by, created_at, updated_at
  ) VALUES (
    c_session, c_org, c_aorg, 'PDG000013',
    '[DEMO] Đấu giá trực tuyến: đất thổ cư Đồng Nai và nhà phố Đống Đa',
    'Phiên DỮ LIỆU MẪU phục vụ trình diễn đấu giá trực tuyến (phòng trả giá, điều hành, chốt kết quả). Không phải phiên đấu giá thật.',
    'ca_hai',
    'Trực tuyến trên Tài Sản Đấu Giá và tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    'TP. Hồ Chí Minh',
    v_now - interval '10 days', v_now - interval '2 hours', v_now - interval '7 days', v_now - interval '3 days',
    v_now + interval '1 day', '2026-12-31T10:00:00+00:00'::timestamptz,
    50, 500000, 'ascending', 300, 10,
    'draft', c_owner, v_now - interval '11 days', v_now - interval '11 days'
  );
  ALTER TABLE public.auction_sessions ENABLE TRIGGER auction_sessions_fill;
  PERFORM setval('public.auction_session_code_seq', GREATEST((SELECT last_value FROM public.auction_session_code_seq), 13));

  -- ── 2. Lô (snapshot như listingToItemDraft; giá làm tròn theo lưới bước giá) ──
  INSERT INTO public.auction_session_items (id, session_id, source, listing_id, title, category_slug, province, district, image_url, starting_price, deposit_amount, bid_step, created_at, updated_at)
  SELECT c_lot1, c_session, 'listing', l.id, l.title, l.property_type_slug, l.address->>'province', l.address->>'district', l.image_url,
         6400000000, 640000000, 50000000, v_now - interval '11 days', v_now - interval '11 days'
    FROM public.listings l WHERE l.id = c_listing1;
  INSERT INTO public.auction_session_items (id, session_id, source, listing_id, title, category_slug, province, district, image_url, starting_price, deposit_amount, bid_step, created_at, updated_at)
  SELECT c_lot2, c_session, 'listing', l.id, l.title, l.property_type_slug, l.address->>'province', l.address->>'district', l.image_url,
         28450000000, 2845000000, 200000000, v_now - interval '11 days', v_now - interval '11 days'
    FROM public.listings l WHERE l.id = c_listing2;

  -- ── 3. Công bố qua cổng thật, lùi giờ bắt đầu (guard cho đổi khi chưa trả giá), lùi published_at ──
  UPDATE public.auction_sessions SET status = 'published' WHERE id = c_session;
  UPDATE public.auction_sessions SET starts_at = v_now - interval '1 hour' WHERE id = c_session;
  ALTER TABLE public.auction_sessions DISABLE TRIGGER auction_sessions_guard;
  UPDATE public.auction_sessions SET published_at = v_now - interval '10 days' WHERE id = c_session;
  ALTER TABLE public.auction_sessions ENABLE TRIGGER auction_sessions_guard;

  -- ── 4. Hồ sơ tham gia: đã trả, đã nhận tiền đặt trước (tính theo PHIÊN ⇒ phủ cả 2 lô) ──
  SELECT sum(deposit_amount) INTO v_deposit FROM public.auction_session_items WHERE session_id = c_session;

  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    deposit_note, deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    'f10d0009-0000-4000-8000-000000000021', 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), c_session, c_org, c_bidder1,
    'Phạm Quốc Bảo', 'cccd', '079088001234', DATE '1988-04-12', 'male', '0912345678', 'quocbao.demo@example.com', '27 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'vneid',
    500000, 'paid', v_now - interval '5 days', 'DEMO-VNP-PDG13-0001', 'received', v_deposit, v_now - interval '2 days', v_now - interval '2 days',
    'Chuyển khoản tiền đặt trước (dữ liệu mẫu)', c_owner, 1, v_now - interval '2 days' + interval '1 minute', v_now - interval '5 days', v_now - interval '2 days'
  );
  INSERT INTO public.auction_bidding_contracts (
    id, code, session_id, organization_id, user_id, full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
    fee_amount, status, paid_at, payment_txn_ref, deposit_status, deposit_amount_received, deposit_received_at, deposit_status_changed_at,
    deposit_note, deposit_updated_by, bidder_no, bidder_no_assigned_at, created_at, updated_at
  ) VALUES (
    'f10d0009-0000-4000-8000-000000000022', 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), c_session, c_org, c_bidder2,
    'Lê Thị Thu Trang', 'cccd', '001190004567', DATE '1990-11-03', 'female', '0987123456', 'thutrang.demo@example.com', '118 Trần Não, Phường An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh', 'manual',
    500000, 'paid', v_now - interval '4 days', 'DEMO-VNP-PDG13-0002', 'received', v_deposit, v_now - interval '2 days' + interval '30 minutes', v_now - interval '2 days' + interval '30 minutes',
    'Chuyển khoản tiền đặt trước (dữ liệu mẫu)', c_owner, 2, v_now - interval '2 days' + interval '31 minutes', v_now - interval '4 days', v_now - interval '2 days' + interval '30 minutes'
  );

  -- ── 5. Kiểm chứng ──
  IF NOT EXISTS (SELECT 1 FROM public.auction_sessions
                  WHERE id = c_session AND status = 'published' AND auction_format = 'ca_hai'
                    AND starts_at < now() AND now() < ends_at AND finalized_at IS NULL) THEN
    RAISE EXCEPTION 'Seed PDG000013: phiên không ở trạng thái đang diễn ra.';
  END IF;
  IF (SELECT count(*) FROM public.auction_session_items WHERE session_id = c_session) <> 2 THEN
    RAISE EXCEPTION 'Seed PDG000013: phải có đúng 2 lô.';
  END IF;
  IF (SELECT count(*) FROM public.auction_bidding_contracts
       WHERE session_id = c_session AND status = 'paid' AND deposit_status = 'received' AND bidder_no IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Seed PDG000013: phải có đúng 2 hồ sơ đủ điều kiện trả giá.';
  END IF;
  IF (SELECT count(*) FROM public.auction_deposit_events WHERE session_id = c_session AND kind = 'received') <> 2 THEN
    RAISE EXCEPTION 'Seed PDG000013: sổ tiền đặt trước phải có 2 dòng received.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_lot_states WHERE session_id = c_session)
     OR EXISTS (SELECT 1 FROM public.auction_bids WHERE session_id = c_session) THEN
    RAISE EXCEPTION 'Seed PDG000013: phiên mới không được có trạng thái lô / lượt trả giá.';
  END IF;
  IF (public.auction_session_contract_summary(c_session)->>'paid_count')::int <> 2 THEN
    RAISE EXCEPTION 'Seed PDG000013: auction_session_contract_summary lệch.';
  END IF;

  RAISE NOTICE 'OK: phiên demo PDG000013 đang diễn ra, 2 lô, 2 người trả giá đủ điều kiện';
END $seed$;

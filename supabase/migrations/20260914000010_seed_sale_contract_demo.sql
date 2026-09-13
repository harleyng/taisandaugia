-- Bộ demo HỢP ĐỒNG MUA BÁN trên phiên PDG000014 [DEMO] — dựng sẵn hai hợp đồng
-- ở HAI giai đoạn khác nhau cho tài khoản secsosoo@gmail.com.
--
-- 20260914000002 cố ý dừng ở "phiên đã chốt, chưa có hợp đồng nào". Seed này đi
-- tiếp một quãng để có dữ liệu xem ngay, nhưng vẫn chừa thao tác cho người demo:
--
--   Lô 1 (ký gửi, bên bán = CHỦ TÀI SẢN secsosoo)  → đã ký + đã thu 5 tỷ
--        /chu-tai-san/hop-dong-mua-ban — còn nợ 3,110,000,000₫, chưa bàn giao.
--   Lô 2 (tin đăng, tổ chức ký thay)               → chờ ký, secsosoo là BÊN MUA
--        /hop-dong-mua-ban/:id — việc tiếp theo là tải bản scan đã ký.
--
-- Một tài khoản đóng cả hai vai là CỐ Ý: lô 2 bên bán là tổ chức nên không đụng
-- vai chủ tài sản của lô 1. Bù lại, hồ sơ tham gia số 2 của phiên bị đổi chủ từ
-- người trả giá demo sang secsosoo (mục 2) — `deposit_status` và `bidder_no`
-- KHÔNG đụng tới, nếu không `auction_bidding_contracts_bidding_lock` chặn ngay.
--
-- TỆP PHẢI CÓ TRƯỚC. `sale_contract_file_check` từ chối mọi path không có object
-- thật trong bucket, nên chạy script sinh tệp TRƯỚC khi áp migration này:
--
--   python3 scripts/seed-sale-contract-assets.py --out /tmp/hdmb
--   npx supabase storage cp /tmp/hdmb/auction-sale-contracts/<org>/<hđ>/<tệp> \
--       ss:///auction-sale-contracts/<org>/<hđ>/<tệp> --experimental
--
-- Thiếu tệp thì seed BỎ QUA (NOTICE) chứ không nổ — để `db push` trên DB trắng
-- vẫn chạy trọn. Chạy lại sau khi có tệp là đủ. Tệp tải nhầm path thì phải dọn
-- qua Storage API: Postgres CẤM `DELETE FROM storage.objects`, kể cả trong
-- migration ("Direct deletion from storage tables is not allowed").
--
-- ID hợp đồng cố định (f10d000f-…0011 / …0012) vì path tệp mang id hợp đồng —
-- tệp phải tải lên TRƯỚC khi dòng hợp đồng tồn tại. Cách pin: đổi DEFAULT của
-- cột `id` quanh đúng lời gọi RPC, engine vẫn chạy nguyên vẹn.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- GỠ BỘ DEMO (chạy tay, một giao dịch):
--
--   BEGIN;
--   ALTER TABLE public.auction_sale_payments        DISABLE TRIGGER auction_sale_payments_append_only;
--   ALTER TABLE public.auction_sale_contract_events DISABLE TRIGGER auction_sale_contract_events_append_only;
--   DELETE FROM public.auction_sale_contract_events WHERE contract_id IN
--     ('f10d000f-0000-4000-8000-000000000011','f10d000f-0000-4000-8000-000000000012');
--   DELETE FROM public.auction_sale_payments        WHERE contract_id IN (…hai id trên…);
--   DELETE FROM public.auction_sale_installments    WHERE contract_id IN (…hai id trên…);
--   DELETE FROM public.auction_sale_contracts       WHERE id          IN (…hai id trên…);
--   ALTER TABLE public.auction_sale_contract_events ENABLE TRIGGER auction_sale_contract_events_append_only;
--   ALTER TABLE public.auction_sale_payments        ENABLE TRIGGER auction_sale_payments_append_only;
--   COMMIT;
--
-- Tệp trong `auction-sale-contracts/c9d00002-…/f10d000f-…/` xoá qua Storage API.
-- Hồ sơ tham gia số 2 KHÔNG tự trả về người cũ — sửa tay nếu cần.
-- ─────────────────────────────────────────────────────────────────────────────

DO $seed$
DECLARE
  c_session  CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000001';
  c_lot1     CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000011';
  c_lot2     CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000012';
  c_ct1      CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000021';  -- hồ sơ trúng lô 1
  c_ct2      CONSTANT UUID := 'f10d000e-0000-4000-8000-000000000022';  -- hồ sơ trúng lô 2
  c_org      CONSTANT UUID := 'c9d00002-0000-4000-8000-000000000001';  -- Bảo Tín
  c_bidder1  CONSTANT UUID := '957b8823-9a29-424d-a0fb-6f859590e236';  -- bên mua lô 1
  c_c1       CONSTANT UUID := 'f10d000f-0000-4000-8000-000000000011';
  c_c2       CONSTANT UUID := 'f10d000f-0000-4000-8000-000000000012';
  c_email    CONSTANT TEXT := 'secsosoo@gmail.com';

  c_draft1   CONSTANT TEXT := 'c9d00002-0000-4000-8000-000000000001/f10d000f-0000-4000-8000-000000000011/draft-1789095600000-du-thao-hop-dong-mua-ban.pdf';
  c_signed1  CONSTANT TEXT := 'c9d00002-0000-4000-8000-000000000001/f10d000f-0000-4000-8000-000000000011/signed-1789182000000-ban-scan-hop-dong-da-ky.pdf';
  c_receipt1 CONSTANT TEXT := 'c9d00002-0000-4000-8000-000000000001/f10d000f-0000-4000-8000-000000000011/receipt-1789268400000-uy-nhiem-chi-5-ty.pdf';
  c_draft2   CONSTANT TEXT := 'c9d00002-0000-4000-8000-000000000001/f10d000f-0000-4000-8000-000000000012/draft-1789095600000-du-thao-hop-dong-mua-ban.pdf';

  v_owner   UUID;      -- chủ tổ chức Bảo Tín (người lập hợp đồng)
  v_sec     UUID;      -- secsosoo@gmail.com
  v_prof    RECORD;
  v_res     JSONB;
  v_today   DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_now     TIMESTAMPTZ := date_trunc('minute', now());
  v_bal     NUMERIC;
BEGIN
  -- ── Tiền kiểm ────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.auction_sessions
                  WHERE id = c_session AND finalized_at IS NOT NULL) THEN
    RAISE NOTICE 'Chưa có phiên demo PDG000014 đã chốt kết quả — bỏ qua seed hợp đồng mua bán.';
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.auction_lot_states
       WHERE lot_id IN (c_lot1, c_lot2) AND result = 'sold' AND payment_status <> 'defaulted') <> 2 THEN
    RAISE NOTICE 'Hai lô demo không còn ở trạng thái đã bán — bỏ qua seed.';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sale_contracts
              WHERE lot_id IN (c_lot1, c_lot2) AND status <> 'cancelled') THEN
    RAISE NOTICE 'Hai lô demo đã có hợp đồng mua bán — bỏ qua seed.';
    RETURN;
  END IF;

  SELECT o.owner_id INTO v_owner FROM public.organizations o
   WHERE o.id = c_org AND o.kyc_status = 'APPROVED';
  SELECT u.id INTO v_sec FROM auth.users u WHERE lower(u.email) = lower(c_email);
  IF v_owner IS NULL OR v_sec IS NULL THEN
    RAISE NOTICE 'Thiếu chủ tổ chức Bảo Tín hoặc tài khoản % — bỏ qua seed.', c_email;
    RETURN;
  END IF;
  -- Mọi cột `*_by` đều FK sang profiles ⇒ thiếu hồ sơ là nổ giữa chừng.
  IF (SELECT count(*) FROM public.profiles WHERE id IN (v_owner, v_sec, c_bidder1)) < 3 THEN
    RAISE NOTICE 'Thiếu dòng profiles của một trong ba vai (tổ chức / bên bán / bên mua) — bỏ qua seed.';
    RETURN;
  END IF;
  -- Bên bán lô 1 phải giải đúng ra secsosoo, không thì bộ demo mất ý nghĩa.
  IF (public.sale_seller_snapshot(c_lot1) ->> 'seller_user_id')::uuid IS DISTINCT FROM v_sec THEN
    RAISE NOTICE 'Bên bán lô 1 không phải % — bỏ qua seed.', c_email;
    RETURN;
  END IF;

  IF (SELECT count(*) FROM storage.objects
       WHERE bucket_id = 'auction-sale-contracts'
         AND name IN (c_draft1, c_signed1, c_receipt1, c_draft2)) < 4 THEN
    RAISE NOTICE 'Chưa có đủ 4 tệp PDF trong bucket auction-sale-contracts — chạy scripts/seed-sale-contract-assets.py rồi áp lại migration này.';
    RETURN;
  END IF;

  -- ── 1. Lô 2 đổi người trúng sang secsosoo để tài khoản này có vai BÊN MUA ─
  -- KHÔNG đụng deposit_status / bidder_no (bidding_lock chặn sau khi chốt phiên).
  IF NOT EXISTS (SELECT 1 FROM public.auction_bidding_contracts
                  WHERE session_id = c_session AND user_id = v_sec) THEN
    SELECT p.name,
           p.agent_info -> 'basic' ->> 'phone'      AS phone,
           p.agent_info -> 'basic' ->> 'gender'     AS gender,
           p.agent_info -> 'basic' ->> 'birth_date' AS birth_date,
           p.agent_info -> 'basic' ->> 'province'   AS province
      INTO v_prof FROM public.profiles p WHERE p.id = v_sec;

    UPDATE public.auction_bidding_contracts
       SET user_id       = v_sec,
           full_name     = COALESCE(NULLIF(btrim(v_prof.name), ''), full_name),
           phone         = COALESCE(NULLIF(btrim(v_prof.phone), ''), phone),
           email         = c_email,
           gender        = COALESCE(NULLIF(v_prof.gender, ''), gender),
           date_of_birth = COALESCE(NULLIF(v_prof.birth_date, '')::date, date_of_birth),
           address       = COALESCE(NULLIF(btrim(v_prof.province), ''), address)
     WHERE id = c_ct2;
  END IF;

  -- ── 2. Hợp đồng lô 1 — tổ chức lập, id cố định ───────────────────────────
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  ALTER TABLE public.auction_sale_contracts ALTER COLUMN id SET DEFAULT 'f10d000f-0000-4000-8000-000000000011'::uuid;
  v_res := public.org_create_sale_contract(c_lot1, 'org', false, v_now + interval '7 days');
  ALTER TABLE public.auction_sale_contracts ALTER COLUMN id SET DEFAULT gen_random_uuid();
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Lập hợp đồng lô 1 thất bại: %', v_res;
  END IF;

  v_res := public.sale_contract_set_terms(
    c_c1, NULL, v_now + interval '14 days', NULL,
    'Công ty Đấu giá Hợp danh Bảo Tín — 0071000123456 — Vietcombank CN Đà Nẵng',
    true, '01/2026/HĐMB-BT', NULL, NULL);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Đặt điều khoản hợp đồng lô 1 thất bại: %', v_res;
  END IF;

  v_res := public.sale_contract_share_draft(c_c1, c_draft1, true);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Chia sẻ dự thảo lô 1 thất bại: %', v_res;
  END IF;

  -- Bên bán (chủ tài sản) giữ bản giấy: tải bản scan và tự xác nhận luôn.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_sec, 'role', 'authenticated')::text, true);
  v_res := public.sale_contract_attach_signed(c_c1, 'seller', c_signed1, v_today - 1, NULL, true);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Tải bản đã ký lô 1 thất bại: %', v_res;
  END IF;

  -- Bên mua xác nhận ⇒ đủ chữ ký ⇒ `signed`.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', c_bidder1, 'role', 'authenticated')::text, true);
  v_res := public.sale_contract_confirm(c_c1, 'buyer', c_signed1);
  IF v_res ->> 'status' IS DISTINCT FROM 'signed' THEN
    RAISE EXCEPTION 'Bên mua xác nhận lô 1 không đưa hợp đồng về đã ký: %', v_res;
  END IF;

  -- Tổ chức ghi sổ tiền đợt 1. Cọc 4,590,000,000 đã cấn trừ lúc tạo hợp đồng
  -- nên số dư còn 12,700,000,000 − 4,590,000,000 − 5,000,000,000.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_res := public.org_record_sale_payment(
    c_c1, 5000000000, 'bank_transfer', 'DEMO-HDMB-UNC-001',
    v_now - interval '1 day', c_receipt1, 'Thanh toán đợt 1 theo hợp đồng 01/2026/HĐMB-BT');
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Ghi sổ tiền lô 1 thất bại: %', v_res;
  END IF;

  -- ── 3. Hợp đồng lô 2 — dừng ở "chờ ký" để secsosoo có việc phải làm ──────
  ALTER TABLE public.auction_sale_contracts ALTER COLUMN id SET DEFAULT 'f10d000f-0000-4000-8000-000000000012'::uuid;
  v_res := public.org_create_sale_contract(c_lot2, 'org', false, v_now + interval '10 days');
  ALTER TABLE public.auction_sale_contracts ALTER COLUMN id SET DEFAULT gen_random_uuid();
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Lập hợp đồng lô 2 thất bại: %', v_res;
  END IF;

  v_res := public.sale_contract_share_draft(c_c2, c_draft2, true);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION 'Chia sẻ dự thảo lô 2 thất bại: %', v_res;
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);

  -- ── 4. Kiểm chứng ────────────────────────────────────────────────────────
  IF (SELECT status FROM public.auction_sale_contracts WHERE id = c_c1) <> 'signed' THEN
    RAISE EXCEPTION 'Hợp đồng lô 1 phải ở trạng thái đã ký.';
  END IF;
  IF (SELECT status FROM public.auction_sale_contracts WHERE id = c_c2) <> 'awaiting_signatures' THEN
    RAISE EXCEPTION 'Hợp đồng lô 2 phải ở trạng thái chờ ký.';
  END IF;
  IF (SELECT seller_user_id FROM public.auction_sale_contracts WHERE id = c_c1) IS DISTINCT FROM v_sec THEN
    RAISE EXCEPTION 'Bên bán hợp đồng lô 1 phải là %.', c_email;
  END IF;
  IF (SELECT buyer_user_id FROM public.auction_sale_contracts WHERE id = c_c2) IS DISTINCT FROM v_sec THEN
    RAISE EXCEPTION 'Bên mua hợp đồng lô 2 phải là %.', c_email;
  END IF;
  IF (SELECT seller_kind FROM public.auction_sale_contracts WHERE id = c_c2) <> 'org_on_behalf' THEN
    RAISE EXCEPTION 'Hợp đồng lô 2 phải đi nhánh tổ chức ký thay.';
  END IF;
  v_bal := public.sale_balance(c_c1);
  IF v_bal <> 3110000000 THEN
    RAISE EXCEPTION 'Số dư hợp đồng lô 1 phải là 3,110,000,000 — đang là %.', v_bal;
  END IF;
  -- Chưa trả đủ ⇒ lô vẫn "chờ thanh toán"; đó là điểm demo của sổ tiền.
  IF (SELECT payment_status FROM public.auction_lot_states WHERE lot_id = c_lot1) <> 'pending' THEN
    RAISE EXCEPTION 'Lô 1 chưa trả đủ tiền nên payment_status phải còn "pending".';
  END IF;

  RAISE NOTICE 'OK: % — lô 1 đã ký, còn nợ %, lô 2 chờ ký.',
    (SELECT string_agg(code, ' / ' ORDER BY code) FROM public.auction_sale_contracts WHERE id IN (c_c1, c_c2)),
    to_char(v_bal, 'FM999,999,999,999');
END $seed$;

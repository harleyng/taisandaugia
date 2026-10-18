-- Hồ sơ tham gia phía người mua theo design "San - Ho So Tham Gia" (979d4c55):
--
--   1. auction_contract_lots — tài sản (lô) người mua CHỌN để trả giá. Tiền đặt
--      trước phải nộp = tổng đặt trước của các lô đã chọn. KHÔNG có dòng nào =
--      đăng ký MỌI lô (hồ sơ cũ, và seed ghi thẳng bảng hồ sơ). start_bidding_contract
--      đọc _payload->'lot_ids'; payload không có khoá đó (client cũ, "Tiếp tục thanh
--      toán" dựng lại payload) ⇒ giữ nguyên lựa chọn đã lưu.
--   2. place_bid từ chối lô ngoài danh sách: reason 'lot_not_registered'.
--   3. Người mua tự báo "đã nộp tiền đặt trước" (+ chứng từ trong bucket buyer-kyc)
--      ⇒ tổ chức thấy "Chờ đối soát". Chỉ là lời báo: deposit_status vẫn do tổ chức
--      ghi qua org_set_contract_deposit.
--   4. my_contract_deposit_info — tài khoản nhận đặt trước của tổ chức
--      (org_bank_accounts chỉ thành viên đọc) + số tiền phải nộp + hạn nộp.
--
-- Hạn nộp đặt trước = registration_end_at của phiên (chưa có cột riêng — người
-- dùng chọn 2026-10-18).
--
-- start_bidding_contract / place_bid / can_read_buyer_kyc_object /
-- buyer_kyc_path_referenced là hàm DÙNG CHUNG: vá bằng replace() trên
-- pg_get_functiondef LIVE + assert mốc, để không đè sửa của phiên song song.

-- ─── 1. Lô đã đăng ký của hồ sơ ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_contract_lots (
  contract_id UUID NOT NULL REFERENCES public.auction_bidding_contracts(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES public.auction_session_items(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_id, item_id)
);
CREATE INDEX IF NOT EXISTS auction_contract_lots_item_idx ON public.auction_contract_lots (item_id);

COMMENT ON TABLE public.auction_contract_lots IS
  'Lô người mua đăng ký trả giá. Hồ sơ không có dòng nào = đăng ký mọi lô của phiên. Chỉ ghi qua start_bidding_contract.';

ALTER TABLE public.auction_contract_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acl_select_own ON public.auction_contract_lots;
CREATE POLICY acl_select_own ON public.auction_contract_lots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auction_bidding_contracts c
                  WHERE c.id = contract_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS acl_select_org ON public.auction_contract_lots;
CREATE POLICY acl_select_org ON public.auction_contract_lots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.auction_bidding_contracts c
                  WHERE c.id = contract_id
                    AND c.status IN ('paid', 'refunded')
                    AND (public.can_manage_bidding_contracts(c.organization_id, 'view')
                         OR public.can_manage_bidding_contracts(c.organization_id, 'checkin'))));

DROP POLICY IF EXISTS acl_admin_select ON public.auction_contract_lots;
CREATE POLICY acl_admin_select ON public.auction_contract_lots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

GRANT SELECT ON public.auction_contract_lots TO authenticated;

/** Hồ sơ được trả giá lô này không: không chọn lô nào = mọi lô. */
CREATE OR REPLACE FUNCTION public._contract_lot_ok(_contract_id UUID, _item_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.auction_contract_lots WHERE contract_id = _contract_id)
      OR EXISTS (SELECT 1 FROM public.auction_contract_lots
                  WHERE contract_id = _contract_id AND item_id = _item_id)
$$;

/** Tiền đặt trước phải nộp: tổng deposit_amount của lô đã chọn (hoặc mọi lô). */
CREATE OR REPLACE FUNCTION public._contract_deposit_due(_contract_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(sum(i.deposit_amount), 0)
    FROM public.auction_bidding_contracts c
    JOIN public.auction_session_items i ON i.session_id = c.session_id
   WHERE c.id = _contract_id
     AND public._contract_lot_ok(c.id, i.id)
$$;

/** Thay lựa chọn lô của hồ sơ — gọi từ start_bidding_contract, trong cùng khoá phiên. */
CREATE OR REPLACE FUNCTION public._set_contract_lots(_contract_id UUID, _session_id UUID, _lots JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  IF _lots IS NULL OR jsonb_typeof(_lots) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(_lots) e
                 WHERE jsonb_typeof(e) <> 'string'
                    OR (e #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Danh sách tài sản đăng ký không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT array_agg(DISTINCT (e #>> '{}')::uuid) INTO v_ids FROM jsonb_array_elements(_lots) e;
  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn ít nhất một tài sản để đăng ký.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) u
              WHERE NOT EXISTS (SELECT 1 FROM public.auction_session_items i
                                 WHERE i.id = u AND i.session_id = _session_id)) THEN
    RAISE EXCEPTION 'Tài sản đăng ký không thuộc phiên đấu giá này.' USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.auction_contract_lots WHERE contract_id = _contract_id;
  INSERT INTO public.auction_contract_lots (contract_id, item_id)
  SELECT _contract_id, u FROM unnest(v_ids) u;
END; $$;

REVOKE ALL ON FUNCTION public._contract_lot_ok(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._contract_deposit_due(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._set_contract_lots(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- start_bidding_contract: lưu lựa chọn lô ngay trước khi trả kết quả.
DO $patch$
DECLARE
  v_def    TEXT := pg_get_functiondef('public.start_bidding_contract(uuid, jsonb)'::regprocedure);
  v_anchor TEXT := E'  RETURN jsonb_build_object(\n    ''contract_id'',     v_id,';
BEGIN
  IF position('_set_contract_lots' IN v_def) > 0 THEN
    RAISE NOTICE 'start_bidding_contract đã có _set_contract_lots — bỏ qua';
    RETURN;
  END IF;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'start_bidding_contract: không thấy mốc RETURN — bản LIVE đã đổi, vá tay';
  END IF;
  v_def := replace(v_def, v_anchor,
    E'  -- Lô đăng ký (20261018160000). Thiếu khoá lot_ids ⇒ giữ lựa chọn đã lưu.\n'
    || E'  IF _payload ? ''lot_ids'' THEN\n'
    || E'    PERFORM public._set_contract_lots(v_id, _session_id, _payload->''lot_ids'');\n'
    || E'  END IF;\n\n'
    || v_anchor);
  EXECUTE v_def;
END $patch$;

-- place_bid: chỉ trả giá lô đã đăng ký (sau cổng not_eligible, trước khi tính giá).
DO $patch$
DECLARE
  v_def    TEXT := pg_get_functiondef('public.place_bid(uuid, numeric, text)'::regprocedure);
  v_anchor TEXT := '  v_min := CASE WHEN st.current_price IS NULL THEN it.starting_price ELSE st.current_price + it.bid_step END;';
BEGIN
  IF position('lot_not_registered' IN v_def) > 0 THEN
    RAISE NOTICE 'place_bid đã có lot_not_registered — bỏ qua';
    RETURN;
  END IF;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'place_bid: không thấy mốc v_min — bản LIVE đã đổi, vá tay';
  END IF;
  v_def := replace(v_def, v_anchor,
    E'  -- Hồ sơ chọn lô (20261018160000): chỉ trả giá lô đã đăng ký. Không chọn = mọi lô.\n'
    || E'  IF NOT public._contract_lot_ok(c.id, _lot_id) THEN\n'
    || E'    RETURN jsonb_build_object(''ok'', false, ''reason'', ''lot_not_registered'');\n'
    || E'  END IF;\n\n'
    || v_anchor);
  EXECUTE v_def;
END $patch$;

-- ─── 2. Người mua báo đã nộp tiền đặt trước ─────────────────────────────────
ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN IF NOT EXISTS deposit_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_proof_path  TEXT;

COMMENT ON COLUMN public.auction_bidding_contracts.deposit_reported_at IS
  'Người mua báo đã nộp tiền đặt trước (chờ tổ chức đối soát). Chỉ ghi qua buyer_report_deposit.';
COMMENT ON COLUMN public.auction_bidding_contracts.deposit_proof_path IS
  'Chứng từ nộp tiền (bucket buyer-kyc, thư mục {user_id}/) — không bắt buộc.';

CREATE OR REPLACE FUNCTION public.buyer_report_deposit(_contract_id UUID, _proof_path TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_path TEXT := NULLIF(btrim(COALESCE(_proof_path, '')), '');
  c      RECORD;
  v_at   TIMESTAMPTZ;
BEGIN
  SELECT x.id, x.user_id, x.status, x.review_status, x.deposit_status,
         s.status AS session_status, s.finalized_at
    INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;
  IF v_uid IS NULL OR c.id IS NULL OR c.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'paid' OR c.review_status = 'rejected' THEN
    RAISE EXCEPTION 'Hồ sơ chưa thanh toán hoặc đã bị từ chối.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.session_status <> 'published' OR c.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION 'Phiên đã kết thúc hoặc đã huỷ — không báo nộp tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.deposit_status <> 'pending' THEN
    RAISE EXCEPTION 'Tổ chức đã ghi nhận tiền đặt trước của hồ sơ này.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_path IS NOT NULL AND (
       split_part(v_path, '/', 1) <> v_uid::text
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'buyer-kyc' AND o.name = v_path)) THEN
    RAISE EXCEPTION 'Chứng từ không hợp lệ — vui lòng tải lại.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET deposit_reported_at = COALESCE(deposit_reported_at, now()),
         deposit_proof_path  = COALESCE(v_path, deposit_proof_path)
   WHERE id = _contract_id
   RETURNING deposit_reported_at INTO v_at;

  RETURN jsonb_build_object('contract_id', _contract_id, 'reported_at', v_at);
END; $$;

CREATE OR REPLACE FUNCTION public.buyer_undo_deposit_report(_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT id, user_id, deposit_status INTO c
    FROM public.auction_bidding_contracts WHERE id = _contract_id FOR UPDATE;
  IF auth.uid() IS NULL OR c.id IS NULL OR c.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.deposit_status <> 'pending' THEN
    RAISE EXCEPTION 'Tổ chức đã ghi nhận tiền đặt trước — không hoàn tác được.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.auction_bidding_contracts
     SET deposit_reported_at = NULL, deposit_proof_path = NULL
   WHERE id = _contract_id;
END; $$;

REVOKE ALL ON FUNCTION public.buyer_report_deposit(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buyer_undo_deposit_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buyer_report_deposit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_undo_deposit_report(UUID) TO authenticated;

-- Chứng từ: tổ chức đọc được như ảnh giấy tờ; người mua không xoá được khi còn tham chiếu.
DO $patch$
DECLARE
  v_def    TEXT := pg_get_functiondef('public.can_read_buyer_kyc_object(text)'::regprocedure);
  v_anchor TEXT := 'c.proxy_id_front_path, c.proxy_id_back_path, c.poa_doc_path)';
BEGIN
  IF position('deposit_proof_path' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'can_read_buyer_kyc_object: không thấy mốc — bản LIVE đã đổi, vá tay';
  END IF;
  EXECUTE replace(v_def, v_anchor, 'c.proxy_id_front_path, c.proxy_id_back_path, c.poa_doc_path, c.deposit_proof_path)');
END $patch$;

DO $patch$
DECLARE
  v_def    TEXT := pg_get_functiondef('public.buyer_kyc_path_referenced(text)'::regprocedure);
  v_anchor TEXT := 'c.proxy_id_front_path, c.proxy_id_back_path, c.poa_doc_path)';
BEGIN
  IF position('deposit_proof_path' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'buyer_kyc_path_referenced: không thấy mốc — bản LIVE đã đổi, vá tay';
  END IF;
  EXECUTE replace(v_def, v_anchor, 'c.proxy_id_front_path, c.proxy_id_back_path, c.poa_doc_path, c.deposit_proof_path)');
END $patch$;

-- ─── 3. Hướng dẫn nộp đặt trước cho người mua ───────────────────────────────
CREATE OR REPLACE FUNCTION public.my_contract_deposit_info(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c      RECORD;
  v_bank JSONB;
  v_lots JSONB;
BEGIN
  SELECT x.id, x.code, x.user_id, x.status, x.session_id,
         s.organization_id, s.auction_org_id, s.registration_end_at,
         ao.name AS ao_name, ao.address AS ao_address, ao.phone AS ao_phone, ao.logo_url AS ao_logo,
         o.name AS org_name
    INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
    LEFT JOIN public.auction_organizations ao ON ao.id = s.auction_org_id
    LEFT JOIN public.organizations o ON o.id = s.organization_id
   WHERE x.id = _contract_id;
  IF auth.uid() IS NULL OR c.id IS NULL OR c.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NULL;
  END IF;

  -- Tài khoản ngân hàng chỉ lộ cho hồ sơ ĐÃ thanh toán (người đã là khách của tổ chức).
  IF c.status = 'paid' THEN
    SELECT jsonb_build_object('bank_name', b.bank_name, 'branch', b.branch,
                              'account_number', b.account_number, 'account_holder', b.account_holder)
      INTO v_bank
      FROM public.org_bank_accounts b
     WHERE b.organization_id = c.organization_id
     ORDER BY b.is_primary DESC, b.sort_order, b.created_at
     LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'item_id', i.id, 'lot_no', i.lot_no, 'title', i.title,
           'deposit_amount', i.deposit_amount, 'starting_price', i.starting_price)
           ORDER BY i.lot_no), '[]'::jsonb)
    INTO v_lots
    FROM public.auction_session_items i
   WHERE i.session_id = c.session_id AND public._contract_lot_ok(c.id, i.id);

  RETURN jsonb_build_object(
    'contract_id',  c.id,
    'code',         c.code,
    'deposit_due',  public._contract_deposit_due(c.id),
    'deadline',     c.registration_end_at,
    'all_lots',     NOT EXISTS (SELECT 1 FROM public.auction_contract_lots WHERE contract_id = c.id),
    'lots',         v_lots,
    'bank',         v_bank,
    'org', jsonb_build_object(
      'name',     COALESCE(c.ao_name, c.org_name),
      'address',  c.ao_address,
      'phone',    c.ao_phone,
      'logo_url', c.ao_logo)
  );
END; $$;

REVOKE ALL ON FUNCTION public.my_contract_deposit_info(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_contract_deposit_info(UUID) TO authenticated;

-- Kiểm: mỗi hàm vá còn đúng 1 bản (CREATE OR REPLACE không tạo nạp chồng).
DO $check$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'start_bidding_contract') <> 1
     OR (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'place_bid') <> 1 THEN
    RAISE EXCEPTION 'start_bidding_contract / place_bid có nhiều hơn 1 bản';
  END IF;
  IF position('_set_contract_lots' IN pg_get_functiondef('public.start_bidding_contract(uuid, jsonb)'::regprocedure)) = 0
     OR position('lot_not_registered' IN pg_get_functiondef('public.place_bid(uuid, numeric, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'vá start_bidding_contract / place_bid không ăn';
  END IF;
END $check$;

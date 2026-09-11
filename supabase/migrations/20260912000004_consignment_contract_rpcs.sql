-- Hợp đồng ký gửi: RPC cho cả hai bên + chốt báo giá tạo hợp đồng
--
-- Mọi RPC: SECURITY DEFINER, trả {ok:false, reason} cho lỗi nghiệp vụ dự kiến
-- (câu tiếng Việt ở src/lib/consignment/errors.ts). Không lộ sự tồn tại của hợp
-- đồng cho người không phải một bên ⇒ 'not_found'.
--
-- Thứ tự khoá thống nhất với 20260912000001: advisory lock theo hồ sơ TRƯỚC,
-- rồi mới FOR UPDATE dòng.

-- ─── 1. Chốt báo giá: tạo hợp đồng trong CÙNG giao dịch ──────────────────────
-- Giữ nguyên thân 20260912000001 §5; thêm INSERT hợp đồng TRƯỚC các nhánh return
-- sớm (dedup cơ hội / thiếu catalog) — đặt ở cuối thì hai nhánh đó không bao giờ
-- có hợp đồng. Khoá trả về là `consignment_contract_id` vì `contract_id` đã mang
-- nghĩa hợp đồng hoa hồng với nhà cung cấp.

CREATE OR REPLACE FUNCTION public.owner_select_service_quote(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_posting_id  UUID;
  v_req         public.asset_service_requests%ROWTYPE;
  v_posting     public.asset_postings%ROWTYPE;
  v_org         public.auction_organizations%ROWTYPE;
  v_org_account UUID;
  v_contract    UUID;
  v_prof        RECORD;
  v_service     UUID;
  v_variant     UUID;
  v_lead        UUID;
  v_opp         UUID;
  v_supplier    UUID;
  v_terms       RECORD;
  v_ctype       TEXT    := NULL;
  v_cvalue      NUMERIC := NULL;
  v_cid         UUID    := NULL;
  v_lineid      UUID    := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT asset_posting_id INTO v_posting_id
    FROM public.asset_service_requests
   WHERE id = _request_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM public.lock_asset_posting_consignment(v_posting_id);

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id FOR UPDATE;

  IF public.asset_posting_selection_locked(v_req.asset_posting_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_selected');
  END IF;
  IF v_req.status <> 'quoted' OR v_req.quoted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_quoted');
  END IF;

  -- Hợp đồng cần tài khoản tổ chức (người soạn / ký). Báo giá chỉ gửi được từ
  -- tài khoản nên thiếu ở đây là dữ liệu hỏng, không phải lỗi người dùng.
  v_org_account := COALESCE(v_req.organization_id, (
    SELECT o.id FROM public.organizations o
     WHERE o.auction_org_id = v_req.auction_org_id AND o.kyc_status = 'APPROVED'
     ORDER BY o.created_at LIMIT 1
  ));
  IF v_org_account IS NULL THEN
    RAISE EXCEPTION 'Tổ chức chưa có tài khoản trên sàn — không lập được hợp đồng'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = v_req.asset_posting_id;
  SELECT * INTO v_org     FROM public.auction_organizations WHERE id = v_req.auction_org_id;

  UPDATE public.asset_service_requests SET status = 'selected' WHERE id = _request_id;

  UPDATE public.asset_service_requests
     SET status_before_close  = status,
         closed_by_request_id = _request_id,
         status               = 'not_selected'
   WHERE asset_posting_id = v_req.asset_posting_id
     AND id <> _request_id
     AND status IN ('sent', 'seen', 'quoted');

  UPDATE public.asset_broker_requests
     SET status = 'selected', selected_request_id = _request_id
   WHERE asset_posting_id = v_req.asset_posting_id AND status <> 'cancelled';

  -- ⚠️ KHÔNG đụng vào asset_postings — guard_asset_posting_review() nuốt thay đổi
  -- của mọi caller thiếu quyền, KỂ CẢ hàm SECURITY DEFINER này.

  INSERT INTO public.consignment_contracts
    (service_request_id, asset_posting_id, auction_org_id, organization_id, owner_user_id,
     terms, owner_party, org_party, asset_snapshot)
  VALUES
    (_request_id, v_req.asset_posting_id, v_req.auction_org_id, v_org_account, v_uid,
     public.consignment_request_terms(v_req),
     public.consignment_owner_party(v_uid),
     public.consignment_org_party(v_req.auction_org_id, v_org_account),
     public.consignment_asset_snapshot(v_req.asset_posting_id))
  RETURNING id INTO v_contract;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (v_contract, 'created', 'owner', v_uid, jsonb_build_object('request_id', _request_id));

  SELECT o.id, o.lead_id INTO v_opp, v_lead
    FROM public.opportunities o
   WHERE o.asset_posting_id = v_req.asset_posting_id
     AND o.stage IN ('selling', 'pending_approval')
   LIMIT 1;
  IF v_opp IS NOT NULL THEN
    UPDATE public.consignment_contracts SET opportunity_id = v_opp WHERE id = v_contract;
    RETURN jsonb_build_object('ok', true, 'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', true,
                              'consignment_contract_id', v_contract);
  END IF;

  -- Tổ chức này đã có hồ sơ đối tác + hợp đồng đang hiệu lực chưa?
  SELECT id INTO v_supplier
    FROM public.suppliers
   WHERE auction_org_id = v_req.auction_org_id AND status = 'active'
   LIMIT 1;

  IF v_supplier IS NOT NULL THEN
    SELECT s.id INTO v_service
      FROM public.services s WHERE s.name = 'Hoa hồng môi giới ký gửi' LIMIT 1;
    SELECT sv.id INTO v_variant
      FROM public.service_variants sv WHERE sv.variant_key = 'broker_commission' LIMIT 1;

    IF v_service IS NOT NULL THEN
      SELECT * INTO v_terms
        FROM public.resolve_contract_terms(v_supplier, v_service, v_variant, CURRENT_DATE);
      IF FOUND THEN
        v_ctype  := v_terms.commission_type;
        v_cvalue := v_terms.commission_value;
        v_cid    := v_terms.contract_id;
        v_lineid := v_terms.line_id;
      ELSE
        v_service  := NULL;
        v_variant  := NULL;
        v_supplier := NULL;
      END IF;
    ELSE
      v_supplier := NULL;
    END IF;
  END IF;

  IF v_service IS NULL THEN
    SELECT s.id INTO v_service FROM public.services s WHERE s.name = 'Môi giới ký gửi tài sản' LIMIT 1;
    SELECT sv.id INTO v_variant FROM public.service_variants sv WHERE sv.variant_key = 'broker_consignment' LIMIT 1;
  END IF;

  IF v_service IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'opportunity_id', NULL, 'lead_id', NULL, 'deduped', false,
                              'consignment_contract_id', v_contract);
  END IF;

  SELECT name, email INTO v_prof FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.leads
    (name, contact_name, phone, email, lead_type, source, status, note,
     created_by, asset_posting_id)
  VALUES (
    COALESCE(NULLIF(v_prof.name, ''), v_prof.email, 'Chủ tài sản'),
    v_prof.name, NULL, v_prof.email,
    'asset_owner', 'asset_brokerage', 'new',
    'Chốt ký gửi "' || v_posting.title || '" với ' || COALESCE(v_org.name, 'tổ chức đấu giá'),
    v_uid, v_req.asset_posting_id
  )
  RETURNING id INTO v_lead;

  INSERT INTO public.opportunities
    (name, lead_id, opportunity_type, stage, service_id, service_variant_id,
     amount, gross_amount, created_by, asset_posting_id,
     supplier_id, commission_type, commission_value, contract_id, contract_line_id)
  VALUES (
    'Ký gửi: ' || v_posting.title,
    v_lead, 'new_business', 'selling', v_service, v_variant,
    0, COALESCE(v_req.quote_service_fee, 0), v_uid, v_req.asset_posting_id,
    v_supplier, v_ctype, v_cvalue, v_cid, v_lineid
  )
  RETURNING id INTO v_opp;

  UPDATE public.consignment_contracts SET opportunity_id = v_opp WHERE id = v_contract;

  RETURN jsonb_build_object(
    'ok', true,
    'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', false,
    'contract_id', v_cid,
    'consignment_contract_id', v_contract
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_select_service_quote(UUID) TO authenticated;

-- ─── 2. Tổ chức chia sẻ dự thảo ──────────────────────────────────────────────
-- Dự thảo mới ⇒ điều khoản có thể đã đổi ⇒ xoá bản ký + cả hai xác nhận.

CREATE OR REPLACE FUNCTION public.consignment_contract_share_draft(
  _contract_id    UUID,
  _draft_doc_path TEXT,
  _generated      BOOLEAN DEFAULT false,
  _contract_no    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  c         public.consignment_contracts%ROWTYPE;
  v_owner   JSONB;
  v_org     JSONB;
  v_missing TEXT[];
  v_reason  TEXT;
  v_cleared BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status NOT IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  v_reason := public.consignment_contract_file_check(c.organization_id, c.id, _draft_doc_path, 'draft');
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason);
  END IF;

  v_owner   := public.consignment_owner_party(c.owner_user_id);
  v_org     := public.consignment_org_party(c.auction_org_id, c.organization_id);
  v_missing := public.consignment_missing_parties(v_owner, v_org);
  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'party_incomplete', 'missing', to_jsonb(v_missing));
  END IF;

  v_cleared := c.signed_doc_path IS NOT NULL;

  UPDATE public.consignment_contracts
     SET draft_doc_path       = _draft_doc_path,
         draft_source         = CASE WHEN _generated THEN 'generated' ELSE 'uploaded' END,
         draft_uploaded_by    = v_uid,
         draft_uploaded_at    = now(),
         contract_no          = COALESCE(NULLIF(btrim(COALESCE(_contract_no, '')), ''), contract_no),
         owner_party          = v_owner,
         org_party            = v_org,
         asset_snapshot       = public.consignment_asset_snapshot(c.asset_posting_id),
         signed_doc_path      = NULL,
         signed_uploaded_by   = NULL,
         signed_uploaded_side = NULL,
         signed_uploaded_at   = NULL,
         signed_date          = NULL,
         owner_confirmed_at   = NULL,
         owner_confirmed_by   = NULL,
         org_confirmed_at     = NULL,
         org_confirmed_by     = NULL,
         status               = 'awaiting_signatures'
   WHERE id = c.id;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (c.id, 'draft_shared', 'org', v_uid,
          jsonb_build_object('path', _draft_doc_path, 'generated', _generated,
                             'cleared_signed', v_cleared, 'previous_signed_path', c.signed_doc_path));

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_signatures', 'cleared_signed', v_cleared);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consignment_contract_share_draft(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;

-- ─── 3. Một bên tải bản đã ký ────────────────────────────────────────────────
-- Bản scan mới LUÔN xoá cả hai xác nhận (xác nhận là cho một tệp cụ thể).

CREATE OR REPLACE FUNCTION public.consignment_contract_attach_signed(
  _contract_id     UUID,
  _side            TEXT,
  _signed_doc_path TEXT,
  _signed_date     DATE,
  _contract_no     TEXT    DEFAULT NULL,
  _confirm         BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  c         public.consignment_contracts%ROWTYPE;
  v_owner   JSONB;
  v_org     JSONB;
  v_missing TEXT[];
  v_reason  TEXT;
  v_now     TIMESTAMPTZ := now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _side IS NULL OR _side NOT IN ('owner', 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status NOT IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  v_reason := public.consignment_contract_file_check(c.organization_id, c.id, _signed_doc_path, 'signed');
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason);
  END IF;

  -- Ngày theo giờ Việt Nam: 6h sáng ở VN vẫn là hôm qua theo UTC.
  IF _signed_date IS NULL OR _signed_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_signed_date');
  END IF;

  v_owner   := public.consignment_owner_party(c.owner_user_id);
  v_org     := public.consignment_org_party(c.auction_org_id, c.organization_id);
  v_missing := public.consignment_missing_parties(v_owner, v_org);
  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'party_incomplete', 'missing', to_jsonb(v_missing));
  END IF;

  UPDATE public.consignment_contracts
     SET signed_doc_path      = _signed_doc_path,
         signed_uploaded_by   = v_uid,
         signed_uploaded_side = _side,
         signed_uploaded_at   = v_now,
         signed_date          = _signed_date,
         contract_no          = COALESCE(NULLIF(btrim(COALESCE(_contract_no, '')), ''), contract_no),
         owner_party          = v_owner,
         org_party            = v_org,
         asset_snapshot       = public.consignment_asset_snapshot(c.asset_posting_id),
         owner_confirmed_at   = CASE WHEN _confirm AND _side = 'owner' THEN v_now END,
         owner_confirmed_by   = CASE WHEN _confirm AND _side = 'owner' THEN v_uid END,
         org_confirmed_at     = CASE WHEN _confirm AND _side = 'org'   THEN v_now END,
         org_confirmed_by     = CASE WHEN _confirm AND _side = 'org'   THEN v_uid END,
         status               = 'awaiting_confirmation'
   WHERE id = c.id;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (c.id, 'signed_uploaded', _side, v_uid,
          jsonb_build_object('path', _signed_doc_path, 'signed_date', _signed_date,
                             'previous_signed_path', c.signed_doc_path));
  IF _confirm THEN
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'confirmed', _side, v_uid, jsonb_build_object('path', _signed_doc_path));
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_confirmation');
END;
$$;

GRANT EXECUTE ON FUNCTION public.consignment_contract_attach_signed(UUID, TEXT, TEXT, DATE, TEXT, BOOLEAN) TO authenticated;

-- ─── 4. Xác nhận bản đã ký ───────────────────────────────────────────────────
-- Client gửi lại ĐÚNG path đang xem: bản scan bị thay giữa chừng ⇒ document_changed,
-- không để xác nhận nhầm một tệp mình chưa từng mở.

CREATE OR REPLACE FUNCTION public.consignment_contract_confirm(
  _contract_id     UUID,
  _side            TEXT,
  _signed_doc_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  c     public.consignment_contracts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _side IS NULL OR _side NOT IN ('owner', 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status <> 'awaiting_confirmation' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF _signed_doc_path IS DISTINCT FROM c.signed_doc_path THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_changed');
  END IF;

  IF _side = 'owner' AND c.owner_confirmed_at IS NULL THEN
    UPDATE public.consignment_contracts
       SET owner_confirmed_at = now(), owner_confirmed_by = v_uid
     WHERE id = c.id
    RETURNING * INTO c;
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'confirmed', 'owner', v_uid, jsonb_build_object('path', _signed_doc_path));
  ELSIF _side = 'org' AND c.org_confirmed_at IS NULL THEN
    UPDATE public.consignment_contracts
       SET org_confirmed_at = now(), org_confirmed_by = v_uid
     WHERE id = c.id
    RETURNING * INTO c;
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'confirmed', 'org', v_uid, jsonb_build_object('path', _signed_doc_path));
  END IF;

  IF c.owner_confirmed_at IS NOT NULL AND c.org_confirmed_at IS NOT NULL THEN
    UPDATE public.consignment_contracts
       SET status = 'signed', signed_at = now()
     WHERE id = c.id;
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'signed', _side, v_uid,
            jsonb_build_object('path', c.signed_doc_path, 'signed_date', c.signed_date));
    RETURN jsonb_build_object('ok', true, 'status', 'signed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_confirmation');
END;
$$;

GRANT EXECUTE ON FUNCTION public.consignment_contract_confirm(UUID, TEXT, TEXT) TO authenticated;

-- ─── 5. Huỷ hợp đồng & mở lại các báo giá khác ───────────────────────────────
-- Yêu cầu đã chốt → 'contract_cancelled' (kết thúc; UNIQUE(hồ sơ, tổ chức) vốn
-- chặn gửi lại tổ chức đó). Anh em bị CHÍNH lần chốt này đóng lại → khôi phục
-- đúng trạng thái cũ nhờ closed_by_request_id + status_before_close. Dòng
-- declined / withdrawn chưa từng bị lần chốt này đóng nên giữ nguyên.
-- Cơ hội CRM → 'lost': nếu để 'selling', lần chốt sau sẽ dedup vào cơ hội cũ và
-- thừa hưởng nhà cung cấp / hoa hồng của tổ chức vừa huỷ.

CREATE OR REPLACE FUNCTION public.consignment_contract_cancel(
  _contract_id UUID,
  _side        TEXT,
  _reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_reason          TEXT := btrim(COALESCE(_reason, ''));
  v_posting_id      UUID;
  c                 public.consignment_contracts%ROWTYPE;
  v_stage           TEXT;
  v_crm_warning     TEXT;
  v_reopened        INT;
  v_reopened_quoted INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _side IS NULL OR _side NOT IN ('owner', 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;

  SELECT asset_posting_id INTO v_posting_id FROM public.consignment_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM public.lock_asset_posting_consignment(v_posting_id);

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status = 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_signed');
  END IF;
  IF c.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled');
  END IF;
  IF char_length(v_reason) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  -- Chỉ lô cũ (trước khi có cổng hợp đồng) mới lọt vào đây.
  IF EXISTS (SELECT 1 FROM public.auction_session_items i
               JOIN public.auction_sessions s ON s.id = i.session_id
              WHERE i.service_request_id = c.service_request_id AND s.status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'in_auction_session');
  END IF;

  UPDATE public.consignment_contracts
     SET status = 'cancelled', cancel_reason = v_reason, cancelled_side = _side,
         cancelled_by = v_uid, cancelled_at = now()
   WHERE id = c.id;

  UPDATE public.asset_service_requests
     SET status = 'contract_cancelled'
   WHERE id = c.service_request_id AND status IN ('selected', 'accepted');

  WITH reopened AS (
    UPDATE public.asset_service_requests r
       SET status = CASE
             WHEN r.status_before_close = 'quoted' AND r.quoted_at IS NOT NULL THEN 'quoted'
             WHEN r.status_before_close IN ('quoted', 'seen') AND r.seen_at IS NOT NULL THEN 'seen'
             WHEN r.status_before_close IS NULL AND r.quoted_at IS NOT NULL THEN 'quoted'
             WHEN r.status_before_close IS NULL AND r.seen_at IS NOT NULL THEN 'seen'
             ELSE 'sent'
           END,
           closed_by_request_id = NULL,
           status_before_close  = NULL,
           reopened_at          = now()
     WHERE r.closed_by_request_id = c.service_request_id
       AND r.status = 'not_selected'
    RETURNING r.status
  )
  SELECT count(*), count(*) FILTER (WHERE status = 'quoted')
    INTO v_reopened, v_reopened_quoted
    FROM reopened;

  UPDATE public.asset_broker_requests b
     SET selected_request_id = NULL,
         status = CASE WHEN EXISTS (SELECT 1 FROM public.asset_service_requests x
                                     WHERE x.asset_posting_id = b.asset_posting_id AND x.status = 'quoted')
                       THEN 'quoted' ELSE 'sourcing' END
   WHERE b.selected_request_id = c.service_request_id AND b.status = 'selected';

  IF c.opportunity_id IS NOT NULL THEN
    SELECT stage INTO v_stage FROM public.opportunities WHERE id = c.opportunity_id;
    IF v_stage IN ('selling', 'pending_approval') THEN
      UPDATE public.opportunities
         SET stage = 'lost',
             lost_reason = 'Huỷ hợp đồng ký gửi ('
                           || CASE WHEN _side = 'owner' THEN 'chủ tài sản' ELSE 'tổ chức đấu giá' END
                           || '): ' || v_reason,
             closed_at = now()
       WHERE id = c.opportunity_id;
    ELSIF v_stage = 'won' THEN
      v_crm_warning := 'opportunity_won';
    END IF;
  END IF;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (c.id, 'cancelled', _side, v_uid,
          jsonb_build_object('reason', v_reason, 'reopened', v_reopened,
                             'reopened_quoted', v_reopened_quoted, 'crm_warning', v_crm_warning));

  RETURN jsonb_build_object('ok', true, 'reopened', v_reopened,
                            'reopened_quoted', v_reopened_quoted, 'crm_warning', v_crm_warning);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consignment_contract_cancel(UUID, TEXT, TEXT) TO authenticated;

-- ─── 6. Tổ chức đọc hợp đồng ─────────────────────────────────────────────────
-- Đây là chỗ DUY NHẤT tổ chức thấy danh tính / địa chỉ / giấy tờ sở hữu của chủ
-- tài sản — và chỉ khi đã được chốt, hợp đồng chưa huỷ. Đang mở thì đọc số liệu
-- SỐNG (chủ tài sản vừa bổ sung địa chỉ là tổ chức thấy ngay); đã ký thì đọc bản
-- chụp đóng băng.

CREATE OR REPLACE FUNCTION public.org_consignment_contract(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ao      UUID;
  c         public.consignment_contracts%ROWTYPE;
  v_open    BOOLEAN;
  v_owner   JSONB;
  v_orgp    JSONB;
  v_asset   JSONB;
  v_docs    TEXT[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT auction_org_id INTO v_ao FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND OR NOT public.user_in_auction_org(v_ao) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE service_request_id = _request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract');
  END IF;

  v_open := c.status IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation');

  IF c.status = 'signed' THEN
    v_owner := c.owner_party;
    v_orgp  := c.org_party;
    v_asset := c.asset_snapshot;
  ELSIF v_open THEN
    v_owner := public.consignment_owner_party(c.owner_user_id);
    v_orgp  := public.consignment_org_party(c.auction_org_id, c.organization_id);
    v_asset := public.consignment_asset_snapshot(c.asset_posting_id);
  ELSE
    v_orgp := c.org_party;   -- đã huỷ: không còn thấy chủ tài sản
  END IF;

  IF c.status <> 'cancelled' THEN
    SELECT COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}')
      INTO v_docs FROM public.asset_postings p WHERE p.id = c.asset_posting_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'contract', (to_jsonb(c)
                  - ARRAY['owner_party', 'asset_snapshot', 'draft_uploaded_by', 'signed_uploaded_by',
                          'owner_confirmed_by', 'org_confirmed_by', 'cancelled_by', 'opportunity_id'])
                || jsonb_build_object('org_party', v_orgp, 'owner_party', NULL, 'asset_snapshot', NULL),
    'owner_party', v_owner,
    'asset', v_asset,
    'ownership_doc_paths', to_jsonb(COALESCE(v_docs, '{}')),
    'events', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', e.action, 'side', e.side,
                                                            'created_at', e.created_at, 'data', e.data)
                                         ORDER BY e.created_at), '[]'::jsonb)
                 FROM public.consignment_contract_events e WHERE e.contract_id = c.id),
    'can_act', public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, 'org'),
    'missing', to_jsonb(CASE WHEN v_open THEN public.consignment_missing_parties(v_owner, v_orgp)
                             ELSE '{}'::text[] END)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_consignment_contract(UUID) TO authenticated;

-- ─── 7. Hộp thư tổ chức: thêm trạng thái hợp đồng ────────────────────────────
-- Đổi RETURNS TABLE ⇒ bắt buộc DROP. Phần còn lại giữ nguyên 20260911000002 §2 —
-- vẫn KHÔNG trả address / ward / giấy tờ / danh tính (đó là việc của §6).

DROP FUNCTION IF EXISTS public.org_service_requests(UUID);

CREATE FUNCTION public.org_service_requests(_auction_org_id UUID)
RETURNS TABLE (
  id                   UUID,
  status               TEXT,
  origin               TEXT,
  message              TEXT,
  match_score          NUMERIC,
  created_at           TIMESTAMPTZ,
  seen_at              TIMESTAMPTZ,
  quoted_at            TIMESTAMPTZ,
  decline_reason       TEXT,
  quote_commission_pct NUMERIC,
  quote_service_fee    NUMERIC,
  quote_starting_price NUMERIC,
  quote_lead_time_days INTEGER,
  quote_note           TEXT,
  quote_doc_path       TEXT,
  quote_plan           JSONB,
  quote_fee_items      JSONB,
  reopened_at          TIMESTAMPTZ,
  contract_id          UUID,
  contract_code        TEXT,
  contract_status      TEXT,
  posting_id           UUID,
  title                TEXT,
  parent_slug          TEXT,
  child_slug           TEXT,
  description          TEXT,
  province             TEXT,
  district             TEXT,
  pricing_mode         TEXT,
  starting_price       NUMERIC,
  auction_format       TEXT,
  commission_pct       NUMERIC,
  expected_timeline    TEXT,
  delta_fields         JSONB,
  image_urls           TEXT[],
  has_dispute          BOOLEAN,
  has_mortgage         BOOLEAN,
  is_seized            BOOLEAN,
  right_to_sell        BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.user_in_auction_org(_auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT r.id, r.status, r.origin, r.message, r.match_score, r.created_at,
         r.seen_at, r.quoted_at, r.decline_reason,
         r.quote_commission_pct, r.quote_service_fee, r.quote_starting_price,
         r.quote_lead_time_days, r.quote_note, r.quote_doc_path,
         r.quote_plan, r.quote_fee_items,
         r.reopened_at, c.id, c.code, c.status,
         p.id, p.title, p.parent_slug, p.child_slug, p.description,
         p.province, p.district,          -- KHÔNG trả address / ward
         p.pricing_mode, p.starting_price, p.auction_format,
         p.commission_pct, p.expected_timeline, p.delta_fields, p.image_urls,
         p.has_dispute, p.has_mortgage, p.is_seized, p.right_to_sell
    FROM public.asset_service_requests r
    JOIN public.asset_postings p ON p.id = r.asset_posting_id
    LEFT JOIN public.consignment_contracts c ON c.service_request_id = r.id
   WHERE r.auction_org_id = _auction_org_id
     AND r.status <> 'withdrawn'
   ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_service_requests(UUID) TO authenticated;

-- ─── 8. org_respond_service_request: yêu cầu huỷ hợp đồng cũng là "đã kết thúc" ─
-- Giữ nguyên 20260912000001 §6; chỉ thêm 'contract_cancelled' vào danh sách đóng.

CREATE OR REPLACE FUNCTION public.org_respond_service_request(
  _request_id UUID,
  _action     TEXT,
  _quote      JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req  public.asset_service_requests%ROWTYPE;
  v_org  UUID;
  v_fee  NUMERIC;
  v_lead INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _action NOT IN ('seen', 'quote', 'decline') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.user_in_auction_org(v_req.auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_org FROM public.organizations
   WHERE auction_org_id = v_req.auction_org_id AND kyc_status = 'APPROVED' LIMIT 1;

  IF _action <> 'seen' AND NOT public.org_has_permission(v_org, 'yeu-cau-ky-gui', 'update') THEN
    RAISE EXCEPTION 'Bạn không có quyền trả lời yêu cầu ký gửi'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.lock_asset_posting_consignment(v_req.asset_posting_id);
  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id FOR UPDATE;

  IF v_req.status IN ('selected', 'not_selected', 'withdrawn', 'contract_cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'request_closed');
  END IF;

  IF _action = 'quote' AND public.asset_posting_selection_locked(v_req.asset_posting_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_already_selected');
  END IF;

  IF _action = 'seen' THEN
    UPDATE public.asset_service_requests
       SET status = CASE WHEN status = 'sent' THEN 'seen' ELSE status END,
           seen_at = COALESCE(seen_at, now())
     WHERE id = _request_id;

  ELSIF _action = 'decline' THEN
    UPDATE public.asset_service_requests
       SET status = 'declined',
           decline_reason = NULLIF(_quote->>'decline_reason', ''),
           responded_by = auth.uid(),
           organization_id = v_org
     WHERE id = _request_id;

  ELSE
    -- Công thức nhân bản ở src/lib/quotePlan.ts (feeTotalRequired).
    v_fee := CASE
      WHEN jsonb_typeof(_quote->'fee_items') = 'array' THEN (
        SELECT COALESCE(SUM((i->>'amount')::numeric), 0)
          FROM jsonb_array_elements(_quote->'fee_items') i
         WHERE COALESCE((i->>'optional')::boolean, false) = false
      )
      ELSE (_quote->>'service_fee')::numeric
    END;

    v_lead := COALESCE(
      NULLIF(_quote #>> '{plan,milestones,mo_phien}', '')::int,
      (_quote->>'lead_time_days')::int
    );

    UPDATE public.asset_service_requests
       SET status = 'quoted',
           quote_commission_pct = (_quote->>'commission_pct')::numeric,
           quote_service_fee    = v_fee,
           quote_starting_price = (_quote->>'starting_price')::numeric,
           quote_lead_time_days = v_lead,
           quote_plan           = CASE WHEN jsonb_typeof(_quote->'plan') = 'object'
                                       THEN _quote->'plan' END,
           quote_fee_items      = CASE WHEN jsonb_typeof(_quote->'fee_items') = 'array'
                                       THEN _quote->'fee_items' END,
           quote_note           = NULLIF(_quote->>'note', ''),
           quote_doc_path       = NULLIF(_quote->>'doc_path', ''),
           quoted_at            = now(),
           responded_by         = auth.uid(),
           organization_id      = v_org
     WHERE id = _request_id;

    UPDATE public.asset_broker_requests
       SET status = 'quoted'
     WHERE id = v_req.broker_request_id AND status IN ('pending', 'sourcing');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', _action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_respond_service_request(UUID, TEXT, JSONB) TO authenticated;

-- Ký gửi: MỘT hồ sơ chỉ chốt được MỘT tổ chức đấu giá — enforce ở DB
--
-- Trước migration này luật "chốt 1 báo giá / hồ sơ" chỉ nằm trong
-- owner_select_service_quote (kiểm status='quoted' của CHÍNH dòng được chọn),
-- nên vẫn ra được hai dòng 'selected' trên cùng một hồ sơ:
--   1. Tổ chức C từ chối → chủ tài sản chốt A → C báo giá lại ('declined' không
--      nằm trong danh sách kết thúc của org_respond_service_request) → chủ chốt C.
--   2. Sau khi chốt, chủ tài sản vẫn INSERT được yêu cầu mới (asr_owner_insert),
--      admin vẫn dispatch thêm được → tổ chức mới báo giá → chủ chốt tiếp.
--   3. Hai lệnh chốt đồng thời trên hai dòng khác nhau — không có khoá.
-- Hệ quả thật: auction_session_items_validate tra 'selected' LIMIT 1 nên HAI
-- tổ chức cùng đưa được một tài sản vào phiên của mình.
--
-- Cách chặn (ba lớp):
--   • Partial UNIQUE index — lưới cuối, kể cả với admin ghi tay.
--   • Advisory lock theo hồ sơ — mọi đường ghi (chốt / báo giá / chèn yêu cầu /
--     dispatch) xếp hàng qua cùng một khoá. Advisory chứ KHÔNG `SELECT … FOR
--     UPDATE` trên asset_postings: luồng ký gửi cố ý không chạm bảng đó (trigger
--     guard_asset_posting_review nuốt thay đổi của mọi caller thiếu quyền).
--   • Trigger BEFORE INSERT — phủ cả insert qua RLS lẫn dispatch lẫn seed.
--
-- Thêm closed_by_request_id + status_before_close để việc HUỶ hợp đồng sau này
-- (mở lại các báo giá đã bị đóng) khôi phục CHÍNH XÁC, không phải đoán.

-- ─── 0. Chốt chặn dữ liệu ────────────────────────────────────────────────────
-- Không tự sửa: chọn tổ chức nào thắng là quyết định nghiệp vụ.

DO $pre$
DECLARE v_dup TEXT;
BEGIN
  SELECT string_agg(asset_posting_id::text, ', ') INTO v_dup FROM (
    SELECT asset_posting_id FROM public.asset_service_requests
     WHERE status IN ('selected', 'accepted')
     GROUP BY asset_posting_id HAVING count(*) > 1
  ) t;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Hồ sơ đang chốt nhiều tổ chức — xử lý tay trước khi chạy migration: %', v_dup;
  END IF;
END
$pre$;

-- ─── 1. Cột ghi lại "ai đóng dòng này, trước đó nó ở trạng thái gì" ──────────

ALTER TABLE public.asset_service_requests
  ADD COLUMN IF NOT EXISTS closed_by_request_id UUID
    REFERENCES public.asset_service_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_before_close  TEXT;

ALTER TABLE public.asset_service_requests
  DROP CONSTRAINT IF EXISTS asr_status_before_close_check;
ALTER TABLE public.asset_service_requests
  ADD CONSTRAINT asr_status_before_close_check
  CHECK (status_before_close IS NULL OR status_before_close IN ('sent', 'seen', 'quoted'));

COMMENT ON COLUMN public.asset_service_requests.closed_by_request_id IS
  'Yêu cầu được chốt đã đóng dòng này thành not_selected. Huỷ hợp đồng của yêu cầu đó ⇒ mở lại đúng các dòng có giá trị này.';
COMMENT ON COLUMN public.asset_service_requests.status_before_close IS
  'Trạng thái ngay trước khi bị đóng thành not_selected (sent/seen/quoted) — để mở lại chính xác.';

-- Dòng not_selected có sẵn: suy trạng thái cũ từ dấu thời gian.
UPDATE public.asset_service_requests r
   SET closed_by_request_id = s.id,
       status_before_close  = CASE
         WHEN r.quoted_at IS NOT NULL THEN 'quoted'
         WHEN r.seen_at   IS NOT NULL THEN 'seen'
         ELSE 'sent'
       END
  FROM public.asset_service_requests s
 WHERE s.asset_posting_id = r.asset_posting_id
   AND s.status IN ('selected', 'accepted')
   AND r.status = 'not_selected'
   AND r.closed_by_request_id IS NULL;

-- Dòng còn mở nằm cạnh một lựa chọn (triệu chứng của lỗ hổng 1/2): đóng lại.
-- Vế phải của SET đọc giá trị CŨ nên status_before_close = status là đúng.
UPDATE public.asset_service_requests r
   SET status_before_close  = r.status,
       closed_by_request_id = s.id,
       status               = 'not_selected'
  FROM public.asset_service_requests s
 WHERE s.asset_posting_id = r.asset_posting_id
   AND s.id <> r.id
   AND s.status IN ('selected', 'accepted')
   AND r.status IN ('sent', 'seen', 'quoted');

-- ─── 2. Lưới cuối: tối đa một dòng đã chốt / hồ sơ ───────────────────────────
-- 'accepted' là trạng thái cũ (seed) mang cùng nghĩa "đã chốt".

CREATE UNIQUE INDEX IF NOT EXISTS uq_asr_one_selection_per_posting
  ON public.asset_service_requests (asset_posting_id)
  WHERE status IN ('selected', 'accepted');

-- ─── 3. Helper nội bộ (KHÔNG phơi qua PostgREST) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.lock_asset_posting_consignment(_posting_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('asset_posting_consignment:' || _posting_id::text, 0)
  );
END;
$$;

-- VOLATILE (mặc định) có chủ ý: gọi SAU khi lấy khoá thì phải đọc snapshot mới,
-- không phải snapshot từ đầu câu lệnh gọi.
CREATE OR REPLACE FUNCTION public.asset_posting_selection_locked(_posting_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asset_service_requests
     WHERE asset_posting_id = _posting_id
       AND status IN ('selected', 'accepted')
  );
$$;

REVOKE ALL ON FUNCTION public.lock_asset_posting_consignment(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.asset_posting_selection_locked(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 4. Trigger: không chèn yêu cầu mới vào hồ sơ đã chốt ────────────────────
-- Một trigger phủ mọi đường: insert của chủ tài sản qua RLS, dispatch của admin,
-- seed. RLS WITH CHECK không lấy khoá được nên vẫn dính race.

CREATE OR REPLACE FUNCTION public.asr_guard_insert_after_selection()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.lock_asset_posting_consignment(NEW.asset_posting_id);
  IF public.asset_posting_selection_locked(NEW.asset_posting_id) THEN
    RAISE EXCEPTION 'Hồ sơ đã chốt tổ chức đấu giá — không gửi thêm yêu cầu được.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asr_guard_insert_after_selection ON public.asset_service_requests;
CREATE TRIGGER asr_guard_insert_after_selection
  BEFORE INSERT ON public.asset_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.asr_guard_insert_after_selection();

-- ─── 5. owner_select_service_quote: khoá + lỗi nghiệp vụ trả {ok:false} ──────
-- Thân hàm giữ nguyên 20260907000003 §6 (dịch vụ / hợp đồng hoa hồng / lead /
-- cơ hội); chỉ đổi phần đầu (khoá, kiểm tra) và câu đóng anh em.

CREATE OR REPLACE FUNCTION public.owner_select_service_quote(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_posting_id UUID;
  v_req        public.asset_service_requests%ROWTYPE;
  v_posting    public.asset_postings%ROWTYPE;
  v_org        public.auction_organizations%ROWTYPE;
  v_prof       RECORD;
  v_service    UUID;
  v_variant    UUID;
  v_lead       UUID;
  v_opp        UUID;
  v_supplier   UUID;
  v_terms      RECORD;
  v_ctype      TEXT    := NULL;
  v_cvalue     NUMERIC := NULL;
  v_cid        UUID    := NULL;
  v_lineid     UUID    := NULL;
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

  -- Khoá trước, đọc sau: lệnh chốt thứ hai xếp hàng ở đây rồi thấy hồ sơ đã chốt.
  PERFORM public.lock_asset_posting_consignment(v_posting_id);

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id FOR UPDATE;

  IF public.asset_posting_selection_locked(v_req.asset_posting_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_selected');
  END IF;
  IF v_req.status <> 'quoted' OR v_req.quoted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_quoted');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = v_req.asset_posting_id;
  SELECT * INTO v_org     FROM public.auction_organizations WHERE id = v_req.auction_org_id;

  UPDATE public.asset_service_requests SET status = 'selected' WHERE id = _request_id;

  -- Ghi lại ai đóng + trạng thái cũ để huỷ hợp đồng mở lại được chính xác.
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

  SELECT o.id, o.lead_id INTO v_opp, v_lead
    FROM public.opportunities o
   WHERE o.asset_posting_id = v_req.asset_posting_id
     AND o.stage IN ('selling', 'pending_approval')
   LIMIT 1;
  IF v_opp IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', true);
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
        -- Có đối tác nhưng chưa có hợp đồng phủ dịch vụ này ⇒ về đường cũ.
        v_service  := NULL;
        v_variant  := NULL;
        v_supplier := NULL;
      END IF;
    ELSE
      v_supplier := NULL;
    END IF;
  END IF;

  -- Đường cũ: dịch vụ môi giới 'direct', không điều khoản hoa hồng.
  IF v_service IS NULL THEN
    SELECT s.id INTO v_service FROM public.services s WHERE s.name = 'Môi giới ký gửi tài sản' LIMIT 1;
    SELECT sv.id INTO v_variant FROM public.service_variants sv WHERE sv.variant_key = 'broker_consignment' LIMIT 1;
  END IF;

  IF v_service IS NULL THEN
    -- Không chặn chủ tài sản chỉ vì catalog thiếu: việc chọn đã ghi xong ở trên.
    RETURN jsonb_build_object('ok', true, 'opportunity_id', NULL, 'lead_id', NULL, 'deduped', false);
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

  RETURN jsonb_build_object(
    'ok', true,
    'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', false,
    'contract_id', v_cid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_select_service_quote(UUID) TO authenticated;

-- ─── 6. org_respond_service_request: khoá + chặn báo giá sau khi chốt ────────
-- Giữ nguyên 20260911000002 §3 (cổng quyền, công thức phí dẫn xuất). Đổi:
--   • lấy khoá hồ sơ rồi đọc lại dòng FOR UPDATE;
--   • hồ sơ đã chốt ⇒ không báo giá được nữa (vá lỗ hổng declined → quote);
--   • yêu cầu đã kết thúc ⇒ {ok:false} thay vì RAISE.

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

  -- Cùng khoá với lệnh chốt của chủ tài sản: báo giá và chốt không chen nhau.
  PERFORM public.lock_asset_posting_consignment(v_req.asset_posting_id);
  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id FOR UPDATE;

  -- Chủ tài sản đã chốt (hoặc thu hồi) thì tổ chức không lật ngược được nữa.
  IF v_req.status IN ('selected', 'not_selected', 'withdrawn') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'request_closed');
  END IF;

  -- Dòng 'declined' không bị đóng khi chủ tài sản chốt tổ chức khác, nên phải
  -- chặn theo HỒ SƠ chứ không theo dòng — nếu không tổ chức từ chối xong vẫn
  -- báo giá lại được và chủ tài sản chốt được tổ chức thứ hai.
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

  ELSE -- quote (ghi đè được: tổ chức sửa lại báo giá trước khi chủ tài sản chốt)

    -- Phí dịch vụ = TỔNG các khoản BẮT BUỘC. Khoản optional là lựa chọn thêm
    -- của chủ tài sản nên không nằm trong con số đem đi so sánh / vào CRM.
    -- Công thức này được nhân bản ở src/lib/quotePlan.ts (feeTotalRequired) —
    -- sửa một bên phải sửa bên kia.
    v_fee := CASE
      WHEN jsonb_typeof(_quote->'fee_items') = 'array' THEN (
        SELECT COALESCE(SUM((i->>'amount')::numeric), 0)
          FROM jsonb_array_elements(_quote->'fee_items') i
         WHERE COALESCE((i->>'optional')::boolean, false) = false
      )
      ELSE (_quote->>'service_fee')::numeric   -- dòng cũ / seed chưa có fee_items
    END;

    -- Thời gian dự kiến là mốc 'mở phiên' trong phương án, không phải một ô rời:
    -- hai con số cạnh nhau sẽ lệch nhau ngay lần sửa đầu tiên.
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

-- ─── 7. admin_dispatch_service_requests: không fan-out vào hồ sơ đã chốt ─────
-- Chép từ pg_get_functiondef() đang chạy (mã quyền đã đổi ở 20260906200001),
-- chỉ thêm khối khoá + kiểm tra. Raise thay vì {ok:false} như các RPC admin
-- khác; câu báo lỗi thân thiện hơn lỗi trigger nổ giữa vòng lặp.

CREATE OR REPLACE FUNCTION public.admin_dispatch_service_requests(
  _posting_id UUID,
  _orgs       JSONB,
  _message    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_posting    public.asset_postings%ROWTYPE;
  v_broker     UUID;
  v_item       JSONB;
  v_org        UUID;
  v_dispatched INT := 0;
  v_skipped    INT := 0;
BEGIN
  IF NOT public.admin_has_permission('tai-san-tu-nguyen', 'update') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = _posting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ tài sản' USING ERRCODE = 'no_data_found';
  END IF;

  -- Cùng cổng chặn với màn chủ tài sản: chưa duyệt thì chưa gửi cho tổ chức.
  IF v_posting.review_status <> 'approved' THEN
    RAISE EXCEPTION 'Hồ sơ chưa được duyệt — không gửi cho tổ chức đấu giá được'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.lock_asset_posting_consignment(_posting_id);
  IF public.asset_posting_selection_locked(_posting_id) THEN
    RAISE EXCEPTION 'Hồ sơ đã chốt tổ chức đấu giá — không gửi thêm tổ chức được'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_broker FROM public.asset_broker_requests
   WHERE asset_posting_id = _posting_id AND status <> 'cancelled' LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(_orgs, '[]'::jsonb))
  LOOP
    v_org := (v_item->>'org_id')::uuid;

    -- Tổ chức chưa có tài khoản thì không có đường trả lời ⇒ bỏ qua, không tạo
    -- ngõ cụt mới.
    IF NOT EXISTS (SELECT 1 FROM public.accounted_auction_org_ids() a WHERE a = v_org) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.asset_service_requests
      (asset_posting_id, auction_org_id, user_id, status, origin,
       broker_request_id, message, match_score)
    VALUES
      (_posting_id, v_org, v_posting.user_id, 'sent', 'platform',
       v_broker, NULLIF(_message, ''), (v_item->>'score')::numeric)
    ON CONFLICT (asset_posting_id, auction_org_id) DO NOTHING;

    IF FOUND THEN v_dispatched := v_dispatched + 1; ELSE v_skipped := v_skipped + 1; END IF;
  END LOOP;

  IF v_broker IS NOT NULL AND v_dispatched > 0 THEN
    UPDATE public.asset_broker_requests
       SET status = 'sourcing', assigned_admin_id = COALESCE(assigned_admin_id, auth.uid())
     WHERE id = v_broker AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('dispatched', v_dispatched, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dispatch_service_requests(UUID, JSONB, TEXT) TO authenticated;

-- ─── 8. Kiểm chứng ───────────────────────────────────────────────────────────

DO $verify$
DECLARE v_bad INT;
BEGIN
  SELECT count(*) INTO v_bad FROM (
    SELECT asset_posting_id FROM public.asset_service_requests
     WHERE status IN ('selected', 'accepted')
     GROUP BY asset_posting_id HAVING count(*) > 1
  ) t;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Còn % hồ sơ chốt nhiều tổ chức', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
    FROM public.asset_service_requests r
   WHERE r.status IN ('sent', 'seen', 'quoted')
     AND public.asset_posting_selection_locked(r.asset_posting_id);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Còn % yêu cầu mở nằm cạnh một lựa chọn đã chốt', v_bad;
  END IF;

  IF has_function_privilege('authenticated', 'public.lock_asset_posting_consignment(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.asset_posting_selection_locked(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Helper nội bộ đang phơi cho authenticated';
  END IF;
END
$verify$;

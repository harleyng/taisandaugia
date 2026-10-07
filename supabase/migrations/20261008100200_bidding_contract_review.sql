-- Tổ chức duyệt hồ sơ tham gia + hoàn tiền hồ sơ khi từ chối — W0/M3
-- (docs/bidder-ekyc-checkin-plan.md §2.3, C1–C3).
--
-- review_status (TÁCH khỏi status thanh toán):
--   pending ─► needs_info ─► pending (người mua nộp lại) ─► approved
--      └────────────────────────────────────────────────► rejected ⇒ status='refunded'
-- approved vẫn đổi được sang needs_info / rejected cho tới khi người đó điểm danh
-- hoặc danh sách điểm danh đã chốt (trigger khoá ở M4).
--
-- HOÀN TIỀN HỒ SƠ LÀ MÔ PHỎNG: refund_txn_ref = 'MOCK-RF-<mã hồ sơ>', đơn hoa hồng
-- liên kết chuyển 'cancelled' (báo cáo doanh thu đã bỏ đơn cancelled —
-- src/lib/reports/revenueReport.ts). Seam thật: Edge Function gọi API hoàn tiền
-- VNPay rồi mới ghi dòng này.

-- ─── 1. Cột + ràng buộc ────────────────────────────────────────────────────
ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN IF NOT EXISTS review_status  TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_note    TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_txn_ref TEXT UNIQUE;

-- Backfill TRƯỚC khi thêm ràng buộc: mọi hồ sơ đã trả trước khi có bước duyệt coi
-- như đã duyệt (demo PDG000012/13/14/22 vẫn chạy tiếp).
UPDATE public.auction_bidding_contracts
   SET review_status = 'approved', reviewed_at = paid_at
 WHERE status = 'paid' AND review_status = 'pending';

ALTER TABLE public.auction_bidding_contracts
  DROP CONSTRAINT IF EXISTS auction_bidding_contracts_status_check,
  DROP CONSTRAINT IF EXISTS abc_review_status_check,
  DROP CONSTRAINT IF EXISTS abc_review_note_shape,
  DROP CONSTRAINT IF EXISTS abc_refund_shape,
  DROP CONSTRAINT IF EXISTS abc_deposit_shape;

ALTER TABLE public.auction_bidding_contracts
  ADD CONSTRAINT auction_bidding_contracts_status_check
    CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'refunded')),
  ADD CONSTRAINT abc_review_status_check
    CHECK (review_status IN ('pending', 'needs_info', 'approved', 'rejected')),
  ADD CONSTRAINT abc_review_note_shape CHECK (
    review_status NOT IN ('needs_info', 'rejected') OR length(btrim(COALESCE(review_note, ''))) >= 3
  ),
  -- refunded ⇔ rejected, và chỉ hồ sơ ĐÃ trả mới hoàn được.
  ADD CONSTRAINT abc_refund_shape CHECK (
    (status = 'refunded') = (review_status = 'rejected')
    AND (status <> 'refunded'
         OR (refunded_at IS NOT NULL AND refund_txn_ref IS NOT NULL
             AND paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL))
  ),
  -- Bản 20260911000005 đòi status='paid'; hồ sơ bị từ chối khi đã nộp tiền đặt
  -- trước vẫn giữ số tiền (chờ hoàn trả).
  ADD CONSTRAINT abc_deposit_shape CHECK (
    deposit_status = 'pending'
    OR (status IN ('paid', 'refunded') AND deposit_amount_received IS NOT NULL)
  );

-- Bị từ chối (refunded) thì được mua lại như hồ sơ đã huỷ.
DROP INDEX IF EXISTS public.uq_abc_session_user;
CREATE UNIQUE INDEX uq_abc_session_user
  ON public.auction_bidding_contracts (session_id, user_id)
  WHERE status NOT IN ('cancelled', 'refunded') AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abc_session_review
  ON public.auction_bidding_contracts (session_id, review_status) WHERE status = 'paid';

-- Tổ chức thấy cả hồ sơ đã từ chối (lịch sử duyệt) và nhân viên điểm danh
-- ('checkin') đọc được danh sách.
DROP POLICY IF EXISTS "abc_select_org" ON public.auction_bidding_contracts;
CREATE POLICY "abc_select_org" ON public.auction_bidding_contracts
  FOR SELECT TO authenticated
  USING (status IN ('paid', 'refunded')
         AND (public.can_manage_bidding_contracts(organization_id, 'view')
              OR public.can_manage_bidding_contracts(organization_id, 'checkin')));

-- ─── 2. Nhật ký duyệt (CHỈ GHI THÊM) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_contract_review_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.auction_bidding_contracts(id) ON DELETE RESTRICT,
  kind        TEXT NOT NULL CHECK (kind IN ('submitted', 'needs_info', 'resubmitted', 'approved', 'rejected')),
  note        TEXT,
  -- Không FK: bảng chỉ-ghi-thêm, ON DELETE SET NULL sẽ là một UPDATE bị chặn.
  actor_id    UUID,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acre_contract ON public.auction_contract_review_events (contract_id, at);

DROP TRIGGER IF EXISTS auction_contract_review_events_append_only ON public.auction_contract_review_events;
CREATE TRIGGER auction_contract_review_events_append_only
  BEFORE UPDATE OR DELETE ON public.auction_contract_review_events
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

CREATE OR REPLACE FUNCTION public.auction_contract_review_event_visible(_contract_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_bidding_contracts c
     WHERE c.id = _contract_id
       AND (c.user_id = auth.uid()
            OR (c.status IN ('paid', 'refunded')
                AND public.can_manage_bidding_contracts(c.organization_id, 'view')))
  ) OR public.has_role(auth.uid(), 'ADMIN'::app_role)
$$;

REVOKE ALL ON FUNCTION public.auction_contract_review_event_visible(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_contract_review_event_visible(UUID) TO authenticated;

ALTER TABLE public.auction_contract_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acre_select" ON public.auction_contract_review_events;
CREATE POLICY "acre_select" ON public.auction_contract_review_events
  FOR SELECT TO authenticated
  USING (public.auction_contract_review_event_visible(contract_id));

-- Backfill lịch sử cho hồ sơ đã trả trước khi có bước duyệt.
INSERT INTO public.auction_contract_review_events (contract_id, kind, note, actor_id, at)
SELECT c.id, 'submitted', NULL, c.user_id, c.paid_at
  FROM public.auction_bidding_contracts c
 WHERE c.status = 'paid'
   AND NOT EXISTS (SELECT 1 FROM public.auction_contract_review_events e WHERE e.contract_id = c.id);

INSERT INTO public.auction_contract_review_events (contract_id, kind, note, actor_id, at)
SELECT c.id, 'approved', 'Tự động duyệt — hồ sơ nộp trước khi có bước duyệt.', NULL, c.paid_at + interval '1 second'
  FROM public.auction_bidding_contracts c
 WHERE c.status = 'paid' AND c.review_status = 'approved'
   AND NOT EXISTS (SELECT 1 FROM public.auction_contract_review_events e
                    WHERE e.contract_id = c.id AND e.kind = 'approved');

-- Thanh toán xong ⇒ sự kiện 'submitted' (không phải sửa _settle_bidding_contract).
CREATE OR REPLACE FUNCTION public.auction_bidding_contracts_review_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auction_contract_review_events (contract_id, kind, actor_id, at)
  VALUES (NEW.id, 'submitted', NEW.user_id, COALESCE(NEW.paid_at, now()));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS auction_bidding_contracts_review_submitted ON public.auction_bidding_contracts;
CREATE TRIGGER auction_bidding_contracts_review_submitted
  AFTER UPDATE OF status ON public.auction_bidding_contracts
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM 'paid' AND NEW.status = 'paid')
  EXECUTE FUNCTION public.auction_bidding_contracts_review_submitted();

-- ─── 3. Quyền: ho-so-tham-gia:review + ho-so-tham-gia:checkin ────────────────
-- Cấp cho MỌI vai đang có ho-so-tham-gia:update (gồm vai tự tạo của tổ chức).
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT p.role_id, 'ho-so-tham-gia', a.action
  FROM public.org_role_permissions p
 CROSS JOIN (VALUES ('review'), ('checkin')) AS a(action)
 WHERE p.module = 'ho-so-tham-gia' AND p.action = 'update'
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Preset cho tổ chức tạo mới: vá bản LIVE (phiên khác có thể đã thêm module).
DO $$
DECLARE
  v_def TEXT := pg_get_functiondef('public.org_seed_default_roles(uuid)'::regprocedure);
  v_old TEXT := $s$('MANAGER','ho-so-tham-gia','view'),       ('MANAGER','ho-so-tham-gia','update'),$s$;
  v_new TEXT := $s$('MANAGER','ho-so-tham-gia','view'),       ('MANAGER','ho-so-tham-gia','update'),
    ('MANAGER','ho-so-tham-gia','review'),     ('MANAGER','ho-so-tham-gia','checkin'),$s$;
BEGIN
  IF position($s$'ho-so-tham-gia','review'$s$ IN v_def) > 0 THEN
    RAISE NOTICE 'org_seed_default_roles đã có ho-so-tham-gia:review';
    RETURN;
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy dòng ho-so-tham-gia trong org_seed_default_roles LIVE — vá tay.';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $$;

-- ─── 4. Tổ chức duyệt ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.org_review_bidding_contract(
  _contract_id UUID,
  _decision    TEXT,
  _note        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sid  UUID;
  v_org  UUID;
  c      RECORD;
  v_note TEXT := NULLIF(btrim(COALESCE(_note, '')), '');
  v_ok   BOOLEAN;
BEGIN
  SELECT session_id, organization_id INTO v_sid, v_org
    FROM public.auction_bidding_contracts WHERE id = _contract_id;
  IF v_sid IS NULL OR NOT public.can_manage_bidding_contracts(v_org, 'review') THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ, hoặc bạn không có quyền duyệt.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));

  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;

  IF c.status = 'refunded' THEN
    RAISE EXCEPTION 'Hồ sơ đã bị từ chối và hoàn tiền — không duyệt lại được.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.status <> 'paid' THEN
    RAISE EXCEPTION 'Chỉ duyệt hồ sơ đã thanh toán.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.session_status <> 'published' THEN
    RAISE EXCEPTION 'Phiên không còn công bố — không duyệt hồ sơ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _decision IS NULL OR _decision NOT IN ('approved', 'needs_info', 'rejected') THEN
    RAISE EXCEPTION 'Quyết định duyệt không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _decision IN ('needs_info', 'rejected') AND length(COALESCE(v_note, '')) < 3 THEN
    RAISE EXCEPTION '%', CASE _decision WHEN 'rejected' THEN 'Nhập lý do từ chối (ít nhất 3 ký tự).'
                                        ELSE 'Nhập nội dung cần bổ sung (ít nhất 3 ký tự).' END
      USING ERRCODE = 'check_violation';
  END IF;

  v_ok := (c.review_status = 'pending')
       OR (c.review_status = 'needs_info' AND _decision IN ('approved', 'rejected'))
       OR (c.review_status = 'approved'   AND _decision IN ('needs_info', 'rejected'));
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Hồ sơ đang ở trạng thái duyệt "%" — không chuyển sang "%" được.', c.review_status, _decision
      USING ERRCODE = 'check_violation';
  END IF;

  IF _decision = 'rejected' THEN
    -- Tiền đặt trước đã nhận ⇒ chờ hoàn trả (sổ tiền đặt trước ghi qua trigger).
    PERFORM public._bidding_ctx('Hồ sơ bị từ chối — hoàn trả tiền đặt trước', NULL);
    UPDATE public.auction_bidding_contracts
       SET review_status  = 'rejected',
           review_note    = v_note,
           reviewed_at    = now(),
           reviewed_by    = auth.uid(),
           status         = 'refunded',
           refunded_at    = now(),
           refund_txn_ref = 'MOCK-RF-' || c.code,
           deposit_status = CASE WHEN c.deposit_status = 'received' THEN 'pending_refund' ELSE deposit_status END,
           deposit_status_changed_at = CASE WHEN c.deposit_status = 'received' THEN now() ELSE deposit_status_changed_at END,
           deposit_updated_by        = CASE WHEN c.deposit_status = 'received' THEN auth.uid() ELSE deposit_updated_by END
     WHERE id = c.id;
    PERFORM public._bidding_ctx_clear();

    IF c.order_id IS NOT NULL THEN
      UPDATE public.orders
         SET fulfillment_status = 'cancelled',
             note = concat_ws(' · ', NULLIF(note, ''), 'Huỷ: hồ sơ ' || c.code || ' bị từ chối — đã hoàn tiền hồ sơ')
       WHERE id = c.order_id;
    END IF;
  ELSE
    UPDATE public.auction_bidding_contracts
       SET review_status = _decision,
           review_note   = COALESCE(v_note, CASE WHEN _decision = 'approved' THEN NULL ELSE review_note END),
           reviewed_at   = now(),
           reviewed_by   = auth.uid()
     WHERE id = c.id;
  END IF;

  INSERT INTO public.auction_contract_review_events (contract_id, kind, note, actor_id)
  VALUES (c.id, _decision, v_note, auth.uid());

  RETURN jsonb_build_object(
    'contract_id',   c.id,
    'review_status', _decision,
    'status',        CASE WHEN _decision = 'rejected' THEN 'refunded' ELSE 'paid' END
  );
END; $$;

REVOKE ALL ON FUNCTION public.org_review_bidding_contract(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_review_bidding_contract(UUID, TEXT, TEXT) TO authenticated;

-- ─── 5. Người mua nộp lại khi được yêu cầu bổ sung ──────────────────────────
-- Payload giống start_bidding_contract (cùng hàm đọc _bidding_parties_from_payload).
CREATE OR REPLACE FUNCTION public.resubmit_bidding_contract(_contract_id UUID, _payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sid UUID;
  c     RECORD;
  v     public.auction_bidding_contracts;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT session_id INTO v_sid
    FROM public.auction_bidding_contracts WHERE id = _contract_id AND user_id = v_uid;
  IF v_sid IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ tham gia của bạn.' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));

  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;

  IF c.status <> 'paid' OR c.review_status <> 'needs_info' THEN
    RAISE EXCEPTION 'Chỉ nộp lại hồ sơ đang được tổ chức yêu cầu bổ sung.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.session_status <> 'published' THEN
    RAISE EXCEPTION 'Phiên không còn công bố.' USING ERRCODE = 'check_violation';
  END IF;

  v := public._bidding_parties_from_payload(v_uid, _payload);

  UPDATE public.auction_bidding_contracts
     SET buyer_kind = v.buyer_kind,
         full_name = v.full_name, id_type = v.id_type, id_number = v.id_number,
         date_of_birth = v.date_of_birth, gender = v.gender, phone = v.phone, email = v.email,
         address = v.address, identity_source = v.identity_source,
         id_front_path = v.id_front_path, id_back_path = v.id_back_path,
         id_read_method = v.id_read_method, id_edited_fields = v.id_edited_fields,
         org_name = v.org_name, org_tax_code = v.org_tax_code, org_address = v.org_address,
         org_reg_doc_path = v.org_reg_doc_path,
         has_proxy = v.has_proxy, proxy_full_name = v.proxy_full_name, proxy_id_type = v.proxy_id_type,
         proxy_id_number = v.proxy_id_number, proxy_date_of_birth = v.proxy_date_of_birth,
         proxy_gender = v.proxy_gender, proxy_phone = v.proxy_phone, proxy_address = v.proxy_address,
         proxy_id_front_path = v.proxy_id_front_path, proxy_id_back_path = v.proxy_id_back_path,
         proxy_id_read_method = v.proxy_id_read_method, proxy_id_edited_fields = v.proxy_id_edited_fields,
         poa_doc_path = v.poa_doc_path,
         review_status = 'pending',
         resubmitted_at = now()
   WHERE id = c.id;

  INSERT INTO public.auction_contract_review_events (contract_id, kind, actor_id)
  VALUES (c.id, 'resubmitted', v_uid);

  RETURN jsonb_build_object('contract_id', c.id, 'review_status', 'pending');
END; $$;

REVOKE ALL ON FUNCTION public.resubmit_bidding_contract(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_bidding_contract(UUID, JSONB) TO authenticated;

-- ─── 6. Kiểm chứng ─────────────────────────────────────────────────────────
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM public.auction_bidding_contracts
   WHERE status = 'paid' AND review_status <> 'approved' AND created_at < timestamptz '2026-10-08 00:00:00+07';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Còn % hồ sơ cũ đã trả chưa được backfill approved', v_n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                    AND proname = 'org_seed_default_roles'
                    AND prosrc LIKE '%''ho-so-tham-gia'',''checkin''%') THEN
    RAISE EXCEPTION 'org_seed_default_roles chưa có ho-so-tham-gia:checkin';
  END IF;

  IF has_function_privilege('anon', 'public.org_review_bidding_contract(uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.resubmit_bidding_contract(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC duyệt / nộp lại không được mở cho anon';
  END IF;

  RAISE NOTICE 'OK: M3 duyệt hồ sơ + hoàn tiền hồ sơ';
END $$;

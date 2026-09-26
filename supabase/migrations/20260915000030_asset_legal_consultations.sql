-- Tư vấn pháp lý cho hồ sơ số hoá ("Tư vấn pháp lý" ở bước 3 wizard + tab trên trang hồ sơ).
--
-- Vì sao: người bán muốn biết hồ sơ pháp lý đã đủ để đưa ra đấu giá chưa TRƯỚC khi ký
-- gửi — chuyên gia rà soát từng giấy tờ và trả checklist những gì cần bổ sung.
--
-- Luồng: người bán chọn tệp đã có trong hồ sơ + tải thêm → requested → admin báo giá
-- THAY đối tác (gán đối tác + tên chuyên gia; quoted) → người bán trả VNPay mô phỏng
-- (paid) → admin bắt đầu rà soát (in_review) → admin chấm checklist Đủ / Thiếu / Cần làm
-- rõ và hoàn tất THAY chuyên gia (completed, GHI HOA HỒNG). Muốn rà soát lại sau khi bổ
-- sung ⇒ gửi yêu cầu MỚI; kết luận cũ thành superseded.
--
-- Cùng khuôn với Giám định (20260915000020): bảng riêng, RPC {ok,reason}, sổ cái orders
-- ghi MỘT dòng lúc hoàn tất, điều khoản hoa hồng tra resolve_contract_terms.
--
-- @BR-CNS-01 Kết quả tư vấn KHÔNG tự chuyển trạng thái tài sản sang đủ điều kiện: không
--   RPC / trigger nào ở đây ghi asset_postings (status, review_status, mức xác minh đều
--   giữ nguyên) và không có cổng chặn nộp hồ sơ.
-- @BR-CNS-02 Hồ sơ + kết quả chỉ người bán (chủ đơn), chuyên gia được phân công (đối tác
--   chưa có tài khoản — admin thao tác thay bằng quyền tu-van-phap-ly) và admin đọc.
--   Không policy ghi. Người bán chỉ thấy checklist khi đã hoàn tất (không lộ bản nháp).
--   Tệp tải thêm nằm ở asset-docs/{uid}/legal-consult/… — ngoài ownership_proof_urls /
--   doc_urls nên tổ chức đấu giá có hợp đồng KHÔNG đọc được.
-- @BR-CNS-03 Mỗi lần tư vấn là một dòng; hoàn tất gán version (1, 2, …) + completed_at.
--   Checklist và tệp đã nộp bất biến sau khi hoàn tất (chỉ RPC ghi, chỉ khi in_review).

-- ─── 1. Catalog: dịch vụ + gói ───────────────────────────────────────────────

INSERT INTO public.services
  (name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
SELECT 'Tư vấn pháp lý hồ sơ tài sản', 'commission', 'brokerage', 'owner', 0, 'per_order',
       'Chuyên gia pháp lý rà soát giấy tờ của tài sản số hoá, đánh dấu Đủ / Thiếu / Cần làm rõ và trả checklist cần bổ sung. Giá theo báo giá từng đơn; sàn hưởng hoa hồng theo hợp đồng hợp tác đang hiệu lực.',
       true, 38
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Tư vấn pháp lý hồ sơ tài sản');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, 'tvpl_review', 'Rà soát hồ sơ pháp lý', 2000000::numeric, true, 1
  FROM public.services s
 WHERE s.name = 'Tư vấn pháp lý hồ sơ tài sản'
ON CONFLICT (variant_key) DO NOTHING;

-- ─── 2. Đối tác tư vấn + hợp đồng (GIÁ TRỊ GIỮ CHỖ, admin sửa được) ───────────

INSERT INTO public.suppliers
  (id, name, supplier_type, default_commission_type, default_commission_rate, status, note)
VALUES ('7e9a0000-0000-4000-8000-000000000001', 'Văn phòng Luật sư Tư vấn Tài sản Đấu giá', 'company',
        'percent', 20, 'active', '[tvpl-seed] Đối tác tư vấn pháp lý — tên & tỉ lệ giữ chỗ')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contracts
  (id, supplier_id, contract_no, title, signed_date, effective_from, effective_to, status, note)
VALUES ('7e9a0000-0000-4000-8000-000000000002', '7e9a0000-0000-4000-8000-000000000001',
        '03/2026/HĐHT-TVPL', 'Hợp tác cung cấp dịch vụ tư vấn pháp lý hồ sơ', DATE '2026-09-01',
        DATE '2026-09-01', DATE '2027-08-31', 'active', '[tvpl-seed] Tỉ lệ giữ chỗ — cập nhật theo hợp đồng thật')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contract_lines
  (id, contract_id, service_id, service_variant_id, commission_type, commission_value, note)
SELECT '7e9a0000-0000-4000-8000-000000000003', '7e9a0000-0000-4000-8000-000000000002',
       s.id, NULL, 'percent', 20, 'Áp cho mọi gói tư vấn pháp lý'
  FROM public.services s
 WHERE s.name = 'Tư vấn pháp lý hồ sơ tài sản'
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Bảng lần tư vấn + checklist ──────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_legal_consultation_code_seq START 1;

CREATE TABLE public.asset_legal_consultations (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT          NOT NULL UNIQUE
                         DEFAULT ('TV' || lpad(nextval('public.asset_legal_consultation_code_seq')::text, 6, '0')),
  asset_posting_id     UUID          NOT NULL REFERENCES public.asset_postings(id) ON DELETE RESTRICT,
  user_id              UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_variant_id   UUID          NOT NULL REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  posting_title        TEXT          NOT NULL,
  parent_slug          TEXT,
  package_name         TEXT          NOT NULL,

  -- Phiên bản kết luận: gán lúc hoàn tất (lần hoàn tất thứ N của hồ sơ). NULL khi chưa xong.
  version              INT           CHECK (version >= 1),

  status               TEXT          NOT NULL DEFAULT 'requested'
                         CHECK (status IN ('requested', 'quoted', 'paid', 'in_review',
                                           'completed', 'superseded', 'cancelled')),

  -- Bản chụp tệp nộp lần này (storage path trong bucket asset-docs). Bất biến.
  submitted_doc_paths  TEXT[]        NOT NULL CHECK (cardinality(submitted_doc_paths) BETWEEN 1 AND 50),
  request_note         TEXT          CHECK (length(request_note) <= 2000),

  -- Đối tác + chuyên gia được phân công (gán lúc báo giá, đổi được tới khi bắt đầu rà soát).
  supplier_id          UUID          REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  partner_name         TEXT,
  expert_name          TEXT          CHECK (length(expert_name) <= 200),

  quoted_price         NUMERIC(18,0) CHECK (quoted_price > 0),
  quote_note           TEXT          CHECK (length(quote_note) <= 2000),
  quoted_at            TIMESTAMPTZ,
  quote_expires_at     TIMESTAMPTZ,
  quoted_by            UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  payment_txn_ref      TEXT          UNIQUE,
  paid_at              TIMESTAMPTZ,

  review_started_at    TIMESTAMPTZ,
  summary              TEXT          CHECK (length(summary) <= 4000),
  completed_at         TIMESTAMPTZ,
  completed_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  commission_order_id  UUID          UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  superseded_at        TIMESTAMPTZ,

  cancelled_at         TIMESTAMPTZ,
  cancelled_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason        TEXT          CHECK (length(cancel_reason) <= 2000),

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tvpl_quoted_shape CHECK (
    status IN ('requested', 'cancelled')
    OR (quoted_price IS NOT NULL AND quoted_at IS NOT NULL AND supplier_id IS NOT NULL
        AND partner_name IS NOT NULL AND expert_name IS NOT NULL)),
  CONSTRAINT tvpl_paid_shape CHECK (
    status IN ('requested', 'quoted', 'cancelled') OR (paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL)),
  CONSTRAINT tvpl_cancel_unpaid CHECK (status <> 'cancelled' OR paid_at IS NULL),
  CONSTRAINT tvpl_review_shape CHECK (
    status NOT IN ('in_review', 'completed', 'superseded') OR review_started_at IS NOT NULL),
  CONSTRAINT tvpl_completed_shape CHECK (
    status NOT IN ('completed', 'superseded')
    OR (version IS NOT NULL AND completed_at IS NOT NULL AND commission_order_id IS NOT NULL
        AND length(btrim(COALESCE(summary, ''))) >= 5)),
  CONSTRAINT tvpl_version_only_when_done CHECK (
    version IS NULL OR status IN ('completed', 'superseded'))
);

COMMENT ON TABLE public.asset_legal_consultations IS
  'Lần tư vấn pháp lý của hồ sơ số hoá. Ghi CHỈ qua RPC. Kết quả mang tính tư vấn — KHÔNG đổi trạng thái hồ sơ (BR-CNS-01).';

CREATE UNIQUE INDEX uq_tvpl_active_per_posting
  ON public.asset_legal_consultations (asset_posting_id)
  WHERE status IN ('requested', 'quoted', 'paid', 'in_review');
CREATE UNIQUE INDEX uq_tvpl_completed_per_posting
  ON public.asset_legal_consultations (asset_posting_id) WHERE status = 'completed';
CREATE UNIQUE INDEX uq_tvpl_version_per_posting
  ON public.asset_legal_consultations (asset_posting_id, version) WHERE version IS NOT NULL;

CREATE INDEX idx_tvpl_posting  ON public.asset_legal_consultations (asset_posting_id, created_at DESC);
CREATE INDEX idx_tvpl_status   ON public.asset_legal_consultations (status, created_at DESC);
CREATE INDEX idx_tvpl_user     ON public.asset_legal_consultations (user_id);
CREATE INDEX idx_tvpl_supplier ON public.asset_legal_consultations (supplier_id);

CREATE TRIGGER asset_legal_consultations_updated_at
  BEFORE UPDATE ON public.asset_legal_consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.asset_legal_consultation_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id  UUID        NOT NULL REFERENCES public.asset_legal_consultations(id) ON DELETE CASCADE,
  sort_order       INT         NOT NULL DEFAULT 0,
  -- Mã mục trong mẫu checklist (src/lib/legalConsult/checklistTemplates.ts); NULL = chuyên gia thêm.
  template_key     TEXT        CHECK (length(template_key) <= 100),
  label            TEXT        NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 300),
  status           TEXT        CHECK (status IN ('sufficient', 'missing', 'needs_clarification')),
  expert_note      TEXT        CHECK (length(expert_note) <= 2000),
  required_action  TEXT        CHECK (length(required_action) <= 2000),
  doc_paths        TEXT[]      NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tvpl_items_consultation ON public.asset_legal_consultation_items (consultation_id, sort_order);

COMMENT ON TABLE public.asset_legal_consultation_items IS
  'Checklist của một lần tư vấn pháp lý. Ghi CHỈ qua RPC khi lần tư vấn đang in_review.';

ALTER TABLE public.asset_legal_consultations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_legal_consultation_items ENABLE ROW LEVEL SECURITY;

-- BR-CNS-02
CREATE POLICY asset_legal_consultations_owner_read
  ON public.asset_legal_consultations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY asset_legal_consultations_admin_read
  ON public.asset_legal_consultations FOR SELECT
  USING (public.admin_has_permission('tu-van-phap-ly', 'view'));

-- Người bán chỉ thấy checklist của lần đã hoàn tất — bản nháp của chuyên gia không lộ ra.
CREATE POLICY asset_legal_consultation_items_owner_read
  ON public.asset_legal_consultation_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.asset_legal_consultations c
                  WHERE c.id = consultation_id
                    AND c.user_id = auth.uid()
                    AND c.status IN ('completed', 'superseded')));

CREATE POLICY asset_legal_consultation_items_admin_read
  ON public.asset_legal_consultation_items FOR SELECT
  USING (public.admin_has_permission('tu-van-phap-ly', 'view'));

-- ─── 4. Nội bộ ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._legal_consult_service_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.services WHERE name = 'Tư vấn pháp lý hồ sơ tài sản' AND kind = 'commission' LIMIT 1;
$$;

-- Thay toàn bộ checklist của một lần tư vấn. Trả mã lỗi (TEXT) hoặc NULL nếu hợp lệ.
-- _strict = true (lúc hoàn tất): mọi mục phải được chấm; mục khác "Đủ" phải có việc cần làm.
CREATE OR REPLACE FUNCTION public._legal_consult_replace_items(
  _consultation public.asset_legal_consultations,
  _items        JSONB,
  _strict       BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item   JSONB;
  v_idx    INT := 0;
  v_label  TEXT;
  v_status TEXT;
  v_action TEXT;
  v_docs   TEXT[];
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN 'invalid_items';
  END IF;
  IF jsonb_array_length(_items) > 80 THEN
    RETURN 'too_many_items';
  END IF;
  IF _strict AND jsonb_array_length(_items) = 0 THEN
    RETURN 'checklist_empty';
  END IF;

  -- Kiểm hết trước khi ghi để lỗi không để lại checklist dở.
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_label  := btrim(COALESCE(v_item->>'label', ''));
    v_status := NULLIF(v_item->>'status', '');
    v_action := btrim(COALESCE(v_item->>'required_action', ''));
    IF length(v_label) < 2 OR length(v_label) > 300 THEN
      RETURN 'item_label_invalid';
    END IF;
    IF v_status IS NOT NULL AND v_status NOT IN ('sufficient', 'missing', 'needs_clarification') THEN
      RETURN 'item_status_invalid';
    END IF;
    IF _strict AND v_status IS NULL THEN
      RETURN 'item_unmarked';
    END IF;
    IF _strict AND v_status <> 'sufficient' AND length(v_action) < 5 THEN
      RETURN 'item_action_required';
    END IF;
    IF jsonb_typeof(COALESCE(v_item->'doc_paths', '[]'::jsonb)) <> 'array' THEN
      RETURN 'invalid_items';
    END IF;
    SELECT COALESCE(array_agg(x), '{}') INTO v_docs
      FROM jsonb_array_elements_text(COALESCE(v_item->'doc_paths', '[]'::jsonb)) AS x;
    IF NOT (v_docs <@ _consultation.submitted_doc_paths) THEN
      RETURN 'item_doc_invalid';
    END IF;
  END LOOP;

  DELETE FROM public.asset_legal_consultation_items WHERE consultation_id = _consultation.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_idx := v_idx + 1;
    SELECT COALESCE(array_agg(x), '{}') INTO v_docs
      FROM jsonb_array_elements_text(COALESCE(v_item->'doc_paths', '[]'::jsonb)) AS x;
    INSERT INTO public.asset_legal_consultation_items
      (consultation_id, sort_order, template_key, label, status, expert_note, required_action, doc_paths)
    VALUES
      (_consultation.id, v_idx,
       NULLIF(btrim(COALESCE(v_item->>'template_key', '')), ''),
       btrim(v_item->>'label'),
       NULLIF(v_item->>'status', ''),
       left(NULLIF(btrim(COALESCE(v_item->>'expert_note', '')), ''), 2000),
       left(NULLIF(btrim(COALESCE(v_item->>'required_action', '')), ''), 2000),
       v_docs);
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._legal_consult_service_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._legal_consult_replace_items(public.asset_legal_consultations, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- Đối tác có hợp đồng hiệu lực cho dịch vụ này (admin chọn khi báo giá).
CREATE OR REPLACE FUNCTION public.legal_consult_partners()
RETURNS TABLE (supplier_id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.id, sp.name
    FROM public.suppliers sp
   WHERE sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, public._legal_consult_service_id(), NULL, CURRENT_DATE))
   ORDER BY sp.name;
$$;

CREATE OR REPLACE FUNCTION public.legal_consult_package()
RETURNS TABLE (variant_id UUID, variant_key TEXT, name TEXT, from_price NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.variant_key, v.name, v.price
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE s.id = public._legal_consult_service_id() AND s.is_active AND v.is_active
   ORDER BY v.sort_order, v.name
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.legal_consult_partners() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.legal_consult_package()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_consult_partners() TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_consult_package()  TO authenticated;

-- ─── 5. Người bán: gửi yêu cầu / huỷ ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_request_legal_consult(
  _posting_id UUID,
  _doc_paths  TEXT[],
  _note       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_var     public.service_variants%ROWTYPE;
  v_docs    TEXT[];
  v_active  UUID;
  v_row     public.asset_legal_consultations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
   WHERE v.variant_key = 'tvpl_review' AND v.service_id = public._legal_consult_service_id() AND v.is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(p)), '{}') INTO v_docs
    FROM unnest(COALESCE(_doc_paths, '{}')) AS p WHERE btrim(p) <> '';
  IF cardinality(v_docs) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'docs_required');
  END IF;
  IF cardinality(v_docs) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_docs');
  END IF;
  -- Chỉ tệp CỦA MÌNH, đã thực sự nằm trong bucket private asset-docs.
  IF EXISTS (SELECT 1 FROM unnest(v_docs) AS p
              WHERE p NOT LIKE v_uid::text || '/%'
                 OR NOT EXISTS (SELECT 1 FROM storage.objects o
                                 WHERE o.bucket_id = 'asset-docs' AND o.name = p)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'doc_invalid');
  END IF;

  SELECT id INTO v_active FROM public.asset_legal_consultations
   WHERE asset_posting_id = _posting_id AND status IN ('requested', 'quoted', 'paid', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'consultation_id', v_active);
  END IF;

  INSERT INTO public.asset_legal_consultations
    (asset_posting_id, user_id, service_variant_id, posting_title, parent_slug, package_name,
     submitted_doc_paths, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_posting.parent_slug, v_var.name,
     v_docs, left(NULLIF(btrim(_note), ''), 2000))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'consultation_id', v_row.id, 'code', v_row.code);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_cancel_legal_consult(_consultation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_legal_consultations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations
   WHERE id = _consultation_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_legal_consultations
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_request_legal_consult(UUID, TEXT[], TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cancel_legal_consult(UUID)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_request_legal_consult(UUID, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_legal_consult(UUID)               TO authenticated;

-- ─── 6. Admin (thay đối tác): báo giá + phân công / huỷ ──────────────────────

CREATE OR REPLACE FUNCTION public.admin_quote_legal_consult(
  _consultation_id UUID,
  _supplier_id     UUID,
  _expert_name     TEXT,
  _price           NUMERIC,
  _note            TEXT,
  _valid_days      INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row     public.asset_legal_consultations%ROWTYPE;
  v_partner TEXT;
  v_terms   RECORD;
BEGIN
  IF NOT public.admin_has_permission('tu-van-phap-ly', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF length(btrim(COALESCE(_expert_name, ''))) < 2 OR length(_expert_name) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expert_required');
  END IF;
  IF _price IS NULL OR _price <= 0 OR _price <> round(_price) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
  END IF;
  IF _valid_days IS NULL OR _valid_days < 1 OR _valid_days > 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_validity');
  END IF;

  SELECT sp.name INTO v_partner FROM public.suppliers sp WHERE sp.id = _supplier_id AND sp.status = 'active';
  IF v_partner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'partner_unavailable');
  END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    _supplier_id, public._legal_consult_service_id(), v_row.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > _price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  UPDATE public.asset_legal_consultations
     SET status = 'quoted', supplier_id = _supplier_id, partner_name = v_partner,
         expert_name = btrim(_expert_name),
         quoted_price = _price, quote_note = NULLIF(btrim(_note), ''),
         quoted_at = now(), quote_expires_at = now() + make_interval(days => _valid_days),
         quoted_by = auth.uid()
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_legal_consult(_consultation_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_legal_consultations%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('tu-van-phap-ly', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.asset_legal_consultations
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = btrim(_reason)
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quote_legal_consult(UUID, UUID, TEXT, NUMERIC, TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_legal_consult(UUID, TEXT)                         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quote_legal_consult(UUID, UUID, TEXT, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_legal_consult(UUID, TEXT)                         TO authenticated;

-- ─── 7. Thanh toán (mô phỏng VNPay, cùng khuôn giám định) ─────────────────────

CREATE OR REPLACE FUNCTION public._settle_legal_consult(
  _consultation_id UUID,
  _txn_ref         TEXT,
  _expected_amount NUMERIC,
  _uid             UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row   public.asset_legal_consultations%ROWTYPE;
  v_claim TEXT;
BEGIN
  IF _uid IS NULL OR btrim(COALESCE(_txn_ref, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;

  SELECT * INTO v_row FROM public.asset_legal_consultations
   WHERE id = _consultation_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_row.payment_txn_ref = btrim(_txn_ref) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'consultation_id', v_row.id,
                              'code', v_row.code, 'posting_id', v_row.asset_posting_id);
  END IF;
  IF v_row.status <> 'quoted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF v_row.quote_expires_at IS NOT NULL AND v_row.quote_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_expired');
  END IF;
  IF _expected_amount IS DISTINCT FROM v_row.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  SELECT btrim(_txn_ref), _uid, v.variant_key, 'tvpl_order:' || v_row.id
    FROM public.service_variants v WHERE v.id = v_row.service_variant_id
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  UPDATE public.asset_legal_consultations
     SET status = 'paid', paid_at = now(), payment_txn_ref = btrim(_txn_ref)
   WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'consultation_id', v_row.id, 'code', v_row.code,
                            'posting_id', v_row.asset_posting_id);
END;
$$;

REVOKE ALL ON FUNCTION public._settle_legal_consult(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: người bán tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_legal_consult(_consultation_id UUID, _txn_ref TEXT, _expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_legal_consult(_consultation_id, _txn_ref, _expected_amount, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.pay_legal_consult(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_legal_consult(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── 8. Admin: bắt đầu rà soát / lưu nháp checklist / hoàn tất ───────────────

CREATE OR REPLACE FUNCTION public.admin_start_legal_consult(_consultation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_legal_consultations%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('tu-van-phap-ly', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'in_review' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_legal_consultations
     SET status = 'in_review', review_started_at = now()
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_legal_consult_checklist(_consultation_id UUID, _items JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_legal_consultations%ROWTYPE;
  v_err TEXT;
BEGIN
  IF NOT public.admin_has_permission('tu-van-phap-ly', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status <> 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  v_err := public._legal_consult_replace_items(v_row, _items, false);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_legal_consult(
  _consultation_id UUID,
  _items           JSONB,
  _summary         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row     public.asset_legal_consultations%ROWTYPE;
  v_svc     UUID := public._legal_consult_service_id();
  v_terms   RECORD;
  v_err     TEXT;
  v_ledger  UUID;
  v_version INT;
BEGIN
  IF NOT public.admin_has_permission('tu-van-phap-ly', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status IN ('completed', 'superseded') THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'version', v_row.version);
  END IF;
  IF v_row.status <> 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF length(btrim(COALESCE(_summary, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'summary_required');
  END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    v_row.supplier_id, v_svc, v_row.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > v_row.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  v_err := public._legal_consult_replace_items(v_row, _items, true);
  IF v_err IS NOT NULL THEN
    -- RETURN không rollback: DELETE/INSERT chỉ chạy khi kiểm xong, nên lỗi ở đây chưa ghi gì.
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;

  -- Khoá hồ sơ để hai lần hoàn tất song song không giành cùng một số phiên bản.
  PERFORM 1 FROM public.asset_postings WHERE id = v_row.asset_posting_id FOR UPDATE;
  SELECT COALESCE(max(version), 0) + 1 INTO v_version
    FROM public.asset_legal_consultations WHERE asset_posting_id = v_row.asset_posting_id;

  INSERT INTO public.orders (
    user_id, service_id, service_variant_id, quantity, amount, gross_amount,
    supplier_id, commission_type, commission_value, contract_id, contract_line_id,
    fulfillment_status, ordered_at, fulfilled_at, note, created_by
  ) VALUES (
    v_row.user_id, v_svc, v_row.service_variant_id, 1, 0, v_row.quoted_price,
    v_row.supplier_id, v_terms.commission_type, v_terms.commission_value,
    v_terms.contract_id, v_terms.line_id,
    'fulfilled', COALESCE(v_row.paid_at, now()), now(),
    'Tư vấn pháp lý ' || v_row.code || ' · ' || left(v_row.posting_title, 80) || ' · ' || v_row.partner_name,
    auth.uid()
  )
  RETURNING id INTO v_ledger;

  -- Kết luận cũ nhường chỗ — trước khi hoàn tất lần mới để khỏi đụng unique.
  UPDATE public.asset_legal_consultations
     SET status = 'superseded', superseded_at = now()
   WHERE asset_posting_id = v_row.asset_posting_id AND status = 'completed';

  -- BR-CNS-01: chỉ ghi dòng tư vấn. KHÔNG đụng asset_postings.
  UPDATE public.asset_legal_consultations
     SET status = 'completed', version = v_version, summary = btrim(_summary),
         completed_at = now(), completed_by = auth.uid(), commission_order_id = v_ledger
   WHERE id = _consultation_id;

  RETURN jsonb_build_object('ok', true, 'version', v_version, 'commission_order_id', v_ledger);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_start_legal_consult(UUID)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_legal_consult_checklist(UUID, JSONB)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_complete_legal_consult(UUID, JSONB, TEXT)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_start_legal_consult(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_legal_consult_checklist(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_legal_consult(UUID, JSONB, TEXT) TO authenticated;

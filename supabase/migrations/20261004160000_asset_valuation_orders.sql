-- Thẩm định giá qua sàn cho hồ sơ số hoá (tab "Thẩm định giá" ?tab=tham-dinh + bước 4 wizard).
--
-- Vì sao: trước đây "Thẩm định" gộp thẩm định giá + giám định thành MỘT dịch vụ, mà nhánh
-- "Dịch vụ của sàn" thực chất đặt đơn GIÁM ĐỊNH. Nay tách thành 3 dịch vụ riêng: Thẩm định
-- giá · Giám định · Tư vấn pháp lý. Bảng này là đơn thẩm định giá của sàn.
--
-- ĐẶT TÊN: 'valuation' — KHÔNG 'appraisal' (asset_postings.pricing_mode = 'appraisal' là "nhờ
-- tổ chức đấu giá định giá", asset_posting_dossier_items.kind = 'appraisal' là kết quả của
-- đối tác RIÊNG) và KHÔNG 'authentication' (giám định).
--
-- Luồng (cùng khuôn Tư vấn pháp lý 20260915000030): người bán gửi yêu cầu (mục đích, địa
-- chỉ khảo sát) → requested → admin báo giá THAY đối tác (gán đơn vị + thẩm định viên;
-- quoted) → người bán đồng ý HDCU + trả VNPay mô phỏng (paid) → admin bắt đầu (in_review)
-- → admin nhập giá trị + hiệu lực + tải chứng thư PDF (completed, GHI HOA HỒNG). Thẩm định
-- lại ⇒ yêu cầu MỚI; kết quả cũ thành superseded.
--
-- @BR-TDG-01 Chứng thư CHỈ vào qua admin_complete_valuation (quyền tham-dinh-gia:update),
--   tệp phải thực sự nằm trong bucket private asset-valuation-certs đúng thư mục của đơn.
-- @BR-TDG-02 Đọc: người có quyền đọc hồ sơ (owner_posting_can read), admin tham-dinh-gia:view
--   hoặc tai-san-tu-nguyen:view. Không policy ghi. Giá trị KHÔNG công khai ở v1.
-- @BR-TDG-03 Kết quả mang tính tham khảo: không RPC/trigger nào ở đây ghi asset_postings, không
--   cổng chặn nộp hồ sơ / đưa vào phiên. Giá khởi điểm chỉ đổi khi người bán tự bấm dùng.
-- @BR-TDG-04 Sổ cái orders ghi MỘT dòng lúc hoàn tất; điều khoản tra resolve_contract_terms.
-- @BR-TDG-05 Hiệu lực mặc định 6 tháng kể từ ngày thẩm định (khớp APPRAISAL_VALIDITY_MONTHS);
--   mỗi hồ sơ tối đa 1 đơn đang chạy + 1 kết quả hiện hành.

-- ─── 1. Catalog: dịch vụ + gói (id CỐ ĐỊNH — tra theo id, đổi tên không gãy) ───────

INSERT INTO public.services
  (id, name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
VALUES ('a1d90000-0000-4000-8000-000000000001', 'Thẩm định giá hồ sơ tài sản', 'commission', 'brokerage',
        'owner', 0, 'per_order',
        'Đơn vị thẩm định giá đối tác của sàn khảo sát và định giá tài sản số hoá, cấp chứng thư thẩm định giá (PDF) kèm giá trị và thời hạn hiệu lực. Giá theo báo giá từng đơn; sàn hưởng hoa hồng theo hợp đồng hợp tác đang hiệu lực.',
        true, 36)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
VALUES ('a1d90000-0000-4000-8000-000000000001', 'tdg_valuation', 'Thẩm định giá tài sản', 3000000::numeric, true, 1)
ON CONFLICT (variant_key) DO NOTHING;

-- Đối tác: dùng lại "Công ty CP Thẩm định giá Miền Nam" (seed CRM 20260719000004). Hợp đồng +
-- tỉ lệ là GIÁ TRỊ GIỮ CHỖ, admin sửa ở module Hợp đồng hợp tác.
INSERT INTO public.supplier_contracts
  (id, supplier_id, contract_no, title, signed_date, effective_from, effective_to, status, note)
SELECT 'a1d90000-0000-4000-8000-000000000002', sp.id,
       '04/2026/HĐHT-TDG', 'Hợp tác cung cấp dịch vụ thẩm định giá hồ sơ', DATE '2026-10-01',
       DATE '2026-10-01', DATE '2027-09-30', 'active', '[tdg-seed] Tỉ lệ giữ chỗ — cập nhật theo hợp đồng thật'
  FROM public.suppliers sp
 WHERE sp.id = '50cc0001-0000-4000-8000-000000000002'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contract_lines
  (id, contract_id, service_id, service_variant_id, commission_type, commission_value, note)
SELECT 'a1d90000-0000-4000-8000-000000000003', c.id,
       'a1d90000-0000-4000-8000-000000000001', NULL, 'percent', 15, 'Áp cho mọi gói thẩm định giá'
  FROM public.supplier_contracts c
 WHERE c.id = 'a1d90000-0000-4000-8000-000000000002'
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Bảng đơn thẩm định giá ───────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_valuation_order_code_seq START 1;

CREATE TABLE public.asset_valuation_orders (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT          NOT NULL UNIQUE
                         DEFAULT ('TDG' || lpad(nextval('public.asset_valuation_order_code_seq')::text, 6, '0')),
  asset_posting_id     UUID          NOT NULL REFERENCES public.asset_postings(id) ON DELETE RESTRICT,
  user_id              UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_variant_id   UUID          NOT NULL REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  posting_title        TEXT          NOT NULL,
  parent_slug          TEXT,
  package_name         TEXT          NOT NULL,

  purpose              TEXT          NOT NULL DEFAULT 'auction'
                         CHECK (purpose IN ('auction', 'mortgage', 'transfer', 'other')),
  site_address         TEXT          CHECK (length(site_address) <= 500),
  request_note         TEXT          CHECK (length(request_note) <= 2000),

  status               TEXT          NOT NULL DEFAULT 'requested'
                         CHECK (status IN ('requested', 'quoted', 'paid', 'in_review',
                                           'completed', 'superseded', 'cancelled')),

  -- Đơn vị + thẩm định viên được phân công (gán lúc báo giá).
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

  -- Kết quả
  appraised_value      NUMERIC(18,0) CHECK (appraised_value > 0),
  valuation_date       DATE,
  valid_until          DATE,
  method               TEXT          CHECK (method IN ('comparison', 'cost', 'income', 'mixed')),
  summary              TEXT          CHECK (length(summary) <= 4000),
  certificate_path     TEXT          CHECK (length(certificate_path) <= 1000),
  certificate_no       TEXT          CHECK (length(certificate_no) <= 200),
  completed_at         TIMESTAMPTZ,
  completed_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  commission_order_id  UUID          UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  superseded_at        TIMESTAMPTZ,

  cancelled_at         TIMESTAMPTZ,
  cancelled_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason        TEXT          CHECK (length(cancel_reason) <= 2000),

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tdg_quoted_shape CHECK (
    status IN ('requested', 'cancelled')
    OR (quoted_price IS NOT NULL AND quoted_at IS NOT NULL AND supplier_id IS NOT NULL
        AND partner_name IS NOT NULL AND expert_name IS NOT NULL)),
  CONSTRAINT tdg_paid_shape CHECK (
    status IN ('requested', 'quoted', 'cancelled') OR (paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL)),
  CONSTRAINT tdg_cancel_unpaid CHECK (status <> 'cancelled' OR paid_at IS NULL),
  CONSTRAINT tdg_review_shape CHECK (
    status NOT IN ('in_review', 'completed', 'superseded') OR review_started_at IS NOT NULL),
  CONSTRAINT tdg_completed_shape CHECK (
    status NOT IN ('completed', 'superseded')
    OR (appraised_value IS NOT NULL AND valuation_date IS NOT NULL AND valid_until IS NOT NULL
        AND certificate_path IS NOT NULL AND completed_at IS NOT NULL AND commission_order_id IS NOT NULL)),
  CONSTRAINT tdg_result_only_when_done CHECK (
    appraised_value IS NULL OR status IN ('completed', 'superseded')),
  CONSTRAINT tdg_valid_after_date CHECK (
    valid_until IS NULL OR valuation_date IS NULL OR valid_until >= valuation_date)
);

COMMENT ON TABLE public.asset_valuation_orders IS
  'Đơn thẩm định giá qua sàn của hồ sơ số hoá. Ghi CHỈ qua RPC. Kết quả tham khảo — KHÔNG đổi hồ sơ (BR-TDG-03).';

CREATE UNIQUE INDEX uq_tdg_active_per_posting
  ON public.asset_valuation_orders (asset_posting_id)
  WHERE status IN ('requested', 'quoted', 'paid', 'in_review');
CREATE UNIQUE INDEX uq_tdg_completed_per_posting
  ON public.asset_valuation_orders (asset_posting_id) WHERE status = 'completed';

CREATE INDEX idx_tdg_posting  ON public.asset_valuation_orders (asset_posting_id, created_at DESC);
CREATE INDEX idx_tdg_status   ON public.asset_valuation_orders (status, created_at DESC);
CREATE INDEX idx_tdg_user     ON public.asset_valuation_orders (user_id);
CREATE INDEX idx_tdg_supplier ON public.asset_valuation_orders (supplier_id);

CREATE TRIGGER asset_valuation_orders_updated_at
  BEFORE UPDATE ON public.asset_valuation_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.asset_valuation_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asset_valuation_orders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.asset_valuation_orders FROM authenticated;

-- BR-TDG-02
CREATE POLICY asset_valuation_orders_owner_read
  ON public.asset_valuation_orders FOR SELECT
  USING (public.owner_posting_can(asset_posting_id, 'read'));

CREATE POLICY asset_valuation_orders_admin_read
  ON public.asset_valuation_orders FOR SELECT
  USING (public.admin_has_permission('tham-dinh-gia', 'view')
         OR public.admin_has_permission('tai-san-tu-nguyen', 'view'));

-- ─── 3. Nội bộ + catalog ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._valuation_service_id()
RETURNS UUID
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$ SELECT 'a1d90000-0000-4000-8000-000000000001'::uuid $$;

-- Đơn vị có hợp đồng hiệu lực cho dịch vụ này (admin chọn khi báo giá).
CREATE OR REPLACE FUNCTION public.valuation_partners()
RETURNS TABLE (supplier_id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.id, sp.name
    FROM public.suppliers sp
   WHERE sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, public._valuation_service_id(), NULL, CURRENT_DATE))
   ORDER BY sp.name;
$$;

CREATE OR REPLACE FUNCTION public.valuation_package()
RETURNS TABLE (variant_id UUID, variant_key TEXT, name TEXT, from_price NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.variant_key, v.name, v.price
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE s.id = public._valuation_service_id() AND s.is_active AND v.is_active
   ORDER BY v.sort_order, v.name
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._valuation_service_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valuation_partners()    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valuation_package()     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._valuation_service_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.valuation_partners()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.valuation_package()     TO authenticated;

-- ─── 4. Người bán: gửi yêu cầu / huỷ ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_request_valuation(
  _posting_id   UUID,
  _purpose      TEXT,
  _site_address TEXT,
  _note         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_var     public.service_variants%ROWTYPE;
  v_active  UUID;
  v_row     public.asset_valuation_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;
  IF _purpose IS NULL OR _purpose NOT IN ('auction', 'mortgage', 'transfer', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_purpose');
  END IF;
  IF length(COALESCE(_site_address, '')) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'address_too_long');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE v.variant_key = 'tdg_valuation' AND s.id = public._valuation_service_id()
     AND s.is_active AND v.is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT id INTO v_active FROM public.asset_valuation_orders
   WHERE asset_posting_id = _posting_id AND status IN ('requested', 'quoted', 'paid', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'order_id', v_active);
  END IF;

  INSERT INTO public.asset_valuation_orders
    (asset_posting_id, user_id, service_variant_id, posting_title, parent_slug, package_name,
     purpose, site_address, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_posting.parent_slug, v_var.name,
     _purpose, NULLIF(btrim(_site_address), ''), left(NULLIF(btrim(_note), ''), 2000))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'order_id', v_row.id, 'code', v_row.code);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_cancel_valuation(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_valuation_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_valuation_orders
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_valuation_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_request_valuation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cancel_valuation(UUID)                    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_request_valuation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_valuation(UUID)                    TO authenticated;

-- ─── 5. Admin (thay đối tác): báo giá + phân công / huỷ / bắt đầu ────────────

CREATE OR REPLACE FUNCTION public.admin_quote_valuation(
  _order_id    UUID,
  _supplier_id UUID,
  _expert_name TEXT,
  _price       NUMERIC,
  _note        TEXT,
  _valid_days  INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row     public.asset_valuation_orders%ROWTYPE;
  v_partner TEXT;
  v_terms   RECORD;
BEGIN
  IF NOT public.admin_has_permission('tham-dinh-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_valuation_orders WHERE id = _order_id FOR UPDATE;
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
    _supplier_id, public._valuation_service_id(), v_row.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > _price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  UPDATE public.asset_valuation_orders
     SET status = 'quoted', supplier_id = _supplier_id, partner_name = v_partner,
         expert_name = btrim(_expert_name),
         quoted_price = _price, quote_note = NULLIF(btrim(_note), ''),
         quoted_at = now(), quote_expires_at = now() + make_interval(days => _valid_days),
         quoted_by = auth.uid()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_valuation(_order_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_valuation_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('tham-dinh-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_valuation_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.asset_valuation_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = btrim(_reason)
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_start_valuation(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_valuation_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('tham-dinh-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_valuation_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'in_review' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_valuation_orders
     SET status = 'in_review', review_started_at = now()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quote_valuation(UUID, UUID, TEXT, NUMERIC, TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_valuation(UUID, TEXT)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_start_valuation(UUID)                                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quote_valuation(UUID, UUID, TEXT, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_valuation(UUID, TEXT)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_valuation(UUID)                                TO authenticated;

-- ─── 6. Thanh toán (mô phỏng VNPay, cùng khuôn tư vấn pháp lý) ────────────────

CREATE OR REPLACE FUNCTION public._settle_valuation_order(
  _order_id        UUID,
  _txn_ref         TEXT,
  _expected_amount NUMERIC,
  _uid             UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row   public.asset_valuation_orders%ROWTYPE;
  v_claim TEXT;
BEGIN
  IF _uid IS NULL OR btrim(COALESCE(_txn_ref, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;

  SELECT * INTO v_row FROM public.asset_valuation_orders
   WHERE id = _order_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_row.payment_txn_ref = btrim(_txn_ref) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'order_id', v_row.id,
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
  SELECT btrim(_txn_ref), _uid, v.variant_key, 'tdg_order:' || v_row.id
    FROM public.service_variants v WHERE v.id = v_row.service_variant_id
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  UPDATE public.asset_valuation_orders
     SET status = 'paid', paid_at = now(), payment_txn_ref = btrim(_txn_ref)
   WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'order_id', v_row.id, 'code', v_row.code,
                            'posting_id', v_row.asset_posting_id);
END;
$$;

REVOKE ALL ON FUNCTION public._settle_valuation_order(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: người bán tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_valuation_order(_order_id UUID, _txn_ref TEXT, _expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_valuation_order(_order_id, _txn_ref, _expected_amount, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.pay_valuation_order(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_valuation_order(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── 7. Admin: nhập kết quả + chứng thư THAY đối tác (BR-TDG-01/03/04/05) ─────

CREATE OR REPLACE FUNCTION public.admin_complete_valuation(
  _order_id         UUID,
  _value            NUMERIC,
  _valuation_date   DATE,
  _valid_until      DATE,
  _method           TEXT,
  _summary          TEXT,
  _certificate_path TEXT,
  _certificate_no   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row    public.asset_valuation_orders%ROWTYPE;
  v_path   TEXT := btrim(COALESCE(_certificate_path, ''));
  v_svc    UUID := public._valuation_service_id();
  v_until  DATE;
  v_terms  RECORD;
  v_ledger UUID;
BEGIN
  IF NOT public.admin_has_permission('tham-dinh-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_valuation_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status IN ('completed', 'superseded') AND v_row.certificate_path = v_path THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status <> 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF _value IS NULL OR _value <= 0 OR _value <> round(_value) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_value');
  END IF;
  IF _valuation_date IS NULL OR _valuation_date > public.contract_today() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_valuation_date');
  END IF;
  v_until := COALESCE(_valid_until, (_valuation_date + interval '6 months')::date);
  IF v_until < _valuation_date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_valid_until');
  END IF;
  IF _method IS NOT NULL AND _method NOT IN ('comparison', 'cost', 'income', 'mixed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_method');
  END IF;
  -- Chứng thư phải nằm đúng thư mục của đơn VÀ đã thực sự được tải lên bucket (BR-TDG-01).
  IF v_path NOT LIKE v_row.asset_posting_id::text || '/' || v_row.id::text || '/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects
                     WHERE bucket_id = 'asset-valuation-certs' AND name = v_path) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'certificate_missing');
  END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    v_row.supplier_id, v_svc, v_row.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > v_row.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  INSERT INTO public.orders (
    user_id, service_id, service_variant_id, quantity, amount, gross_amount,
    supplier_id, commission_type, commission_value, contract_id, contract_line_id,
    fulfillment_status, ordered_at, fulfilled_at, note, created_by
  ) VALUES (
    v_row.user_id, v_svc, v_row.service_variant_id, 1, 0, v_row.quoted_price,
    v_row.supplier_id, v_terms.commission_type, v_terms.commission_value,
    v_terms.contract_id, v_terms.line_id,
    'fulfilled', COALESCE(v_row.paid_at, now()), now(),
    'Thẩm định giá ' || v_row.code || ' · ' || left(v_row.posting_title, 80) || ' · ' || v_row.partner_name,
    auth.uid()
  )
  RETURNING id INTO v_ledger;

  -- Kết quả cũ nhường chỗ — trước khi hoàn tất đơn mới để khỏi đụng unique.
  UPDATE public.asset_valuation_orders
     SET status = 'superseded', superseded_at = now()
   WHERE asset_posting_id = v_row.asset_posting_id AND status = 'completed';

  -- BR-TDG-03: chỉ ghi dòng đơn. KHÔNG đụng asset_postings.
  UPDATE public.asset_valuation_orders
     SET status = 'completed', appraised_value = _value, valuation_date = _valuation_date,
         valid_until = v_until, method = _method, summary = NULLIF(btrim(_summary), ''),
         certificate_path = v_path, certificate_no = NULLIF(btrim(_certificate_no), ''),
         completed_at = now(), completed_by = auth.uid(), commission_order_id = v_ledger
   WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true, 'commission_order_id', v_ledger);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_valuation(UUID, NUMERIC, DATE, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_valuation(UUID, NUMERIC, DATE, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 8. Bucket chứng thư (PRIVATE) ───────────────────────────────────────────
-- Đường dẫn {posting_id}/{order_id}/{file}. Mở bằng createSignedUrl.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('asset-valuation-certs', 'asset-valuation-certs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.valuation_cert_readable(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.admin_has_permission('tham-dinh-gia', 'view')
      OR public.admin_has_permission('tai-san-tu-nguyen', 'view')
      OR EXISTS (SELECT 1 FROM public.asset_valuation_orders o
                  WHERE o.certificate_path = _name AND public.owner_posting_can(o.asset_posting_id, 'read'));
$$;

REVOKE ALL ON FUNCTION public.valuation_cert_readable(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valuation_cert_readable(TEXT) TO authenticated;

DROP POLICY IF EXISTS "asset_valuation_certs_read"   ON storage.objects;
DROP POLICY IF EXISTS "asset_valuation_certs_insert" ON storage.objects;
DROP POLICY IF EXISTS "asset_valuation_certs_update" ON storage.objects;
DROP POLICY IF EXISTS "asset_valuation_certs_delete" ON storage.objects;

CREATE POLICY "asset_valuation_certs_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'asset-valuation-certs' AND public.valuation_cert_readable(name));

-- BR-TDG-01: CHỈ người vận hành đơn thẩm định giá (thay đối tác) ghi được. Người bán không.
CREATE POLICY "asset_valuation_certs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'asset-valuation-certs'
              AND public.admin_has_permission('tham-dinh-gia', 'update'));

CREATE POLICY "asset_valuation_certs_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-valuation-certs'
         AND public.admin_has_permission('tham-dinh-gia', 'update'));

CREATE POLICY "asset_valuation_certs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'asset-valuation-certs'
         AND public.admin_has_permission('tham-dinh-gia', 'update'));

-- ─── 9. Nhật ký hoạt động: chép bản LIVE owner_audit_row() + thêm asset_valuation_orders ──

CREATE OR REPLACE FUNCTION public.owner_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _module  TEXT := NULLIF(TG_ARGV[0], '');
  _new     JSONB;
  _old     JSONB;
  _r       JSONB;
  _action  TEXT := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  _changes JSONB;
  _ws      UUID;
  _subject UUID;
  _branch  UUID;
  _label   TEXT;
  _eid     TEXT;
  _meta    JSONB := '{}'::JSONB;
  _pid     UUID;
  _name    TEXT;
  _name2   TEXT;
BEGIN
  IF TG_OP <> 'DELETE' THEN _new := to_jsonb(NEW); END IF;
  IF TG_OP <> 'INSERT' THEN _old := to_jsonb(OLD); END IF;
  _r := COALESCE(_new, _old);
  _eid := _r ->> 'id';

  _changes := public.owner_audit_diff(_old, _new);
  IF TG_TABLE_NAME = 'owner_ws_roles' AND TG_OP = 'UPDATE' THEN
    _changes := _changes || public.owner_audit_take_perm_change((_r ->> 'id')::UUID);
  END IF;
  IF TG_OP = 'UPDATE' AND _changes = '{}'::JSONB THEN
    RETURN NULL;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'asset_postings' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _subject := (_r ->> 'user_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := concat_ws(' · ', _r ->> 'code', _r ->> 'title');
      _meta := jsonb_build_object('posting_id', _eid);

    WHEN 'asset_posting_dossier_items', 'posting_share_links', 'craft_village_publications', 'asset_3d_scans',
         'asset_vr_tour_orders', 'asset_authentication_orders', 'asset_legal_consultations',
         'asset_auction_consultations', 'service_contracts', 'asset_service_requests',
         'asset_broker_requests', 'consignment_contracts', 'asset_valuation_orders' THEN
      _pid := COALESCE(_r ->> 'asset_posting_id', _r ->> 'posting_id')::UUID;
      SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', p.code, p.title)
        INTO _ws, _subject, _branch, _label
        FROM public.asset_postings p WHERE p.id = _pid;
      -- Hồ sơ cha đã bị xoá (xoá dây chuyền): dòng xoá hồ sơ đã đủ.
      IF NOT FOUND THEN RETURN NULL; END IF;
      IF _r ->> 'code' IS NOT NULL THEN
        _label := concat_ws(' · ', _r ->> 'code', _label);
      END IF;
      IF TG_TABLE_NAME = 'asset_service_requests' THEN
        SELECT o.name INTO _name FROM public.auction_organizations o WHERE o.id = (_r ->> 'auction_org_id')::UUID;
        IF _name IS NOT NULL THEN _label := _label || ' — ' || _name; END IF;
      END IF;
      IF TG_TABLE_NAME = 'craft_village_publications' THEN _eid := _pid::TEXT; END IF;
      _meta := jsonb_build_object('posting_id', _pid);

    WHEN 'auction_sale_contracts' THEN
      SELECT p.workspace_id, p.user_id, p.branch_id, concat_ws(' · ', p.code, p.title), p.id
        INTO _ws, _subject, _branch, _label, _pid
        FROM public.consignment_contracts c
        JOIN public.asset_postings p ON p.id = c.asset_posting_id
       WHERE c.id = (_r ->> 'consignment_contract_id')::UUID;
      IF NOT FOUND THEN RETURN NULL; END IF;
      _label := concat_ws(' · ', _r ->> 'code', _label);
      _meta := jsonb_build_object('posting_id', _pid);

    WHEN 'asset_owner_claims' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT b.id INTO _branch FROM public.workspace_branches b
       WHERE b.workspace_id = _ws AND b.asset_owner_id = (_r ->> 'asset_owner_id')::UUID LIMIT 1;
      SELECT l.title INTO _label FROM public.listings l WHERE l.id = (_r ->> 'listing_id')::UUID;
      _label := COALESCE(_label, _r ->> 'matched_name');
      _meta := jsonb_build_object('listing_id', _r ->> 'listing_id');

    WHEN 'owner_asset_outcomes' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := _r ->> 'asset_title';
      _meta := jsonb_strip_nulls(jsonb_build_object('posting_id', _r ->> 'asset_posting_id', 'listing_id', _r ->> 'listing_id'));

    WHEN 'owner_cash_events' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT o.branch_id, o.asset_title INTO _branch, _label
        FROM public.owner_asset_outcomes o WHERE o.id = (_r ->> 'outcome_id')::UUID;
      IF NOT FOUND AND TG_OP = 'DELETE' THEN RETURN NULL; END IF;
      _meta := jsonb_build_object('outcome_id', _r ->> 'outcome_id');

    WHEN 'owner_mkt_campaigns' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := _r ->> 'name';

    WHEN 'owner_mkt_links' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := COALESCE(NULLIF(_r ->> 'label', ''), _r ->> 'code');

    WHEN 'owner_report_snapshots' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := public.owner_audit_period_label(_r ->> 'period_type', (_r ->> 'period_start')::DATE);

    WHEN 'owner_workspace_targets' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'branch_id')::UUID;
      _label := COALESCE(NULLIF(_r ->> 'name', ''),
                         public.owner_audit_period_label(_r ->> 'period_type', (_r ->> 'period_start')::DATE));

    WHEN 'owner_workspace_target_criteria' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT t.branch_id, COALESCE(NULLIF(t.name, ''), public.owner_audit_period_label(t.period_type, t.period_start))
        INTO _branch, _label
        FROM public.owner_workspace_targets t WHERE t.id = (_r ->> 'target_id')::UUID;
      IF NOT FOUND THEN RETURN NULL; END IF;
      _meta := jsonb_build_object('target_id', _r ->> 'target_id');

    WHEN 'workspace_branches' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _branch := (_r ->> 'id')::UUID;
      _label := _r ->> 'display_name';

    WHEN 'asset_owner_workspaces' THEN
      _ws := (_r ->> 'id')::UUID;
      _label := _r ->> 'primary_name';
      IF _changes ? 'parent_workspace_id' OR _changes ? 'parent_linked_at' THEN
        _module := 'lien-ket';
      END IF;

    WHEN 'asset_owner_workspace_members' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      SELECT COALESCE(NULLIF(btrim(p.name), ''), p.email) INTO _label
        FROM public.profiles p WHERE p.id = (_r ->> 'user_id')::UUID;

    WHEN 'asset_owner_workspace_invites' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _label := _r ->> 'email';

    WHEN 'owner_ws_roles' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _label := _r ->> 'name';

    WHEN 'owner_subscriptions' THEN
      _ws := (_r ->> 'workspace_id')::UUID;
      _label := concat_ws(' · ', _r ->> 'code', _r ->> 'plan_name');

    WHEN 'owner_workspace_link_requests' THEN
      -- Ghi vào CẢ HAI Trạm.
      SELECT w.primary_name INTO _name FROM public.asset_owner_workspaces w WHERE w.id = (_r ->> 'parent_workspace_id')::UUID;
      SELECT w.primary_name INTO _name2 FROM public.asset_owner_workspaces w WHERE w.id = (_r ->> 'child_workspace_id')::UUID;
      _label := concat_ws(' ↔ ', _name, _name2);
      _changes := public.owner_audit_enrich(_changes);
      PERFORM public.owner_audit_write((_r ->> 'parent_workspace_id')::UUID, NULL, NULL, 'lien-ket', _action,
                                       TG_TABLE_NAME, _eid, _label, _changes, '{}'::JSONB, NULL);
      PERFORM public.owner_audit_write((_r ->> 'child_workspace_id')::UUID, NULL, NULL, 'lien-ket', _action,
                                       TG_TABLE_NAME, _eid, _label, _changes, '{}'::JSONB, NULL);
      RETURN NULL;

    ELSE
      RETURN NULL;
  END CASE;

  IF _ws IS NULL AND _subject IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.owner_audit_write(_ws, _subject, _branch, _module, _action, TG_TABLE_NAME, _eid, _label,
                                   public.owner_audit_enrich(_changes), _meta, NULL);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_audit_row(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$function$

;

CREATE TRIGGER owner_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_valuation_orders
  FOR EACH ROW EXECUTE FUNCTION public.owner_audit_row('so-hoa');

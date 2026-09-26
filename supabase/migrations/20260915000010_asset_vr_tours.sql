-- VR tour cho hồ sơ số hoá tài sản ("Thêm VR tour" → đối tác Silver Sea chụp + dựng tour).
--
-- Luồng (BR-VR-01): chủ tài sản yêu cầu (requested / "Chờ báo giá") → admin báo giá
-- thay đối tác (quoted / "Báo giá") → chủ trả qua VNPay mô phỏng (paid) → admin hẹn
-- lịch (scheduled) → admin dán link tour đối tác giao (delivered, GHI HOA HỒNG) →
-- admin có quyền duyệt tài sản gắn tour vào lô (attached, công khai).
--
-- "lô" = một dòng asset_postings; lot_id = asset_postings.id (cùng quyết định với 3D,
-- 20260915000001).
--
-- VÌ SAO BẢNG RIÊNG: review guard trên asset_postings nuốt ghi của mọi caller không có
-- quyền approve (kể cả SECURITY DEFINER) và đá hồ sơ đã duyệt về pending. Mọi RPC dưới
-- đây chỉ SELECT … FOR UPDATE hồ sơ, KHÔNG BAO GIỜ UPDATE nó.
--
-- DÒNG TIỀN (BR-VR-03): tiền tour là tiền CỦA đối tác, sàn thu hộ ⇒ dịch vụ kind
-- 'commission'. Sổ cái orders ghi ĐÚNG MỘT dòng lúc Đã giao (không phải lúc trả):
-- gross_amount = giá báo, amount (phần sàn) do trigger orders_sync_kind_and_commission
-- tính từ điều khoản hợp đồng đang hiệu lực tại ngày giao. Khoảng paid → delivered
-- tiền chỉ nằm ở bảng này + payment_claims; sổ công nợ sàn→đối tác CHƯA có (như hồ sơ
-- tham gia, 20260911000005).
--
-- ĐIỀU KHOẢN HOA HỒNG KHÔNG nằm trên bảng này: chủ tài sản đọc được dòng của mình, và
-- RLS lọc dòng chứ không che cột. Tên gói / đối tác được CHỤP vào bảng vì chủ không đọc
-- được services commission hay suppliers.
--
-- BR-VR-02: link công khai chỉ khi status='attached' + published_at, và published_at
--   bám review_status của hồ sơ (trigger, như 3D). Không tự gắn đơn delivered.
-- BR-VR-04: nhãn "VR" trong catalogue đọc qua public_session_lot_vr_tours.

-- ─── 1. Catalog: dịch vụ + gói ───────────────────────────────────────────────
-- per_order: người bán chọn đối tác trên từng đơn. Giá gói chỉ là giá THAM KHẢO "từ";
-- giá thật do admin báo cho từng đơn. Gói KHÔNG mang commission_type ⇒ đọc công khai
-- được mà không lộ biên hoa hồng.

INSERT INTO public.services
  (name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
SELECT 'VR tour tài sản', 'commission', 'brokerage', 'owner', 0, 'per_order',
       'Đối tác chụp và dựng VR tour cho tài sản số hoá. Giá theo báo giá từng đơn; sàn hưởng hoa hồng theo hợp đồng hợp tác đang hiệu lực.',
       true, 36
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'VR tour tài sản');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, v.key, v.name, v.price, true, v.sort
  FROM public.services s
 CROSS JOIN (VALUES
   ('vr_tour_basic',      'Cơ bản — tới 300 m²',                 5000000::numeric, 1),
   ('vr_tour_standard',   'Tiêu chuẩn — tới 1.000 m²',           12000000::numeric, 2),
   ('vr_tour_factory',    'Nhà xưởng / khu lớn — trên 1.000 m²', 25000000::numeric, 3),
   ('vr_tour_collection', 'Bộ sưu tập / showroom',               15000000::numeric, 4)
 ) AS v(key, name, price, sort)
 WHERE s.name = 'VR tour tài sản'
ON CONFLICT (variant_key) DO NOTHING;

-- ─── 2. Đối tác Silver Sea + hợp đồng hợp tác (giá trị giữ chỗ, admin sửa được) ──

INSERT INTO public.suppliers
  (id, name, supplier_type, default_commission_type, default_commission_rate, status, note)
VALUES ('5115ea00-0000-4000-8000-000000000001', 'Silver Sea', 'company', 'percent', 20, 'active',
        '[vr-seed] Đối tác chụp & dựng VR tour tài sản')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contracts
  (id, supplier_id, contract_no, title, signed_date, effective_from, effective_to, status, note)
VALUES ('5115ea00-0000-4000-8000-000000000002', '5115ea00-0000-4000-8000-000000000001',
        '01/2026/HĐHT-VR', 'Hợp tác cung cấp dịch vụ VR tour', DATE '2026-09-01', DATE '2026-09-01',
        DATE '2027-08-31', 'active', '[vr-seed] Tỉ lệ giữ chỗ — cập nhật theo hợp đồng thật')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contract_lines
  (id, contract_id, service_id, service_variant_id, commission_type, commission_value, note)
SELECT '5115ea00-0000-4000-8000-000000000003', '5115ea00-0000-4000-8000-000000000002',
       s.id, NULL, 'percent', 20, 'Áp cho mọi gói VR tour'
  FROM public.services s
 WHERE s.name = 'VR tour tài sản'
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Bảng đơn VR tour ─────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_vr_tour_order_code_seq START 1;

CREATE TABLE public.asset_vr_tour_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT          NOT NULL UNIQUE
                        DEFAULT ('VR' || lpad(nextval('public.asset_vr_tour_order_code_seq')::text, 6, '0')),
  -- RESTRICT: đơn đã thu tiền không được biến mất theo hồ sơ.
  asset_posting_id    UUID          NOT NULL REFERENCES public.asset_postings(id) ON DELETE RESTRICT,
  user_id             UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_variant_id  UUID          NOT NULL REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  supplier_id         UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  posting_title       TEXT          NOT NULL,
  package_name        TEXT          NOT NULL,
  partner_name        TEXT          NOT NULL,

  status              TEXT          NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'quoted', 'paid', 'scheduled', 'delivered',
                                          'attached', 'superseded', 'cancelled')),

  site_address        TEXT          CHECK (length(site_address) <= 2000),
  preferred_time      TEXT          CHECK (length(preferred_time) <= 2000),
  request_note        TEXT          CHECK (length(request_note) <= 2000),

  quoted_price        NUMERIC(18,0) CHECK (quoted_price > 0),
  quote_note          TEXT          CHECK (length(quote_note) <= 2000),
  quoted_at           TIMESTAMPTZ,
  quote_expires_at    TIMESTAMPTZ,
  quoted_by           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  payment_txn_ref     TEXT          UNIQUE,
  paid_at             TIMESTAMPTZ,

  appointment_at      TIMESTAMPTZ,
  appointment_note    TEXT          CHECK (length(appointment_note) <= 2000),
  scheduled_at        TIMESTAMPTZ,
  scheduled_by        UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  vr_url              TEXT          CHECK (length(vr_url) <= 2000),
  delivered_at        TIMESTAMPTZ,
  delivered_by        UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  commission_order_id UUID          UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,

  attached_at         TIMESTAMPTZ,
  attached_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at        TIMESTAMPTZ,
  superseded_at       TIMESTAMPTZ,

  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason       TEXT          CHECK (length(cancel_reason) <= 2000),

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Hình dạng theo trạng thái: kể cả ghi thẳng SQL cũng không tạo được đơn méo.
  CONSTRAINT vr_quoted_shape CHECK (
    status NOT IN ('quoted', 'paid', 'scheduled', 'delivered', 'attached', 'superseded')
    OR (quoted_price IS NOT NULL AND quoted_at IS NOT NULL)),
  CONSTRAINT vr_paid_shape CHECK (
    status NOT IN ('paid', 'scheduled', 'delivered', 'attached', 'superseded')
    OR (paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL)),
  -- Hoàn tiền ngoài phạm vi ⇒ đơn đã trả không huỷ được.
  CONSTRAINT vr_cancel_unpaid CHECK (status <> 'cancelled' OR paid_at IS NULL),
  CONSTRAINT vr_scheduled_shape CHECK (
    status NOT IN ('scheduled', 'delivered', 'attached', 'superseded')
    OR appointment_at IS NOT NULL),
  CONSTRAINT vr_delivered_shape CHECK (
    status NOT IN ('delivered', 'attached', 'superseded')
    OR (vr_url ~ '^https://\S+$' AND delivered_at IS NOT NULL AND commission_order_id IS NOT NULL)),
  CONSTRAINT vr_published_is_attached CHECK (published_at IS NULL OR status = 'attached')
);

COMMENT ON TABLE public.asset_vr_tour_orders IS
  'Đơn dịch vụ VR tour theo hồ sơ số hoá (lot_id = asset_posting_id). Ghi CHỈ qua RPC.';

-- Một hồ sơ: tối đa MỘT đơn đang chạy và MỘT tour đang gắn.
CREATE UNIQUE INDEX uq_vr_tour_active_per_posting
  ON public.asset_vr_tour_orders (asset_posting_id)
  WHERE status IN ('requested', 'quoted', 'paid', 'scheduled', 'delivered');
CREATE UNIQUE INDEX uq_vr_tour_attached_per_posting
  ON public.asset_vr_tour_orders (asset_posting_id) WHERE status = 'attached';

CREATE INDEX idx_vr_tour_posting  ON public.asset_vr_tour_orders (asset_posting_id, created_at DESC);
CREATE INDEX idx_vr_tour_status   ON public.asset_vr_tour_orders (status, created_at DESC);
CREATE INDEX idx_vr_tour_user     ON public.asset_vr_tour_orders (user_id);
CREATE INDEX idx_vr_tour_supplier ON public.asset_vr_tour_orders (supplier_id);

CREATE TRIGGER asset_vr_tour_orders_updated_at
  BEFORE UPDATE ON public.asset_vr_tour_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. RLS: chỉ ĐỌC ─────────────────────────────────────────────────────────

ALTER TABLE public.asset_vr_tour_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_vr_tour_orders_owner_read
  ON public.asset_vr_tour_orders FOR SELECT
  USING (auth.uid() = user_id);

-- tai-san-tu-nguyen:view để thẻ VR trên trang duyệt tài sản đọc được.
CREATE POLICY asset_vr_tour_orders_admin_read
  ON public.asset_vr_tour_orders FOR SELECT
  USING (public.admin_has_permission('don-vr-tour', 'view')
         OR public.admin_has_permission('tai-san-tu-nguyen', 'view'));

-- ─── 5. Nội bộ: dịch vụ VR ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._vr_tour_service_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.services WHERE name = 'VR tour tài sản' AND kind = 'commission' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._vr_tour_service_id() FROM PUBLIC, anon, authenticated;

-- ─── 6. Catalog cho người bán (dịch vụ commission bị ẩn khỏi public read) ────

CREATE OR REPLACE FUNCTION public.public_vr_tour_packages()
RETURNS TABLE (variant_id UUID, variant_key TEXT, name TEXT, from_price NUMERIC, sort_order INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.variant_key, v.name, v.price, v.sort_order
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE s.id = public._vr_tour_service_id() AND s.is_active AND v.is_active
   ORDER BY v.sort_order, v.name;
$$;

-- Chỉ trả TÊN đối tác đang có hợp đồng hiệu lực phủ dịch vụ — không lộ điều khoản.
CREATE OR REPLACE FUNCTION public.public_vr_tour_partners()
RETURNS TABLE (supplier_id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.id, sp.name
    FROM public.suppliers sp
   WHERE sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, public._vr_tour_service_id(), NULL, CURRENT_DATE))
   ORDER BY sp.name;
$$;

REVOKE ALL ON FUNCTION public.public_vr_tour_packages() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_vr_tour_partners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_vr_tour_packages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_vr_tour_partners() TO authenticated;

-- ─── 7. Chủ tài sản: yêu cầu / huỷ ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_request_vr_tour(
  _posting_id     UUID,
  _variant_key    TEXT,
  _supplier_id    UUID,
  _site_address   TEXT,
  _preferred_time TEXT,
  _note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_svc     UUID := public._vr_tour_service_id();
  v_var     public.service_variants%ROWTYPE;
  v_partner TEXT;
  v_active  public.asset_vr_tour_orders%ROWTYPE;
  v_order   public.asset_vr_tour_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Khoá dòng tuần tự hoá hai lần bấm; khoá không bắn trigger UPDATE (review guard).
  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
   WHERE v.variant_key = _variant_key AND v.service_id = v_svc AND v.is_active;
  IF NOT FOUND OR v_svc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT sp.name INTO v_partner FROM public.suppliers sp
   WHERE sp.id = _supplier_id AND sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, v_svc, v_var.id, CURRENT_DATE));
  IF v_partner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'partner_unavailable');
  END IF;

  SELECT * INTO v_active FROM public.asset_vr_tour_orders
   WHERE asset_posting_id = _posting_id
     AND status IN ('requested', 'quoted', 'paid', 'scheduled', 'delivered');
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'order_id', v_active.id);
  END IF;

  INSERT INTO public.asset_vr_tour_orders
    (asset_posting_id, user_id, service_variant_id, supplier_id, posting_title, package_name, partner_name,
     site_address, preferred_time, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id, _supplier_id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_var.name, v_partner,
     NULLIF(btrim(_site_address), ''), NULLIF(btrim(_preferred_time), ''), NULLIF(btrim(_note), ''))
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order.id, 'code', v_order.code);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_cancel_vr_tour(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_vr_tour_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders
   WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_order.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;

  UPDATE public.asset_vr_tour_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_request_vr_tour(UUID, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cancel_vr_tour(UUID)                               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_request_vr_tour(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_vr_tour(UUID)                               TO authenticated;

-- ─── 8. Admin (thay đối tác): báo giá / huỷ ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_quote_vr_tour(
  _order_id   UUID,
  _price      NUMERIC,
  _note       TEXT,
  _valid_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_vr_tour_orders%ROWTYPE;
  v_terms RECORD;
BEGIN
  IF NOT public.admin_has_permission('don-vr-tour', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF _price IS NULL OR _price <= 0 OR _price <> round(_price) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
  END IF;
  IF _valid_days IS NULL OR _valid_days < 1 OR _valid_days > 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_validity');
  END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    v_order.supplier_id, public._vr_tour_service_id(), v_order.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  -- Hoa hồng cố định vượt giá ⇒ lúc giao sẽ vỡ orders_amount_le_gross_check. Chặn sớm.
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > _price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  UPDATE public.asset_vr_tour_orders
     SET status = 'quoted', quoted_price = _price, quote_note = NULLIF(btrim(_note), ''),
         quoted_at = now(), quote_expires_at = now() + make_interval(days => _valid_days),
         quoted_by = auth.uid()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_vr_tour(_order_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_vr_tour_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-vr-tour', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.asset_vr_tour_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = btrim(_reason)
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quote_vr_tour(UUID, NUMERIC, TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_vr_tour(UUID, TEXT)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quote_vr_tour(UUID, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_vr_tour(UUID, TEXT)             TO authenticated;

-- ─── 9. Thanh toán ───────────────────────────────────────────────────────────
-- Hàm THẬT (nội bộ): khi có IPN VNPay thật, edge function (service_role) gọi thẳng hàm
-- này và thu hồi wrapper khỏi `authenticated`. KHÔNG tạo orders (BR-VR-03: ghi lúc giao).

CREATE OR REPLACE FUNCTION public._settle_vr_tour_order(
  _order_id        UUID,
  _txn_ref         TEXT,
  _expected_amount NUMERIC,
  _uid             UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order  public.asset_vr_tour_orders%ROWTYPE;
  v_claim  TEXT;
  v_pstat  TEXT;
BEGIN
  IF _uid IS NULL OR btrim(COALESCE(_txn_ref, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;

  SELECT * INTO v_order FROM public.asset_vr_tour_orders
   WHERE id = _order_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT status INTO v_pstat FROM public.asset_postings WHERE id = v_order.asset_posting_id;

  -- F5 / quay lại trang kết quả: cùng mã giao dịch ⇒ báo đã trả, không làm gì.
  IF v_order.payment_txn_ref = btrim(_txn_ref) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'order_id', v_order.id,
                              'code', v_order.code, 'posting_id', v_order.asset_posting_id,
                              'posting_status', v_pstat);
  END IF;
  IF v_order.status <> 'quoted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF v_order.quote_expires_at IS NOT NULL AND v_order.quote_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_expired');
  END IF;
  -- Admin báo giá lại trong lúc người bán đang ở trang thanh toán.
  IF _expected_amount IS DISTINCT FROM v_order.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  SELECT btrim(_txn_ref), _uid, v.variant_key, 'vr_order:' || v_order.id
    FROM public.service_variants v WHERE v.id = v_order.service_variant_id
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  UPDATE public.asset_vr_tour_orders
     SET status = 'paid', paid_at = now(), payment_txn_ref = btrim(_txn_ref)
   WHERE id = v_order.id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'order_id', v_order.id, 'code', v_order.code,
                            'posting_id', v_order.asset_posting_id, 'posting_status', v_pstat);
END;
$$;

REVOKE ALL ON FUNCTION public._settle_vr_tour_order(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: người bán tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_vr_tour_order(_order_id UUID, _txn_ref TEXT, _expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_vr_tour_order(_order_id, _txn_ref, _expected_amount, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.pay_vr_tour_order(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_vr_tour_order(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── 10. Admin: hẹn lịch / giao link (ghi hoa hồng) ──────────────────────────

CREATE OR REPLACE FUNCTION public.admin_schedule_vr_tour(
  _order_id       UUID,
  _appointment_at TIMESTAMPTZ,
  _note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_vr_tour_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-vr-tour', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  -- 'scheduled' được phép: dời lịch.
  IF v_order.status NOT IN ('paid', 'scheduled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF _appointment_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_appointment');
  END IF;
  IF length(btrim(COALESCE(_note, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'note_required');
  END IF;

  UPDATE public.asset_vr_tour_orders
     SET status = 'scheduled', appointment_at = _appointment_at, appointment_note = btrim(_note),
         scheduled_at = now(), scheduled_by = auth.uid()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deliver_vr_tour(_order_id UUID, _vr_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order  public.asset_vr_tour_orders%ROWTYPE;
  v_url    TEXT := btrim(COALESCE(_vr_url, ''));
  v_svc    UUID := public._vr_tour_service_id();
  v_terms  RECORD;
  v_ledger UUID;
BEGIN
  IF NOT public.admin_has_permission('don-vr-tour', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  -- Gửi lại cùng link ⇒ không ghi sổ lần hai.
  IF v_order.status IN ('delivered', 'attached', 'superseded') AND v_order.vr_url = v_url THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'commission_order_id', v_order.commission_order_id);
  END IF;
  IF v_order.status <> 'scheduled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF v_url !~ '^https://[^\s/]+(/\S*)?$' OR length(v_url) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_url');
  END IF;

  -- Tra điều khoản TẠI NGÀY GIAO (BR-VR-03 "theo hợp đồng"). Không có ⇒ chặn, không
  -- ghi 0%: người thao tác là admin, gia hạn hợp đồng rồi giao lại được.
  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    v_order.supplier_id, v_svc, v_order.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > v_order.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  INSERT INTO public.orders (
    user_id, service_id, service_variant_id, quantity, amount, gross_amount,
    supplier_id, commission_type, commission_value, contract_id, contract_line_id,
    fulfillment_status, ordered_at, fulfilled_at, note, created_by
  ) VALUES (
    v_order.user_id, v_svc, v_order.service_variant_id, 1, 0, v_order.quoted_price,
    v_order.supplier_id, v_terms.commission_type, v_terms.commission_value,
    v_terms.contract_id, v_terms.line_id,
    'fulfilled', COALESCE(v_order.paid_at, now()), now(),
    'VR tour ' || v_order.code || ' · ' || left(v_order.posting_title, 80) || ' · ' || v_order.partner_name,
    auth.uid()
  )
  RETURNING id INTO v_ledger;

  UPDATE public.asset_vr_tour_orders
     SET status = 'delivered', vr_url = v_url, delivered_at = now(), delivered_by = auth.uid(),
         commission_order_id = v_ledger
   WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true, 'commission_order_id', v_ledger);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_schedule_vr_tour(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_deliver_vr_tour(UUID, TEXT)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_schedule_vr_tour(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deliver_vr_tour(UUID, TEXT)               TO authenticated;

-- ─── 11. Duyệt & gắn vào lô (BR-VR-02) ───────────────────────────────────────
-- Cùng cổng với admin_publish_asset_3d_model: công khai nội dung lô là việc của người
-- duyệt tài sản, không phải người vận hành đơn.

CREATE OR REPLACE FUNCTION public.admin_attach_vr_tour(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order  public.asset_vr_tour_orders%ROWTYPE;
  v_review TEXT;
BEGIN
  IF NOT public.admin_has_permission('tai-san-tu-nguyen', 'approve') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status = 'attached' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_order.status <> 'delivered' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;

  SELECT review_status INTO v_review FROM public.asset_postings WHERE id = v_order.asset_posting_id;
  IF v_review IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_not_approved');
  END IF;

  -- Tour cũ nhường chỗ (chụp lại). Trước khi gắn tour mới để không đụng unique index.
  UPDATE public.asset_vr_tour_orders
     SET status = 'superseded', published_at = NULL, superseded_at = now()
   WHERE asset_posting_id = v_order.asset_posting_id AND status = 'attached';

  UPDATE public.asset_vr_tour_orders
     SET status = 'attached', attached_at = now(), attached_by = auth.uid(), published_at = now()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_attach_vr_tour(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_attach_vr_tour(UUID) TO authenticated;

-- Công khai bám duyệt hồ sơ. KHÔNG "AFTER UPDATE OF review_status": guard đổi cột đó
-- trong BEFORE trigger khi chủ sửa hồ sơ, UPDATE OF sẽ không bắn (xem 3D).
-- Chỉ bật/tắt published_at; trạng thái đơn không lùi.
CREATE OR REPLACE FUNCTION public.asset_vr_tour_sync_publish()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.review_status = 'approved' THEN
    UPDATE public.asset_vr_tour_orders
       SET published_at = now()
     WHERE asset_posting_id = NEW.id AND status = 'attached' AND published_at IS NULL;
  ELSE
    UPDATE public.asset_vr_tour_orders
       SET published_at = NULL
     WHERE asset_posting_id = NEW.id AND published_at IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER asset_postings_vr_sync_publish
  AFTER UPDATE ON public.asset_postings
  FOR EACH ROW
  WHEN (OLD.review_status IS DISTINCT FROM NEW.review_status)
  EXECUTE FUNCTION public.asset_vr_tour_sync_publish();

-- ─── 12. Đọc công khai: tour của các lô trong một phiên (BR-VR-02/04) ────────

CREATE OR REPLACE FUNCTION public.public_session_lot_vr_tours(_session_id UUID)
RETURNS TABLE (item_id UUID, vr_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, o.vr_url
    FROM public.auction_session_items i
    JOIN public.auction_sessions s
      ON s.id = i.session_id AND s.status IN ('published', 'cancelled')
    JOIN public.asset_postings p
      ON p.id = i.asset_posting_id AND p.review_status = 'approved'
    JOIN public.asset_vr_tour_orders o
      ON o.asset_posting_id = i.asset_posting_id
     AND o.status = 'attached'
     AND o.published_at IS NOT NULL
   WHERE i.session_id = _session_id;
$$;

GRANT EXECUTE ON FUNCTION public.public_session_lot_vr_tours(UUID) TO anon, authenticated;

-- ─── 13. Kiểm chứng ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_svc UUID := public._vr_tour_service_id();
BEGIN
  IF v_svc IS NULL THEN
    RAISE EXCEPTION 'VR: thiếu dịch vụ VR tour tài sản';
  END IF;
  IF (SELECT count(*) FROM public.service_variants WHERE service_id = v_svc AND variant_key LIKE 'vr_tour_%') < 4 THEN
    RAISE EXCEPTION 'VR: thiếu gói VR tour';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resolve_contract_terms(
       '5115ea00-0000-4000-8000-000000000001', v_svc, NULL, DATE '2026-09-15')) THEN
    RAISE EXCEPTION 'VR: hợp đồng Silver Sea không resolve được';
  END IF;
  IF has_function_privilege('authenticated', 'public._settle_vr_tour_order(uuid, text, numeric, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._settle_vr_tour_order(uuid, text, numeric, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VR: _settle_vr_tour_order không được gọi từ client';
  END IF;
  IF has_function_privilege('anon', 'public.owner_request_vr_tour(uuid, text, uuid, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VR: anon không được gọi RPC ghi';
  END IF;
END;
$$;

-- Giám định tài sản cho hồ sơ số hoá ("Đặt giám định" ở bước 4 wizard).
--
-- Vì sao: sàn cổ vật chuyên nghiệp giám định trước khi lên catalogue; người mua trả
-- cao cho lô có chứng thư.
--
-- Luồng: chủ tài sản chọn đối tác + phương thức (từ ảnh / gửi hiện vật / tại chỗ) →
-- requested → admin báo giá THAY đối tác (quoted) → chủ trả VNPay mô phỏng (paid) →
-- gửi hiện vật (chủ nhập mã vận đơn) / hẹn tại chỗ (admin) (item_pending) → admin xác
-- nhận đã nhận hiện vật / đã tới (in_review; từ ảnh đi thẳng từ paid) → admin tải
-- chứng thư + kết luận THAY đối tác (completed, GHI HOA HỒNG).
--
-- Cùng khuôn với VR tour (20260915000010): bảng riêng, RPC {ok,reason}, sổ cái orders
-- ghi MỘT dòng lúc hoàn tất, điều khoản hoa hồng tra resolve_contract_terms.
--
-- ĐẶT TÊN: "authentication" chứ không "appraisal" — asset_postings.pricing_mode =
-- 'appraisal' đã mang nghĩa ĐỊNH GIÁ (nhờ tổ chức đấu giá định giá), khác hẳn giám định.
--
-- @BR-GD-01 Chứng thư chỉ vào hệ thống qua admin_complete_authentication (quyền
--   don-giam-dinh:update, thao tác thay đối tác). Bucket chỉ cho quyền đó INSERT; người
--   bán không có đường ghi nào. Đường dẫn phải là object CÓ THẬT trong bucket.
-- @BR-GD-02 Kết luận inconclusive / suspected_fake ⇒ hồ sơ không đăng được ở nhóm Cổ
--   vật (gate ở 20260915000021). suspected_fake luôn trả hồ sơ về nháp; inconclusive trả
--   về nháp khi hồ sơ đang ở nhóm Cổ vật. Lý do (verdict_reason) chỉ chủ + admin đọc.
-- @BR-GD-03 Bắt buộc giám định = chính sách (nhóm + ngưỡng giá) HOẶC người bán bị hạn
--   chế HOẶC admin đánh dấu từng lô. Gate ở 20260915000021.
--
-- MỨC XÁC MINH là giá trị DẪN XUẤT (asset_posting_verification_level), không lưu cột:
--   0 chưa xác minh · 1 chủ tài sản đã KYC · 2 hồ sơ được sàn duyệt ·
--   3 chứng thư "xác thực" từ ảnh · 4 chứng thư "xác thực" qua hiện vật / tại chỗ.
-- Nhân bản ở src/lib/authentication/verificationLevel.ts.

-- ─── 1. Catalog: dịch vụ + gói (một gói = một phương thức) ───────────────────

INSERT INTO public.services
  (name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
SELECT 'Giám định tài sản', 'commission', 'brokerage', 'owner', 0, 'per_order',
       'Đối tác giám định cấp chứng thư cho tài sản số hoá. Giá theo báo giá từng đơn; sàn hưởng hoa hồng theo hợp đồng hợp tác đang hiệu lực.',
       true, 37
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Giám định tài sản');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, v.key, v.name, v.price, true, v.sort
  FROM public.services s
 CROSS JOIN (VALUES
   ('gd_from_photos', 'Giám định từ ảnh',          1500000::numeric, 1),
   ('gd_ship_item',   'Gửi hiện vật tới đối tác',  3000000::numeric, 2),
   ('gd_on_site',     'Giám định tại chỗ',         5000000::numeric, 3)
 ) AS v(key, name, price, sort)
 WHERE s.name = 'Giám định tài sản'
ON CONFLICT (variant_key) DO NOTHING;

-- ─── 2. Đối tác giám định + hợp đồng (GIÁ TRỊ GIỮ CHỖ, admin sửa được) ─────────

INSERT INTO public.suppliers
  (id, name, supplier_type, default_commission_type, default_commission_rate, status, note)
VALUES ('6d1a0000-0000-4000-8000-000000000001', 'Trung tâm Giám định Cổ vật & Nghệ thuật', 'company',
        'percent', 20, 'active', '[gd-seed] Đối tác giám định — tên & tỉ lệ giữ chỗ')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contracts
  (id, supplier_id, contract_no, title, signed_date, effective_from, effective_to, status, note)
VALUES ('6d1a0000-0000-4000-8000-000000000002', '6d1a0000-0000-4000-8000-000000000001',
        '02/2026/HĐHT-GD', 'Hợp tác cung cấp dịch vụ giám định', DATE '2026-09-01', DATE '2026-09-01',
        DATE '2027-08-31', 'active', '[gd-seed] Tỉ lệ giữ chỗ — cập nhật theo hợp đồng thật')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contract_lines
  (id, contract_id, service_id, service_variant_id, commission_type, commission_value, note)
SELECT '6d1a0000-0000-4000-8000-000000000003', '6d1a0000-0000-4000-8000-000000000002',
       s.id, NULL, 'percent', 20, 'Áp cho mọi phương thức giám định'
  FROM public.services s
 WHERE s.name = 'Giám định tài sản'
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Bảng đơn giám định ───────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_authentication_order_code_seq START 1;

CREATE TABLE public.asset_authentication_orders (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT          NOT NULL UNIQUE
                          DEFAULT ('GD' || lpad(nextval('public.asset_authentication_order_code_seq')::text, 6, '0')),
  asset_posting_id      UUID          NOT NULL REFERENCES public.asset_postings(id) ON DELETE RESTRICT,
  user_id               UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method                TEXT          NOT NULL CHECK (method IN ('from_photos', 'ship_item', 'on_site')),
  service_variant_id    UUID          NOT NULL REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  supplier_id           UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  posting_title         TEXT          NOT NULL,
  package_name          TEXT          NOT NULL,
  partner_name          TEXT          NOT NULL,

  status                TEXT          NOT NULL DEFAULT 'requested'
                          CHECK (status IN ('requested', 'quoted', 'paid', 'item_pending', 'in_review',
                                            'completed', 'superseded', 'cancelled')),

  site_address          TEXT          CHECK (length(site_address) <= 2000),
  preferred_time        TEXT          CHECK (length(preferred_time) <= 2000),
  request_note          TEXT          CHECK (length(request_note) <= 2000),

  quoted_price          NUMERIC(18,0) CHECK (quoted_price > 0),
  quote_note            TEXT          CHECK (length(quote_note) <= 2000),
  quoted_at             TIMESTAMPTZ,
  quote_expires_at      TIMESTAMPTZ,
  quoted_by             UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  payment_txn_ref       TEXT          UNIQUE,
  paid_at               TIMESTAMPTZ,

  shipment_tracking     TEXT          CHECK (length(shipment_tracking) <= 200),
  shipped_at            TIMESTAMPTZ,
  appointment_at        TIMESTAMPTZ,
  appointment_note      TEXT          CHECK (length(appointment_note) <= 2000),
  item_received_at      TIMESTAMPTZ,
  review_started_at     TIMESTAMPTZ,

  verdict               TEXT          CHECK (verdict IN ('authentic', 'inconclusive', 'suspected_fake')),
  verdict_reason        TEXT          CHECK (length(verdict_reason) <= 4000),
  certificate_path      TEXT          CHECK (length(certificate_path) <= 1000),
  certificate_no        TEXT          CHECK (length(certificate_no) <= 200),
  issued_at             TIMESTAMPTZ,
  issued_by_supplier_id UUID          REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  uploaded_by           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  commission_order_id   UUID          UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  posting_reverted_at   TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  superseded_at         TIMESTAMPTZ,

  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason         TEXT          CHECK (length(cancel_reason) <= 2000),

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT gd_on_site_address CHECK (method <> 'on_site' OR site_address IS NOT NULL),
  CONSTRAINT gd_quoted_shape CHECK (
    status IN ('requested', 'cancelled') OR (quoted_price IS NOT NULL AND quoted_at IS NOT NULL)),
  CONSTRAINT gd_paid_shape CHECK (
    status IN ('requested', 'quoted', 'cancelled') OR (paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL)),
  CONSTRAINT gd_cancel_unpaid CHECK (status <> 'cancelled' OR paid_at IS NULL),
  CONSTRAINT gd_item_pending_shape CHECK (
    status <> 'item_pending'
    OR (method = 'ship_item' AND shipment_tracking IS NOT NULL)
    OR (method = 'on_site' AND appointment_at IS NOT NULL)),
  CONSTRAINT gd_review_shape CHECK (
    status NOT IN ('in_review', 'completed', 'superseded')
    OR (review_started_at IS NOT NULL AND (method = 'from_photos' OR item_received_at IS NOT NULL))),
  CONSTRAINT gd_completed_shape CHECK (
    status NOT IN ('completed', 'superseded')
    OR (verdict IS NOT NULL AND certificate_path IS NOT NULL AND issued_at IS NOT NULL
        AND issued_by_supplier_id IS NOT NULL AND commission_order_id IS NOT NULL)),
  -- Kết luận tiêu cực bắt buộc có lý do để báo riêng người bán (BR-GD-02).
  CONSTRAINT gd_negative_has_reason CHECK (
    verdict IS NULL OR verdict = 'authentic' OR length(btrim(COALESCE(verdict_reason, ''))) >= 5),
  CONSTRAINT gd_published_is_authentic CHECK (
    published_at IS NULL OR (status = 'completed' AND verdict = 'authentic'))
);

COMMENT ON TABLE public.asset_authentication_orders IS
  'Đơn giám định theo hồ sơ số hoá (lot_id = asset_posting_id). Ghi CHỈ qua RPC. verdict_reason là thông tin RIÊNG của người bán.';

-- Một hồ sơ: tối đa MỘT đơn đang chạy và MỘT kết luận hiện hành.
CREATE UNIQUE INDEX uq_gd_active_per_posting
  ON public.asset_authentication_orders (asset_posting_id)
  WHERE status IN ('requested', 'quoted', 'paid', 'item_pending', 'in_review');
CREATE UNIQUE INDEX uq_gd_completed_per_posting
  ON public.asset_authentication_orders (asset_posting_id) WHERE status = 'completed';

CREATE INDEX idx_gd_posting  ON public.asset_authentication_orders (asset_posting_id, created_at DESC);
CREATE INDEX idx_gd_status   ON public.asset_authentication_orders (status, created_at DESC);
CREATE INDEX idx_gd_user     ON public.asset_authentication_orders (user_id);
CREATE INDEX idx_gd_supplier ON public.asset_authentication_orders (supplier_id);

CREATE TRIGGER asset_authentication_orders_updated_at
  BEFORE UPDATE ON public.asset_authentication_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.asset_authentication_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_authentication_orders_owner_read
  ON public.asset_authentication_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY asset_authentication_orders_admin_read
  ON public.asset_authentication_orders FOR SELECT
  USING (public.admin_has_permission('don-giam-dinh', 'view')
         OR public.admin_has_permission('tai-san-tu-nguyen', 'view'));

-- ─── 4. BR-GD-03: chính sách + người bán bị hạn chế + lô bắt buộc ────────────

CREATE TABLE public.authentication_policy (
  id           SMALLINT      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled      BOOLEAN       NOT NULL DEFAULT true,
  min_price    NUMERIC(18,0) NOT NULL DEFAULT 50000000 CHECK (min_price >= 0),
  parent_slugs TEXT[]        NOT NULL DEFAULT ARRAY['co-vat-suu-tam'],
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_by   UUID          REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.authentication_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.authentication_policy ENABLE ROW LEVEL SECURITY;
-- Wizard nhân bản chính sách phía client để báo "Bắt buộc" trước khi nộp.
CREATE POLICY authentication_policy_read
  ON public.authentication_policy FOR SELECT TO authenticated USING (true);

CREATE TABLE public.seller_authentication_restrictions (
  user_id    UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT        NOT NULL CHECK (length(btrim(reason)) >= 5 AND length(reason) <= 2000),
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_authentication_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_authentication_restrictions_own_read
  ON public.seller_authentication_restrictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY seller_authentication_restrictions_admin_read
  ON public.seller_authentication_restrictions FOR SELECT
  USING (public.admin_has_permission('tai-san-tu-nguyen', 'view')
         OR public.admin_has_permission('don-giam-dinh', 'view'));

CREATE TABLE public.asset_authentication_requirements (
  asset_posting_id UUID        PRIMARY KEY REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  reason           TEXT        NOT NULL CHECK (length(btrim(reason)) >= 5 AND length(reason) <= 2000),
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_authentication_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_authentication_requirements_owner_read
  ON public.asset_authentication_requirements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.asset_postings p
                  WHERE p.id = asset_posting_id AND p.user_id = auth.uid()));
CREATE POLICY asset_authentication_requirements_admin_read
  ON public.asset_authentication_requirements FOR SELECT
  USING (public.admin_has_permission('tai-san-tu-nguyen', 'view')
         OR public.admin_has_permission('don-giam-dinh', 'view'));

-- ─── 5. Nội bộ: dịch vụ, lý do bắt buộc, kết luận hiện hành, mức xác minh ────

CREATE OR REPLACE FUNCTION public._authentication_service_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.services WHERE name = 'Giám định tài sản' AND kind = 'commission' LIMIT 1;
$$;

-- Nhận GIÁ TRỊ cột (không id) để trigger BEFORE INSERT/UPDATE truyền NEW.* vào được.
-- Trả mảng mã lý do: 'lot_flag' | 'seller_restricted' | 'policy'.
CREATE OR REPLACE FUNCTION public._authentication_required_reasons(
  _posting_id     UUID,
  _user_id        UUID,
  _parent_slug    TEXT,
  _starting_price NUMERIC
)
RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN EXISTS (SELECT 1 FROM public.asset_authentication_requirements r
                       WHERE r.asset_posting_id = _posting_id) THEN 'lot_flag' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.seller_authentication_restrictions s
                       WHERE s.user_id = _user_id) THEN 'seller_restricted' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.authentication_policy ap
                       WHERE ap.enabled
                         AND _parent_slug = ANY (ap.parent_slugs)
                         AND _starting_price IS NOT NULL
                         AND _starting_price >= ap.min_price) THEN 'policy' END
  ], NULL);
$$;

-- Kết luận hiện hành của hồ sơ (NULL = chưa có).
CREATE OR REPLACE FUNCTION public._authentication_current_verdict(_posting_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT verdict FROM public.asset_authentication_orders
   WHERE asset_posting_id = _posting_id AND status = 'completed'
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.asset_posting_verification_level(_posting_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                  WHERE o.asset_posting_id = p.id AND o.status = 'completed'
                    AND o.verdict = 'authentic' AND o.method IN ('ship_item', 'on_site')) THEN 4
    WHEN EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                  WHERE o.asset_posting_id = p.id AND o.status = 'completed'
                    AND o.verdict = 'authentic') THEN 3
    WHEN p.review_status = 'approved' THEN 2
    WHEN EXISTS (SELECT 1 FROM public.asset_owner_kyc k
                  WHERE k.user_id = p.user_id AND k.status = 'approved')
      OR EXISTS (SELECT 1 FROM public.asset_owner_org_kyc k
                  WHERE k.created_by = p.user_id AND k.status = 'approved') THEN 1
    ELSE 0
  END
  FROM public.asset_postings p WHERE p.id = _posting_id;
$$;

REVOKE ALL ON FUNCTION public._authentication_service_id()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._authentication_required_reasons(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._authentication_current_verdict(UUID)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.asset_posting_verification_level(UUID)                FROM PUBLIC, anon, authenticated;

-- ─── 6. Catalog cho người bán ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.public_authentication_packages()
RETURNS TABLE (variant_id UUID, variant_key TEXT, name TEXT, from_price NUMERIC, sort_order INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.variant_key, v.name, v.price, v.sort_order
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE s.id = public._authentication_service_id() AND s.is_active AND v.is_active
   ORDER BY v.sort_order, v.name;
$$;

CREATE OR REPLACE FUNCTION public.public_authentication_partners()
RETURNS TABLE (supplier_id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.id, sp.name
    FROM public.suppliers sp
   WHERE sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, public._authentication_service_id(), NULL, CURRENT_DATE))
   ORDER BY sp.name;
$$;

REVOKE ALL ON FUNCTION public.public_authentication_packages() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_authentication_partners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_authentication_packages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_authentication_partners() TO authenticated;

-- ─── 7. Chủ tài sản: đặt / huỷ / báo đã gửi hiện vật ─────────────────────────

CREATE OR REPLACE FUNCTION public.owner_request_authentication(
  _posting_id     UUID,
  _method         TEXT,
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
  v_svc     UUID := public._authentication_service_id();
  v_var     public.service_variants%ROWTYPE;
  v_partner TEXT;
  v_active  UUID;
  v_order   public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _method NOT IN ('from_photos', 'ship_item', 'on_site') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;
  IF _method = 'on_site' AND length(btrim(COALESCE(_site_address, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'address_required');
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
   WHERE v.variant_key = 'gd_' || _method AND v.service_id = v_svc AND v.is_active;
  IF NOT FOUND OR v_svc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT sp.name INTO v_partner FROM public.suppliers sp
   WHERE sp.id = _supplier_id AND sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, v_svc, v_var.id, CURRENT_DATE));
  IF v_partner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'partner_unavailable');
  END IF;

  SELECT id INTO v_active FROM public.asset_authentication_orders
   WHERE asset_posting_id = _posting_id
     AND status IN ('requested', 'quoted', 'paid', 'item_pending', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'order_id', v_active);
  END IF;

  INSERT INTO public.asset_authentication_orders
    (asset_posting_id, user_id, method, service_variant_id, supplier_id, posting_title, package_name,
     partner_name, site_address, preferred_time, request_note)
  VALUES
    (_posting_id, v_uid, _method, v_var.id, _supplier_id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_var.name, v_partner,
     NULLIF(btrim(_site_address), ''), NULLIF(btrim(_preferred_time), ''), NULLIF(btrim(_note), ''))
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order.id, 'code', v_order.code);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_cancel_authentication(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders
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

  UPDATE public.asset_authentication_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Gửi hiện vật: chủ nhập mã vận đơn sau khi đã trả. Sửa lại được tới khi đối tác nhận.
CREATE OR REPLACE FUNCTION public.owner_submit_authentication_shipment(_order_id UUID, _tracking TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
  v_trk   TEXT := btrim(COALESCE(_tracking, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders
   WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.method <> 'ship_item' OR v_order.status NOT IN ('paid', 'item_pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF length(v_trk) < 4 OR length(v_trk) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'tracking_required');
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'item_pending', shipment_tracking = v_trk, shipped_at = now()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_request_authentication(UUID, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cancel_authentication(UUID)                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_submit_authentication_shipment(UUID, TEXT)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_request_authentication(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_authentication(UUID)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_submit_authentication_shipment(UUID, TEXT)                TO authenticated;

-- ─── 8. Admin (thay đối tác): báo giá / huỷ ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_quote_authentication(
  _order_id   UUID,
  _price      NUMERIC,
  _note       TEXT,
  _valid_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
  v_terms RECORD;
BEGIN
  IF NOT public.admin_has_permission('don-giam-dinh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
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
    v_order.supplier_id, public._authentication_service_id(), v_order.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > _price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'quoted', quoted_price = _price, quote_note = NULLIF(btrim(_note), ''),
         quoted_at = now(), quote_expires_at = now() + make_interval(days => _valid_days),
         quoted_by = auth.uid()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_authentication(_order_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-giam-dinh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = btrim(_reason)
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quote_authentication(UUID, NUMERIC, TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_authentication(UUID, TEXT)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quote_authentication(UUID, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_authentication(UUID, TEXT)             TO authenticated;

-- ─── 9. Thanh toán (mô phỏng VNPay, cùng khuôn VR) ───────────────────────────

CREATE OR REPLACE FUNCTION public._settle_authentication_order(
  _order_id        UUID,
  _txn_ref         TEXT,
  _expected_amount NUMERIC,
  _uid             UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
  v_claim TEXT;
BEGIN
  IF _uid IS NULL OR btrim(COALESCE(_txn_ref, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;

  SELECT * INTO v_order FROM public.asset_authentication_orders
   WHERE id = _order_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_order.payment_txn_ref = btrim(_txn_ref) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_paid', 'order_id', v_order.id,
                              'code', v_order.code, 'posting_id', v_order.asset_posting_id,
                              'method', v_order.method);
  END IF;
  IF v_order.status <> 'quoted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF v_order.quote_expires_at IS NOT NULL AND v_order.quote_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_expired');
  END IF;
  IF _expected_amount IS DISTINCT FROM v_order.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  SELECT btrim(_txn_ref), _uid, v.variant_key, 'gd_order:' || v_order.id
    FROM public.service_variants v WHERE v.id = v_order.service_variant_id
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'paid', paid_at = now(), payment_txn_ref = btrim(_txn_ref)
   WHERE id = v_order.id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'order_id', v_order.id, 'code', v_order.code,
                            'posting_id', v_order.asset_posting_id, 'method', v_order.method);
END;
$$;

REVOKE ALL ON FUNCTION public._settle_authentication_order(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: người bán tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_authentication_order(_order_id UUID, _txn_ref TEXT, _expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_authentication_order(_order_id, _txn_ref, _expected_amount, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.pay_authentication_order(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_authentication_order(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── 10. Admin: hẹn tại chỗ / bắt đầu giám định ──────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_schedule_authentication(
  _order_id       UUID,
  _appointment_at TIMESTAMPTZ,
  _note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-giam-dinh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.method <> 'on_site' OR v_order.status NOT IN ('paid', 'item_pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF _appointment_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_appointment');
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'item_pending', appointment_at = _appointment_at,
         appointment_note = NULLIF(btrim(_note), '')
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- from_photos: paid → in_review. ship_item: item_pending (đã nhận hiện vật) → in_review.
-- on_site: item_pending (đã tới giám định) → in_review.
CREATE OR REPLACE FUNCTION public.admin_start_authentication_review(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('don-giam-dinh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status = 'in_review' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF (v_order.method = 'from_photos' AND v_order.status <> 'paid')
     OR (v_order.method <> 'from_photos' AND v_order.status <> 'item_pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'in_review', review_started_at = now(),
         item_received_at = CASE WHEN method = 'from_photos' THEN NULL ELSE now() END
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_schedule_authentication(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_start_authentication_review(UUID)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_schedule_authentication(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_authentication_review(UUID)                TO authenticated;

-- ─── 11. Admin: tải chứng thư + kết luận THAY đối tác (BR-GD-01/02) ──────────

CREATE OR REPLACE FUNCTION public.admin_complete_authentication(
  _order_id         UUID,
  _verdict          TEXT,
  _reason           TEXT,
  _certificate_path TEXT,
  _certificate_no   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order    public.asset_authentication_orders%ROWTYPE;
  v_posting  public.asset_postings%ROWTYPE;
  v_path     TEXT := btrim(COALESCE(_certificate_path, ''));
  v_svc      UUID := public._authentication_service_id();
  v_terms    RECORD;
  v_ledger   UUID;
  v_in_sess  BOOLEAN;
  v_revert   BOOLEAN := false;
  v_manual   BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission('don-giam-dinh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status IN ('completed', 'superseded') AND v_order.certificate_path = v_path THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_order.status <> 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF _verdict NOT IN ('authentic', 'inconclusive', 'suspected_fake') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_verdict');
  END IF;
  IF _verdict <> 'authentic' AND length(btrim(COALESCE(_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  -- Chứng thư phải nằm đúng thư mục của đơn VÀ đã thực sự được tải lên bucket (BR-GD-01).
  IF v_path NOT LIKE v_order.asset_posting_id::text || '/' || v_order.id::text || '/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects
                     WHERE bucket_id = 'asset-authentication-certs' AND name = v_path) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'certificate_missing');
  END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    v_order.supplier_id, v_svc, v_order.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > v_order.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = v_order.asset_posting_id FOR UPDATE;

  INSERT INTO public.orders (
    user_id, service_id, service_variant_id, quantity, amount, gross_amount,
    supplier_id, commission_type, commission_value, contract_id, contract_line_id,
    fulfillment_status, ordered_at, fulfilled_at, note, created_by
  ) VALUES (
    v_order.user_id, v_svc, v_order.service_variant_id, 1, 0, v_order.quoted_price,
    v_order.supplier_id, v_terms.commission_type, v_terms.commission_value,
    v_terms.contract_id, v_terms.line_id,
    'fulfilled', COALESCE(v_order.paid_at, now()), now(),
    'Giám định ' || v_order.code || ' · ' || left(v_order.posting_title, 80) || ' · ' || v_order.partner_name,
    auth.uid()
  )
  RETURNING id INTO v_ledger;

  -- Kết luận cũ nhường chỗ (giám định lại). Trước khi hoàn tất đơn mới để khỏi đụng unique.
  UPDATE public.asset_authentication_orders
     SET status = 'superseded', published_at = NULL, superseded_at = now()
   WHERE asset_posting_id = v_order.asset_posting_id AND status = 'completed';

  -- BR-GD-02: trả về nháp. Hồ sơ đã ký hợp đồng / đang trong phiên công bố thì không tự
  -- rút — admin xử lý tay (needs_manual_withdraw).
  IF _verdict = 'suspected_fake'
     OR (_verdict = 'inconclusive' AND v_posting.parent_slug = 'co-vat-suu-tam') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.auction_session_items i
        JOIN public.auction_sessions s ON s.id = i.session_id AND s.status = 'published'
       WHERE i.asset_posting_id = v_posting.id) INTO v_in_sess;
    IF v_posting.status = 'contracted' OR v_in_sess THEN
      v_manual := true;
    ELSIF v_posting.status NOT IN ('draft', 'cancelled') THEN
      v_revert := true;
    END IF;
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'completed', verdict = _verdict,
         verdict_reason = NULLIF(btrim(_reason), ''),
         certificate_path = v_path, certificate_no = NULLIF(btrim(_certificate_no), ''),
         issued_at = now(), issued_by_supplier_id = v_order.supplier_id, uploaded_by = auth.uid(),
         commission_order_id = v_ledger,
         posting_reverted_at = CASE WHEN v_revert THEN now() END,
         published_at = CASE WHEN _verdict = 'authentic' AND v_posting.review_status = 'approved'
                             THEN now() END
   WHERE id = _order_id;

  IF v_revert THEN
    -- Guard duyệt: người có quyền approve ghi thẳng ⇒ tự hạ review_status; người khác bị
    -- guard nuốt cột duyệt nhưng guard vẫn đá 'approved' về 'pending' vì dòng đã đổi.
    UPDATE public.asset_postings
       SET status = 'draft', submitted_at = NULL,
           review_status = CASE WHEN review_status = 'approved' THEN 'pending' ELSE review_status END,
           reviewed_at   = CASE WHEN review_status = 'approved' THEN NULL ELSE reviewed_at END,
           reviewed_by   = CASE WHEN review_status = 'approved' THEN NULL ELSE reviewed_by END
     WHERE id = v_posting.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'commission_order_id', v_ledger,
                            'posting_reverted', v_revert, 'needs_manual_withdraw', v_manual);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_authentication(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_authentication(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Công khai bám duyệt hồ sơ (như VR / 3D; KHÔNG "UPDATE OF review_status").
CREATE OR REPLACE FUNCTION public.asset_authentication_sync_publish()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.review_status = 'approved' THEN
    UPDATE public.asset_authentication_orders
       SET published_at = now()
     WHERE asset_posting_id = NEW.id AND status = 'completed' AND verdict = 'authentic'
       AND published_at IS NULL;
  ELSE
    UPDATE public.asset_authentication_orders
       SET published_at = NULL
     WHERE asset_posting_id = NEW.id AND published_at IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER asset_postings_authentication_sync_publish
  AFTER UPDATE ON public.asset_postings
  FOR EACH ROW
  WHEN (OLD.review_status IS DISTINCT FROM NEW.review_status)
  EXECUTE FUNCTION public.asset_authentication_sync_publish();

-- ─── 12. Admin: chính sách / người bán bị hạn chế / lô bắt buộc (BR-GD-03) ───
-- Cổng tai-san-tu-nguyen:approve: quyết định cái gì được lên catalogue là việc của người
-- duyệt tài sản, không phải người vận hành đơn.

CREATE OR REPLACE FUNCTION public.admin_set_authentication_policy(
  _enabled      BOOLEAN,
  _min_price    NUMERIC,
  _parent_slugs TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('tai-san-tu-nguyen', 'approve') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF _min_price IS NULL OR _min_price < 0 OR _min_price <> round(_min_price) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
  END IF;
  IF _parent_slugs IS NULL OR cardinality(_parent_slugs) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slugs_required');
  END IF;

  UPDATE public.authentication_policy
     SET enabled = COALESCE(_enabled, false), min_price = _min_price, parent_slugs = _parent_slugs,
         updated_at = now(), updated_by = auth.uid()
   WHERE id = 1;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_seller_authentication_restriction(
  _email      TEXT,
  _restricted BOOLEAN,
  _reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NOT public.admin_has_permission('tai-san-tu-nguyen', 'approve') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT id INTO v_uid FROM public.profiles WHERE lower(email) = lower(btrim(COALESCE(_email, '')));
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found');
  END IF;

  IF _restricted THEN
    IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
    END IF;
    INSERT INTO public.seller_authentication_restrictions (user_id, reason, created_by)
    VALUES (v_uid, btrim(_reason), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by,
                                        created_at = now();
  ELSE
    DELETE FROM public.seller_authentication_restrictions WHERE user_id = v_uid;
  END IF;
  RETURN jsonb_build_object('ok', true, 'user_id', v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_seller_authentication_restrictions()
RETURNS TABLE (user_id UUID, email TEXT, name TEXT, reason TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.admin_has_permission('tai-san-tu-nguyen', 'view')
          OR public.admin_has_permission('don-giam-dinh', 'view')) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT r.user_id, p.email, p.name, r.reason, r.created_at
      FROM public.seller_authentication_restrictions r
      JOIN public.profiles p ON p.id = r.user_id
     ORDER BY r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_lot_authentication_requirement(
  _posting_id UUID,
  _required   BOOLEAN,
  _reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission('tai-san-tu-nguyen', 'approve') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.asset_postings WHERE id = _posting_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _required THEN
    IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
    END IF;
    INSERT INTO public.asset_authentication_requirements (asset_posting_id, reason, created_by)
    VALUES (_posting_id, btrim(_reason), auth.uid())
    ON CONFLICT (asset_posting_id) DO UPDATE SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by,
                                                 created_at = now();
  ELSE
    DELETE FROM public.asset_authentication_requirements WHERE asset_posting_id = _posting_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_authentication_policy(BOOLEAN, NUMERIC, TEXT[])         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_seller_authentication_restriction(TEXT, BOOLEAN, TEXT)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_seller_authentication_restrictions()                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_lot_authentication_requirement(UUID, BOOLEAN, TEXT)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_authentication_policy(BOOLEAN, NUMERIC, TEXT[])        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_seller_authentication_restriction(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_seller_authentication_restrictions()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_lot_authentication_requirement(UUID, BOOLEAN, TEXT)    TO authenticated;

-- Trạng thái giám định của MỘT hồ sơ cho chủ / admin: bắt buộc?, lý do, kết luận, mức.
CREATE OR REPLACE FUNCTION public.posting_authentication_state(_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p public.asset_postings%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.asset_postings WHERE id = _posting_id;
  IF NOT FOUND OR NOT (v_p.user_id = auth.uid()
                       OR public.admin_has_permission('tai-san-tu-nguyen', 'view')
                       OR public.admin_has_permission('don-giam-dinh', 'view')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'reasons', to_jsonb(public._authentication_required_reasons(v_p.id, v_p.user_id, v_p.parent_slug, v_p.starting_price)),
    'verdict', public._authentication_current_verdict(v_p.id),
    'level', public.asset_posting_verification_level(v_p.id));
END;
$$;

REVOKE ALL ON FUNCTION public.posting_authentication_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posting_authentication_state(UUID) TO authenticated;

-- ─── 13. Bucket chứng thư (PRIVATE) ──────────────────────────────────────────
-- Đường dẫn {posting_id}/{order_id}/{file}. Mở bằng createSignedUrl.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('asset-authentication-certs', 'asset-authentication-certs', false, 10485760,
        ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Ai đọc được chứng thư: chủ đơn, admin, và — chỉ chứng thư "xác thực" đã công khai của
-- lô nằm trong phiên công khai — mọi người.
CREATE OR REPLACE FUNCTION public.authentication_cert_readable(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.admin_has_permission('don-giam-dinh', 'view')
      OR public.admin_has_permission('tai-san-tu-nguyen', 'view')
      OR EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                  WHERE o.certificate_path = _name AND o.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                   JOIN public.auction_session_items i ON i.asset_posting_id = o.asset_posting_id
                   JOIN public.auction_sessions s ON s.id = i.session_id AND s.status IN ('published', 'cancelled')
                  WHERE o.certificate_path = _name AND o.status = 'completed'
                    AND o.verdict = 'authentic' AND o.published_at IS NOT NULL);
$$;

GRANT EXECUTE ON FUNCTION public.authentication_cert_readable(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "asset_authentication_certs_read"   ON storage.objects;
DROP POLICY IF EXISTS "asset_authentication_certs_insert" ON storage.objects;
DROP POLICY IF EXISTS "asset_authentication_certs_update" ON storage.objects;
DROP POLICY IF EXISTS "asset_authentication_certs_delete" ON storage.objects;

CREATE POLICY "asset_authentication_certs_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-authentication-certs' AND public.authentication_cert_readable(name));

-- BR-GD-01: CHỈ người vận hành đơn giám định (thay đối tác) ghi được. Người bán không.
CREATE POLICY "asset_authentication_certs_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'asset-authentication-certs'
              AND public.admin_has_permission('don-giam-dinh', 'update'));

CREATE POLICY "asset_authentication_certs_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'asset-authentication-certs'
         AND public.admin_has_permission('don-giam-dinh', 'update'));

CREATE POLICY "asset_authentication_certs_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'asset-authentication-certs'
         AND public.admin_has_permission('don-giam-dinh', 'update'));

-- ─── 14. Đọc công khai: chứng thư của các lô trong một phiên ─────────────────

CREATE OR REPLACE FUNCTION public.public_session_lot_authentications(_session_id UUID)
RETURNS TABLE (item_id UUID, method TEXT, verification_level INT, certificate_path TEXT,
               certificate_no TEXT, partner_name TEXT, issued_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, o.method, public.asset_posting_verification_level(p.id),
         o.certificate_path, o.certificate_no, o.partner_name, o.issued_at
    FROM public.auction_session_items i
    JOIN public.auction_sessions s
      ON s.id = i.session_id AND s.status IN ('published', 'cancelled')
    JOIN public.asset_postings p
      ON p.id = i.asset_posting_id AND p.review_status = 'approved'
    JOIN public.asset_authentication_orders o
      ON o.asset_posting_id = i.asset_posting_id
     AND o.status = 'completed' AND o.verdict = 'authentic'
     AND o.published_at IS NOT NULL
   WHERE i.session_id = _session_id;
$$;

GRANT EXECUTE ON FUNCTION public.public_session_lot_authentications(UUID) TO anon, authenticated;

-- ─── 15. Kiểm chứng ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_svc UUID := public._authentication_service_id();
BEGIN
  IF v_svc IS NULL THEN
    RAISE EXCEPTION 'GD: thiếu dịch vụ Giám định tài sản';
  END IF;
  IF (SELECT count(*) FROM public.service_variants WHERE service_id = v_svc AND variant_key LIKE 'gd_%') < 3 THEN
    RAISE EXCEPTION 'GD: thiếu gói giám định';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resolve_contract_terms(
       '6d1a0000-0000-4000-8000-000000000001', v_svc, NULL, DATE '2026-09-15')) THEN
    RAISE EXCEPTION 'GD: hợp đồng đối tác giám định không resolve được';
  END IF;
  IF has_function_privilege('authenticated', 'public._settle_authentication_order(uuid, text, numeric, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._settle_authentication_order(uuid, text, numeric, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'GD: _settle_authentication_order không được gọi từ client';
  END IF;
  IF has_function_privilege('authenticated', 'public._authentication_required_reasons(uuid, uuid, text, numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'GD: hàm nội bộ bị phơi ra client';
  END IF;
END;
$$;

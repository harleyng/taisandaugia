-- Tư vấn đấu giá cho hồ sơ số hoá ("Tư vấn đấu giá" ở bước 4 wizard + tab trên trang hồ sơ).
--
-- Vì sao: người bán muốn biết NÊN đấu giá thế nào (hình thức, giá khởi điểm / giá bảo
-- lưu, bước giá, thời lượng, tiền đặt trước) TRƯỚC khi tổ chức đấu giá lập phiên.
--
-- Luồng: người bán nêu mục tiêu bán → requested → admin báo giá THAY đối tác (gán đối tác
-- + tên chuyên gia; quoted) → người bán trả VNPay mô phỏng (paid) → admin bắt đầu
-- (in_review), soạn nháp phương án → hoàn tất THAY chuyên gia (completed, GHI HOA HỒNG).
-- Người bán Chấp nhận / Không sử dụng. Muốn phương án khác ⇒ gửi yêu cầu MỚI; bản cũ
-- thành superseded (vẫn xem được).
--
-- Cùng khuôn Tư vấn pháp lý (20260915000030).
--
-- @BR-CNS-04 Đề xuất không tự thay đổi cấu hình phiên: không RPC / trigger nào ở đây ghi
--   asset_postings, auction_sessions hay auction_session_items. Tổ chức đọc đề xuất qua
--   org_session_auction_consult_suggestions và tự bấm áp dụng ở giao diện.
-- @BR-CNS-05 Mỗi phương án là một dòng: version (1, 2, …) gán lúc hoàn tất + đối tác /
--   chuyên gia / completed_by. Phương án bất biến sau hoàn tất (trigger chặn sửa).
--   Nháp nằm ở bảng con asset_auction_consult_proposals — người bán chỉ đọc khi
--   completed/superseded nên nháp không lộ.
-- @BR-CNS-06 Tổ chức (request selected + hợp đồng signed, đúng cổng 20260912000005) chỉ
--   thấy phương án ĐÃ ĐƯỢC CHẤP NHẬN của bản hiện hành; dùng từng trường. Giá bảo lưu và
--   phương thức khác "trả giá lên" chỉ để tham khảo — engine chưa hỗ trợ, và
--   auction_session_items là bảng công khai nên không bao giờ ghi vào đó.

-- ─── 1. Catalog: dịch vụ + gói ───────────────────────────────────────────────

INSERT INTO public.services
  (name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
SELECT 'Tư vấn phương án đấu giá', 'commission', 'brokerage', 'owner', 0, 'per_order',
       'Chuyên gia đề xuất hình thức, giá khởi điểm / giá bảo lưu, bước giá, thời lượng và tiền đặt trước cho tài sản trước khi lập phiên. Giá theo báo giá từng đơn; sàn hưởng hoa hồng theo hợp đồng hợp tác đang hiệu lực.',
       true, 39
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Tư vấn phương án đấu giá');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, 'tvdg_plan', 'Đề xuất phương án đấu giá', 3000000::numeric, true, 1
  FROM public.services s
 WHERE s.name = 'Tư vấn phương án đấu giá'
ON CONFLICT (variant_key) DO NOTHING;

-- ─── 2. Đối tác tư vấn + hợp đồng (GIÁ TRỊ GIỮ CHỖ, admin sửa được) ───────────

INSERT INTO public.suppliers
  (id, name, supplier_type, default_commission_type, default_commission_rate, status, note)
VALUES ('8f2b0000-0000-4000-8000-000000000001', 'Công ty Tư vấn Chiến lược Đấu giá', 'company',
        'percent', 20, 'active', '[tvdg-seed] Đối tác tư vấn đấu giá — tên & tỉ lệ giữ chỗ')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contracts
  (id, supplier_id, contract_no, title, signed_date, effective_from, effective_to, status, note)
VALUES ('8f2b0000-0000-4000-8000-000000000002', '8f2b0000-0000-4000-8000-000000000001',
        '04/2026/HĐHT-TVDG', 'Hợp tác cung cấp dịch vụ tư vấn phương án đấu giá', DATE '2026-09-01',
        DATE '2026-09-01', DATE '2027-08-31', 'active', '[tvdg-seed] Tỉ lệ giữ chỗ — cập nhật theo hợp đồng thật')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_contract_lines
  (id, contract_id, service_id, service_variant_id, commission_type, commission_value, note)
SELECT '8f2b0000-0000-4000-8000-000000000003', '8f2b0000-0000-4000-8000-000000000002',
       s.id, NULL, 'percent', 20, 'Áp cho mọi gói tư vấn đấu giá'
  FROM public.services s
 WHERE s.name = 'Tư vấn phương án đấu giá'
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Bảng yêu cầu tư vấn + phương án ──────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.asset_auction_consultation_code_seq START 1;

CREATE TABLE public.asset_auction_consultations (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT          NOT NULL UNIQUE
                         DEFAULT ('TD' || lpad(nextval('public.asset_auction_consultation_code_seq')::text, 6, '0')),
  asset_posting_id     UUID          NOT NULL REFERENCES public.asset_postings(id) ON DELETE RESTRICT,
  user_id              UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_variant_id   UUID          NOT NULL REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  package_name         TEXT          NOT NULL,

  -- Bản chụp hồ sơ lúc yêu cầu: chuyên gia không phụ thuộc hồ sơ đang bị sửa.
  posting_title             TEXT     NOT NULL,
  parent_slug               TEXT,
  child_slug                TEXT,
  province                  TEXT,
  posting_pricing_mode      TEXT,
  posting_starting_price    NUMERIC(18,0),
  posting_auction_format    TEXT,
  posting_expected_timeline TEXT,

  -- Mục tiêu bán (RIÊNG TƯ: người bán + admin; không bao giờ ra RPC cho tổ chức).
  sale_goal            TEXT          NOT NULL CHECK (sale_goal IN ('fastest', 'max_price', 'balanced')),
  expected_price       NUMERIC(18,0) CHECK (expected_price > 0),
  min_acceptable_price NUMERIC(18,0) CHECK (min_acceptable_price > 0),
  desired_timeline     TEXT          CHECK (desired_timeline IN ('urgent', 'normal', 'flexible')),
  sale_deadline        DATE,
  request_note         TEXT          CHECK (length(request_note) <= 2000),

  -- Phiên bản phương án: gán lúc hoàn tất. NULL khi chưa xong.
  version              INT           CHECK (version >= 1),

  status               TEXT          NOT NULL DEFAULT 'requested'
                         CHECK (status IN ('requested', 'quoted', 'paid', 'in_review',
                                           'completed', 'superseded', 'cancelled')),

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
  completed_at         TIMESTAMPTZ,
  completed_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  commission_order_id  UUID          UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  superseded_at        TIMESTAMPTZ,

  -- Quyết định của người bán với phương án (chỉ khi đã có phương án).
  seller_decision      TEXT          NOT NULL DEFAULT 'pending'
                         CHECK (seller_decision IN ('pending', 'accepted', 'declined')),
  decided_at           TIMESTAMPTZ,
  decision_note        TEXT          CHECK (length(decision_note) <= 1000),

  cancelled_at         TIMESTAMPTZ,
  cancelled_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason        TEXT          CHECK (length(cancel_reason) <= 2000),

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tvdg_min_le_expected CHECK (
    min_acceptable_price IS NULL OR expected_price IS NULL OR min_acceptable_price <= expected_price),
  CONSTRAINT tvdg_quoted_shape CHECK (
    status IN ('requested', 'cancelled')
    OR (quoted_price IS NOT NULL AND quoted_at IS NOT NULL AND supplier_id IS NOT NULL
        AND partner_name IS NOT NULL AND expert_name IS NOT NULL)),
  CONSTRAINT tvdg_paid_shape CHECK (
    status IN ('requested', 'quoted', 'cancelled') OR (paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL)),
  CONSTRAINT tvdg_cancel_unpaid CHECK (status <> 'cancelled' OR paid_at IS NULL),
  CONSTRAINT tvdg_review_shape CHECK (
    status NOT IN ('in_review', 'completed', 'superseded') OR review_started_at IS NOT NULL),
  CONSTRAINT tvdg_completed_shape CHECK (
    status NOT IN ('completed', 'superseded')
    OR (version IS NOT NULL AND completed_at IS NOT NULL AND commission_order_id IS NOT NULL)),
  CONSTRAINT tvdg_version_only_when_done CHECK (
    version IS NULL OR status IN ('completed', 'superseded')),
  CONSTRAINT tvdg_decision_shape CHECK ((seller_decision = 'pending') = (decided_at IS NULL)),
  CONSTRAINT tvdg_decision_when_done CHECK (
    seller_decision = 'pending' OR status IN ('completed', 'superseded'))
);

COMMENT ON TABLE public.asset_auction_consultations IS
  'Yêu cầu tư vấn phương án đấu giá của hồ sơ số hoá. Ghi CHỈ qua RPC. Đề xuất KHÔNG tự đổi cấu hình phiên (BR-CNS-04).';

CREATE UNIQUE INDEX uq_tvdg_active_per_posting
  ON public.asset_auction_consultations (asset_posting_id)
  WHERE status IN ('requested', 'quoted', 'paid', 'in_review');
CREATE UNIQUE INDEX uq_tvdg_completed_per_posting
  ON public.asset_auction_consultations (asset_posting_id) WHERE status = 'completed';
CREATE UNIQUE INDEX uq_tvdg_version_per_posting
  ON public.asset_auction_consultations (asset_posting_id, version) WHERE version IS NOT NULL;

CREATE INDEX idx_tvdg_posting  ON public.asset_auction_consultations (asset_posting_id, created_at DESC);
CREATE INDEX idx_tvdg_status   ON public.asset_auction_consultations (status, created_at DESC);
CREATE INDEX idx_tvdg_user     ON public.asset_auction_consultations (user_id);
CREATE INDEX idx_tvdg_supplier ON public.asset_auction_consultations (supplier_id);

CREATE TRIGGER asset_auction_consultations_updated_at
  BEFORE UPDATE ON public.asset_auction_consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.asset_auction_consult_proposals (
  consultation_id      UUID          PRIMARY KEY
                         REFERENCES public.asset_auction_consultations(id) ON DELETE CASCADE,
  auction_format       TEXT          CHECK (auction_format IN ('truc_tiep', 'truc_tuyen', 'ca_hai')),
  bidding_method       TEXT          CHECK (bidding_method IN ('ascending', 'descending', 'sealed')),
  starting_price       NUMERIC(18,0) CHECK (starting_price > 0),
  -- Giá bảo lưu: tham khảo RIÊNG TƯ, không bao giờ vào lô công khai.
  reserve_price        NUMERIC(18,0) CHECK (reserve_price > 0),
  bid_step             NUMERIC(18,0) CHECK (bid_step > 0),
  -- Khớp org_open_lot (20260913000003): 60 giây .. 24 giờ.
  lot_duration_minutes INT           CHECK (lot_duration_minutes BETWEEN 1 AND 1440),
  deposit_mode         TEXT          CHECK (deposit_mode IN ('percent', 'amount')),
  deposit_value        NUMERIC(18,2),
  rationale            TEXT          CHECK (length(rationale) <= 4000),
  -- Ghi chú từng tham số: {auction_format|bidding_method|starting_price|reserve_price|bid_step|lot_duration|deposit: text}
  field_notes          JSONB         NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(field_notes) = 'object'),
  finalized_at         TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tvdg_prop_bid_step_le_start CHECK (
    bid_step IS NULL OR starting_price IS NULL OR bid_step <= starting_price),
  CONSTRAINT tvdg_prop_reserve_order CHECK (
    reserve_price IS NULL OR starting_price IS NULL OR bidding_method IS NULL
    OR bidding_method = 'sealed'
    OR (bidding_method = 'ascending'  AND reserve_price >= starting_price)
    OR (bidding_method = 'descending' AND reserve_price <= starting_price)),
  CONSTRAINT tvdg_prop_deposit_pair CHECK ((deposit_mode IS NULL) = (deposit_value IS NULL)),
  CONSTRAINT tvdg_prop_deposit_range CHECK (
    deposit_mode IS NULL
    OR (deposit_mode = 'percent' AND deposit_value > 0 AND deposit_value <= 100)
    OR (deposit_mode = 'amount' AND deposit_value > 0 AND deposit_value = round(deposit_value)
        AND (starting_price IS NULL OR deposit_value <= starting_price))),
  CONSTRAINT tvdg_prop_final_shape CHECK (
    finalized_at IS NULL OR (
      auction_format IS NOT NULL AND bidding_method IS NOT NULL AND starting_price IS NOT NULL
      AND bid_step IS NOT NULL AND deposit_mode IS NOT NULL
      AND length(btrim(COALESCE(rationale, ''))) >= 5
      AND (auction_format = 'truc_tiep' OR lot_duration_minutes IS NOT NULL)))
);

COMMENT ON TABLE public.asset_auction_consult_proposals IS
  'Phương án của một yêu cầu tư vấn đấu giá (nháp khi in_review, bất biến khi finalized_at). Ghi CHỈ qua RPC.';

CREATE OR REPLACE FUNCTION public.asset_auction_consult_proposals_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION 'Phương án tư vấn đã hoàn tất — không sửa được (BR-CNS-05).'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_auction_consult_proposals_immutable
  BEFORE UPDATE OR DELETE ON public.asset_auction_consult_proposals
  FOR EACH ROW EXECUTE FUNCTION public.asset_auction_consult_proposals_immutable();

ALTER TABLE public.asset_auction_consultations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_auction_consult_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_auction_consultations_owner_read
  ON public.asset_auction_consultations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY asset_auction_consultations_admin_read
  ON public.asset_auction_consultations FOR SELECT
  USING (public.admin_has_permission('tu-van-dau-gia', 'view'));

-- Người bán chỉ thấy phương án đã hoàn tất — nháp của chuyên gia không lộ ra.
CREATE POLICY asset_auction_consult_proposals_owner_read
  ON public.asset_auction_consult_proposals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.asset_auction_consultations c
                  WHERE c.id = consultation_id
                    AND c.user_id = auth.uid()
                    AND c.status IN ('completed', 'superseded')));

CREATE POLICY asset_auction_consult_proposals_admin_read
  ON public.asset_auction_consult_proposals FOR SELECT
  USING (public.admin_has_permission('tu-van-dau-gia', 'view'));

-- ─── 4. Nội bộ ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._auction_consult_service_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.services WHERE name = 'Tư vấn phương án đấu giá' AND kind = 'commission' LIMIT 1;
$$;

-- Ghi (upsert) phương án của một yêu cầu. Trả mã lỗi (TEXT) hoặc NULL nếu hợp lệ.
-- Kiểm HẾT trước khi ghi. _strict = true (lúc hoàn tất): đủ tham số + chốt finalized_at.
-- Bản TS: src/lib/auctionConsult/proposal.ts (validateProposal) — sửa luật thì sửa cả hai.
CREATE OR REPLACE FUNCTION public._auction_consult_write_proposal(
  _consultation_id UUID,
  _proposal        JSONB,
  _rationale       TEXT,
  _strict          BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key       TEXT;
  v_val       JSONB;
  v_format    TEXT;
  v_method    TEXT;
  v_start     NUMERIC;
  v_reserve   NUMERIC;
  v_step      NUMERIC;
  v_duration  NUMERIC;
  v_dep_mode  TEXT;
  v_dep_value NUMERIC;
  v_notes     JSONB;
  v_rationale TEXT := NULLIF(btrim(COALESCE(_rationale, '')), '');
BEGIN
  IF _proposal IS NULL OR jsonb_typeof(_proposal) <> 'object' THEN
    RETURN 'invalid_proposal';
  END IF;

  -- Số phải là JSON number (hoặc null / vắng) — tránh lỗi ép kiểu thành exception.
  FOREACH v_key IN ARRAY ARRAY['starting_price', 'reserve_price', 'bid_step', 'lot_duration_minutes', 'deposit_value'] LOOP
    IF _proposal ? v_key AND jsonb_typeof(_proposal->v_key) NOT IN ('number', 'null') THEN
      RETURN 'invalid_proposal';
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['auction_format', 'bidding_method', 'deposit_mode'] LOOP
    IF _proposal ? v_key AND jsonb_typeof(_proposal->v_key) NOT IN ('string', 'null') THEN
      RETURN 'invalid_proposal';
    END IF;
  END LOOP;

  v_format    := NULLIF(_proposal->>'auction_format', '');
  v_method    := NULLIF(_proposal->>'bidding_method', '');
  v_start     := (_proposal->>'starting_price')::numeric;
  v_reserve   := (_proposal->>'reserve_price')::numeric;
  v_step      := (_proposal->>'bid_step')::numeric;
  v_duration  := (_proposal->>'lot_duration_minutes')::numeric;
  v_dep_mode  := NULLIF(_proposal->>'deposit_mode', '');
  v_dep_value := (_proposal->>'deposit_value')::numeric;
  v_notes     := COALESCE(_proposal->'field_notes', '{}'::jsonb);

  IF v_format IS NOT NULL AND v_format NOT IN ('truc_tiep', 'truc_tuyen', 'ca_hai') THEN
    RETURN 'format_invalid';
  END IF;
  IF v_method IS NOT NULL AND v_method NOT IN ('ascending', 'descending', 'sealed') THEN
    RETURN 'method_invalid';
  END IF;
  IF v_start IS NOT NULL AND (v_start <= 0 OR v_start <> round(v_start)) THEN
    RETURN 'starting_price_invalid';
  END IF;
  IF v_reserve IS NOT NULL AND (v_reserve <= 0 OR v_reserve <> round(v_reserve)) THEN
    RETURN 'reserve_invalid';
  END IF;
  IF v_reserve IS NOT NULL AND v_start IS NOT NULL AND (
       (v_method = 'ascending'  AND v_reserve < v_start)
    OR (v_method = 'descending' AND v_reserve > v_start)) THEN
    RETURN 'reserve_invalid';
  END IF;
  IF v_step IS NOT NULL AND (v_step <= 0 OR v_step <> round(v_step)
                             OR (v_start IS NOT NULL AND v_step > v_start)) THEN
    RETURN 'bid_step_invalid';
  END IF;
  IF v_duration IS NOT NULL AND (v_duration <> round(v_duration) OR v_duration < 1 OR v_duration > 1440) THEN
    RETURN 'duration_invalid';
  END IF;
  IF v_dep_mode IS NOT NULL AND v_dep_mode NOT IN ('percent', 'amount') THEN
    RETURN 'deposit_mode_invalid';
  END IF;
  IF (v_dep_mode IS NULL) <> (v_dep_value IS NULL) THEN
    RETURN 'deposit_value_invalid';
  END IF;
  IF v_dep_mode = 'percent' AND (v_dep_value <= 0 OR v_dep_value > 100 OR v_dep_value <> round(v_dep_value, 2)) THEN
    RETURN 'deposit_value_invalid';
  END IF;
  IF v_dep_mode = 'amount' AND (v_dep_value <= 0 OR v_dep_value <> round(v_dep_value)) THEN
    RETURN 'deposit_value_invalid';
  END IF;
  IF v_dep_mode = 'amount' AND v_start IS NOT NULL AND v_dep_value > v_start THEN
    RETURN 'deposit_above_price';
  END IF;

  IF jsonb_typeof(v_notes) <> 'object' THEN
    RETURN 'field_notes_invalid';
  END IF;
  FOR v_key, v_val IN SELECT * FROM jsonb_each(v_notes) LOOP
    IF v_key NOT IN ('auction_format', 'bidding_method', 'starting_price', 'reserve_price',
                     'bid_step', 'lot_duration', 'deposit')
       OR jsonb_typeof(v_val) <> 'string' OR length(v_val #>> '{}') > 1000 THEN
      RETURN 'field_notes_invalid';
    END IF;
  END LOOP;
  -- Bỏ ghi chú rỗng để phương án gọn.
  SELECT COALESCE(jsonb_object_agg(k, to_jsonb(btrim(v))), '{}'::jsonb) INTO v_notes
    FROM jsonb_each_text(v_notes) AS e(k, v) WHERE btrim(v) <> '';

  IF v_rationale IS NOT NULL AND length(v_rationale) > 4000 THEN
    RETURN 'rationale_too_long';
  END IF;

  IF _strict THEN
    IF v_format IS NULL THEN RETURN 'format_required'; END IF;
    IF v_method IS NULL THEN RETURN 'method_required'; END IF;
    IF v_start  IS NULL THEN RETURN 'starting_price_required'; END IF;
    IF v_step   IS NULL THEN RETURN 'bid_step_required'; END IF;
    IF v_dep_mode IS NULL THEN RETURN 'deposit_required'; END IF;
    IF v_format <> 'truc_tiep' AND v_duration IS NULL THEN RETURN 'duration_required'; END IF;
    IF v_rationale IS NULL OR length(v_rationale) < 5 THEN RETURN 'rationale_required'; END IF;
  END IF;

  INSERT INTO public.asset_auction_consult_proposals AS p
    (consultation_id, auction_format, bidding_method, starting_price, reserve_price, bid_step,
     lot_duration_minutes, deposit_mode, deposit_value, rationale, field_notes, finalized_at)
  VALUES
    (_consultation_id, v_format, v_method, v_start, v_reserve, v_step,
     v_duration::int, v_dep_mode, v_dep_value, v_rationale, v_notes,
     CASE WHEN _strict THEN now() END)
  ON CONFLICT (consultation_id) DO UPDATE
     SET auction_format = EXCLUDED.auction_format, bidding_method = EXCLUDED.bidding_method,
         starting_price = EXCLUDED.starting_price, reserve_price = EXCLUDED.reserve_price,
         bid_step = EXCLUDED.bid_step, lot_duration_minutes = EXCLUDED.lot_duration_minutes,
         deposit_mode = EXCLUDED.deposit_mode, deposit_value = EXCLUDED.deposit_value,
         rationale = EXCLUDED.rationale, field_notes = EXCLUDED.field_notes,
         finalized_at = EXCLUDED.finalized_at;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._auction_consult_service_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._auction_consult_write_proposal(UUID, JSONB, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auction_consult_partners()
RETURNS TABLE (supplier_id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.id, sp.name
    FROM public.suppliers sp
   WHERE sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, public._auction_consult_service_id(), NULL, CURRENT_DATE))
   ORDER BY sp.name;
$$;

CREATE OR REPLACE FUNCTION public.auction_consult_package()
RETURNS TABLE (variant_id UUID, variant_key TEXT, name TEXT, from_price NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.variant_key, v.name, v.price
    FROM public.service_variants v
    JOIN public.services s ON s.id = v.service_id
   WHERE s.id = public._auction_consult_service_id() AND s.is_active AND v.is_active
   ORDER BY v.sort_order, v.name
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auction_consult_partners() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_consult_package()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_consult_partners() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_consult_package()  TO authenticated;

-- ─── 5. Người bán: gửi yêu cầu / huỷ / quyết định ────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_request_auction_consult(
  _posting_id     UUID,
  _sale_goal      TEXT,
  _expected_price NUMERIC,
  _min_price      NUMERIC,
  _timeline       TEXT,
  _deadline       DATE,
  _note           TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_var     public.service_variants%ROWTYPE;
  v_active  UUID;
  v_row     public.asset_auction_consultations%ROWTYPE;
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
   WHERE v.variant_key = 'tvdg_plan' AND v.service_id = public._auction_consult_service_id() AND v.is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  IF _sale_goal IS NULL OR _sale_goal NOT IN ('fastest', 'max_price', 'balanced') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_goal');
  END IF;
  IF (_expected_price IS NOT NULL AND (_expected_price <= 0 OR _expected_price <> round(_expected_price)))
     OR (_min_price IS NOT NULL AND (_min_price <= 0 OR _min_price <> round(_min_price))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
  END IF;
  IF _min_price IS NOT NULL AND _expected_price IS NOT NULL AND _min_price > _expected_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'min_above_expected');
  END IF;
  IF _timeline IS NOT NULL AND _timeline NOT IN ('urgent', 'normal', 'flexible') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_timeline');
  END IF;
  IF _deadline IS NOT NULL AND (_deadline < CURRENT_DATE OR _deadline > CURRENT_DATE + 730) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_deadline');
  END IF;

  SELECT id INTO v_active FROM public.asset_auction_consultations
   WHERE asset_posting_id = _posting_id AND status IN ('requested', 'quoted', 'paid', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'consultation_id', v_active);
  END IF;

  -- BR-CNS-04: chỉ ĐỌC hồ sơ để chụp; không ghi asset_postings.
  INSERT INTO public.asset_auction_consultations
    (asset_posting_id, user_id, service_variant_id, package_name,
     posting_title, parent_slug, child_slug, province, posting_pricing_mode,
     posting_starting_price, posting_auction_format, posting_expected_timeline,
     sale_goal, expected_price, min_acceptable_price, desired_timeline, sale_deadline, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id, v_var.name,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_posting.parent_slug,
     v_posting.child_slug, v_posting.province, v_posting.pricing_mode,
     v_posting.starting_price, v_posting.auction_format, v_posting.expected_timeline,
     _sale_goal, _expected_price, _min_price, _timeline, _deadline, left(NULLIF(btrim(_note), ''), 2000))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'consultation_id', v_row.id, 'code', v_row.code);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_cancel_auction_consult(_consultation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_auction_consultations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations
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

  UPDATE public.asset_auction_consultations
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Chấp nhận / Không sử dụng phương án HIỆN HÀNH. Đổi được cho tới khi có bản mới.
CREATE OR REPLACE FUNCTION public.owner_decide_auction_consult(
  _consultation_id UUID,
  _decision        TEXT,
  _note            TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row  public.asset_auction_consultations%ROWTYPE;
  v_note TEXT := left(NULLIF(btrim(COALESCE(_note, '')), ''), 1000);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations
   WHERE id = _consultation_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF _decision IS NULL OR _decision NOT IN ('accepted', 'declined') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_decision');
  END IF;
  IF v_row.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF v_row.seller_decision = _decision AND v_row.decision_note IS NOT DISTINCT FROM v_note THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE public.asset_auction_consultations
     SET seller_decision = _decision, decided_at = now(), decision_note = v_note
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true, 'decision', _decision);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_request_auction_consult(UUID, TEXT, NUMERIC, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cancel_auction_consult(UUID)                                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_decide_auction_consult(UUID, TEXT, TEXT)                            FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_request_auction_consult(UUID, TEXT, NUMERIC, NUMERIC, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_auction_consult(UUID)                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_decide_auction_consult(UUID, TEXT, TEXT)                            TO authenticated;

-- ─── 6. Admin (thay đối tác): báo giá + phân công / huỷ ──────────────────────

CREATE OR REPLACE FUNCTION public.admin_quote_auction_consult(
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
  v_row     public.asset_auction_consultations%ROWTYPE;
  v_partner TEXT;
  v_terms   RECORD;
BEGIN
  IF NOT public.admin_has_permission('tu-van-dau-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations WHERE id = _consultation_id FOR UPDATE;
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
    _supplier_id, public._auction_consult_service_id(), v_row.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > _price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  UPDATE public.asset_auction_consultations
     SET status = 'quoted', supplier_id = _supplier_id, partner_name = v_partner,
         expert_name = btrim(_expert_name),
         quoted_price = _price, quote_note = NULLIF(btrim(_note), ''),
         quoted_at = now(), quote_expires_at = now() + make_interval(days => _valid_days),
         quoted_by = auth.uid()
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_auction_consult(_consultation_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_auction_consultations%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('tu-van-dau-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF length(btrim(COALESCE(_reason, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  UPDATE public.asset_auction_consultations
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = btrim(_reason)
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quote_auction_consult(UUID, UUID, TEXT, NUMERIC, TEXT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_auction_consult(UUID, TEXT)                         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_quote_auction_consult(UUID, UUID, TEXT, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_auction_consult(UUID, TEXT)                         TO authenticated;

-- ─── 7. Thanh toán (mô phỏng VNPay, cùng khuôn tư vấn pháp lý) ────────────────

CREATE OR REPLACE FUNCTION public._settle_auction_consult(
  _consultation_id UUID,
  _txn_ref         TEXT,
  _expected_amount NUMERIC,
  _uid             UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row   public.asset_auction_consultations%ROWTYPE;
  v_claim TEXT;
BEGIN
  IF _uid IS NULL OR btrim(COALESCE(_txn_ref, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_txn');
  END IF;

  SELECT * INTO v_row FROM public.asset_auction_consultations
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
  SELECT btrim(_txn_ref), _uid, v.variant_key, 'tvdg_order:' || v_row.id
    FROM public.service_variants v WHERE v.id = v_row.service_variant_id
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'txn_used');
  END IF;

  UPDATE public.asset_auction_consultations
     SET status = 'paid', paid_at = now(), payment_txn_ref = btrim(_txn_ref)
   WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid', 'consultation_id', v_row.id, 'code', v_row.code,
                            'posting_id', v_row.asset_posting_id);
END;
$$;

REVOKE ALL ON FUNCTION public._settle_auction_consult(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: người bán tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_auction_consult(_consultation_id UUID, _txn_ref TEXT, _expected_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_auction_consult(_consultation_id, _txn_ref, _expected_amount, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.pay_auction_consult(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_auction_consult(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── 8. Admin: bắt đầu / lưu nháp phương án / hoàn tất ───────────────────────

CREATE OR REPLACE FUNCTION public.admin_start_auction_consult(_consultation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_auction_consultations%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission('tu-van-dau-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'in_review' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_auction_consultations
     SET status = 'in_review', review_started_at = now()
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_auction_consult_proposal(
  _consultation_id UUID,
  _proposal        JSONB,
  _rationale       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.asset_auction_consultations%ROWTYPE;
  v_err TEXT;
BEGIN
  IF NOT public.admin_has_permission('tu-van-dau-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status <> 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  v_err := public._auction_consult_write_proposal(_consultation_id, _proposal, _rationale, false);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_auction_consult(
  _consultation_id UUID,
  _proposal        JSONB,
  _rationale       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row     public.asset_auction_consultations%ROWTYPE;
  v_svc     UUID := public._auction_consult_service_id();
  v_terms   RECORD;
  v_err     TEXT;
  v_ledger  UUID;
  v_version INT;
BEGIN
  IF NOT public.admin_has_permission('tu-van-dau-gia', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations WHERE id = _consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status IN ('completed', 'superseded') THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'version', v_row.version);
  END IF;
  IF v_row.status <> 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(
    v_row.supplier_id, v_svc, v_row.service_variant_id, CURRENT_DATE);
  IF v_terms.contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract_terms');
  END IF;
  IF v_terms.commission_type = 'fixed' AND v_terms.commission_value > v_row.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'price_below_commission');
  END IF;

  v_err := public._auction_consult_write_proposal(_consultation_id, _proposal, _rationale, true);
  IF v_err IS NOT NULL THEN
    -- Hàm ghi kiểm hết trước khi upsert, nên lỗi ở đây chưa ghi gì.
    RETURN jsonb_build_object('ok', false, 'reason', v_err);
  END IF;

  -- Khoá hồ sơ (chỉ lock, KHÔNG ghi) để hai lần hoàn tất song song không giành cùng số phiên bản.
  PERFORM 1 FROM public.asset_postings WHERE id = v_row.asset_posting_id FOR UPDATE;
  SELECT COALESCE(max(version), 0) + 1 INTO v_version
    FROM public.asset_auction_consultations WHERE asset_posting_id = v_row.asset_posting_id;

  INSERT INTO public.orders (
    user_id, service_id, service_variant_id, quantity, amount, gross_amount,
    supplier_id, commission_type, commission_value, contract_id, contract_line_id,
    fulfillment_status, ordered_at, fulfilled_at, note, created_by
  ) VALUES (
    v_row.user_id, v_svc, v_row.service_variant_id, 1, 0, v_row.quoted_price,
    v_row.supplier_id, v_terms.commission_type, v_terms.commission_value,
    v_terms.contract_id, v_terms.line_id,
    'fulfilled', COALESCE(v_row.paid_at, now()), now(),
    'Tư vấn đấu giá ' || v_row.code || ' · ' || left(v_row.posting_title, 80) || ' · ' || v_row.partner_name,
    auth.uid()
  )
  RETURNING id INTO v_ledger;

  -- Phương án cũ nhường chỗ (quyết định của người bán với bản cũ giữ nguyên, đóng băng).
  UPDATE public.asset_auction_consultations
     SET status = 'superseded', superseded_at = now()
   WHERE asset_posting_id = v_row.asset_posting_id AND status = 'completed';

  -- BR-CNS-04: chỉ ghi dòng tư vấn. KHÔNG đụng asset_postings / phiên / lô.
  UPDATE public.asset_auction_consultations
     SET status = 'completed', version = v_version,
         completed_at = now(), completed_by = auth.uid(), commission_order_id = v_ledger
   WHERE id = _consultation_id;

  RETURN jsonb_build_object('ok', true, 'version', v_version, 'commission_order_id', v_ledger);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_start_auction_consult(UUID)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_auction_consult_proposal(UUID, JSONB, TEXT)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_complete_auction_consult(UUID, JSONB, TEXT)        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_start_auction_consult(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_auction_consult_proposal(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_auction_consult(UUID, JSONB, TEXT)      TO authenticated;

-- ─── 9. Tổ chức đấu giá: gợi ý khi lập phiên (BR-CNS-06) ─────────────────────
--
-- Một lần gọi cho cả phiên: trả phương án ĐÃ CHẤP NHẬN của bản hiện hành cho mọi hồ sơ
-- mà tổ chức của phiên đang giữ request selected + hợp đồng signed (đúng cổng
-- auction_session_items_validate). Không quyền ⇒ rỗng (không lỗi, không lộ gì).
-- KHÔNG trả mục tiêu / giá mong muốn / giá thấp nhất / ghi chú của người bán.

CREATE OR REPLACE FUNCTION public.org_session_auction_consult_suggestions(_session_id UUID)
RETURNS TABLE (
  asset_posting_id     UUID,
  consultation_id      UUID,
  code                 TEXT,
  version              INT,
  completed_at         TIMESTAMPTZ,
  decided_at           TIMESTAMPTZ,
  expert_name          TEXT,
  partner_name         TEXT,
  auction_format       TEXT,
  bidding_method       TEXT,
  starting_price       NUMERIC,
  reserve_price        NUMERIC,
  bid_step             NUMERIC,
  lot_duration_minutes INT,
  deposit_mode         TEXT,
  deposit_value        NUMERIC,
  rationale            TEXT,
  field_notes          JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ON (c.asset_posting_id)
         c.asset_posting_id, c.id, c.code, c.version, c.completed_at, c.decided_at,
         c.expert_name, c.partner_name,
         p.auction_format, p.bidding_method, p.starting_price, p.reserve_price, p.bid_step,
         p.lot_duration_minutes, p.deposit_mode, p.deposit_value, p.rationale, p.field_notes
    FROM public.auction_sessions s
    JOIN public.asset_service_requests r
      ON r.auction_org_id = s.auction_org_id AND r.status = 'selected'
    JOIN public.consignment_contracts k
      ON k.service_request_id = r.id AND k.status = 'signed'
    JOIN public.asset_auction_consultations c
      ON c.asset_posting_id = r.asset_posting_id
     AND c.status = 'completed' AND c.seller_decision = 'accepted'
    JOIN public.asset_auction_consult_proposals p
      ON p.consultation_id = c.id AND p.finalized_at IS NOT NULL
   WHERE s.id = _session_id
     AND s.auction_org_id IS NOT NULL
     AND s.status <> 'cancelled'
     AND (public.can_manage_auction_sessions(s.organization_id, 'view')
          OR public.can_run_auction(s.organization_id, 'view'))
   ORDER BY c.asset_posting_id, c.version DESC;
$$;

REVOKE ALL ON FUNCTION public.org_session_auction_consult_suggestions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_session_auction_consult_suggestions(UUID) TO authenticated;

-- ─── 10. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_svc UUID := public._auction_consult_service_id();
BEGIN
  IF v_svc IS NULL THEN
    RAISE EXCEPTION 'tvdg self-check: thiếu dịch vụ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE variant_key = 'tvdg_plan' AND service_id = v_svc) THEN
    RAISE EXCEPTION 'tvdg self-check: thiếu gói tvdg_plan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resolve_contract_terms(
                   '8f2b0000-0000-4000-8000-000000000001', v_svc, NULL, DATE '2026-09-15')) THEN
    RAISE EXCEPTION 'tvdg self-check: hợp đồng seed không tra được điều khoản';
  END IF;
  IF has_function_privilege('authenticated', 'public._settle_auction_consult(uuid, text, numeric, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._auction_consult_write_proposal(uuid, jsonb, text, boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._auction_consult_service_id()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.org_session_auction_consult_suggestions(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'tvdg self-check: hàm nội bộ đang mở cho client';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public'
                AND tablename IN ('asset_auction_consultations', 'asset_auction_consult_proposals')
                AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'tvdg self-check: có policy ghi';
  END IF;
END;
$$;

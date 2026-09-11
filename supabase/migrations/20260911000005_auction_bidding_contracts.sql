-- Hồ sơ tham gia đấu giá (bidding contract): người mua trên sàn mua hồ sơ của một
-- PHIÊN đã công bố, trả tiền qua VNPay (mô phỏng); tổ chức đấu giá quản lý hồ sơ
-- đã thanh toán — xác nhận tiền đặt trước, cấp số báo danh.
--
-- ĐƠN VỊ: một hồ sơ / (phiên, người mua). Lô tài sản KHÔNG tham gia điều kiện mua.
--
-- DÒNG TIỀN (quyết định 2026-09-11):
--   Tiền hồ sơ là tiền CỦA tổ chức đấu giá, sàn chỉ thu hộ. Quy tắc gốc của sổ
--   cái (20260719000003): orders.amount = tiền Ở LẠI với sàn. Nên mỗi lần bán là
--   một đơn `commission`: gross_amount = tiền hồ sơ, amount = phần sàn hưởng
--   theo HỢP ĐỒNG HỢP TÁC đang hiệu lực.
--   ⇒ CHỈ bán trực tuyến khi tổ chức đã có hồ sơ đối tác + hợp đồng phủ dịch vụ
--     "Bán hồ sơ tham gia đấu giá". KHÔNG có đường lui 'direct' như ký gửi: ở đó
--     phí môi giới đúng là doanh thu sàn, ở đây là tiền của người khác.
--   Khoản sàn còn nợ tổ chức (gross − amount) CHƯA có sổ theo dõi — việc sau.
--
-- THANH TOÁN & VNeID ĐỀU MÔ PHỎNG:
--   pay_bidding_contract và save_vneid_identity tin client. Khi tích hợp thật,
--   IPN của VNPay / OAuth của VNeID chạy ở Edge Function (service_role) gọi thẳng
--   _settle_bidding_contract / ghi user_verified_identities, rồi thu hồi 2 hàm
--   wrapper khỏi `authenticated`.
--
-- BẢNG HỒ SƠ CHỨA CCCD ⇒ riêng tư, KHÔNG có policy ghi nào: mọi thay đổi đi qua
-- RPC SECURITY DEFINER tự kiểm quyền. Tổ chức chỉ thấy hồ sơ ĐÃ thanh toán.

-- ─── 1. Giá bán hồ sơ trên phiên (công khai được) ───────────────────────────
ALTER TABLE public.auction_sessions
  ADD COLUMN IF NOT EXISTS dossier_fee NUMERIC(18,0);

ALTER TABLE public.auction_sessions DROP CONSTRAINT IF EXISTS auction_sessions_dossier_fee_check;
ALTER TABLE public.auction_sessions
  ADD CONSTRAINT auction_sessions_dossier_fee_check
    CHECK (dossier_fee IS NULL OR dossier_fee >= 0);

COMMENT ON COLUMN public.auction_sessions.dossier_fee IS
  'Tiền bán hồ sơ tham gia (VND). NULL/0 = không bán hồ sơ qua sàn.';

-- ─── 2. Dịch vụ trong catalog ───────────────────────────────────────────────
-- commission ⇒ bị ẩn khỏi catalog công khai (services_public_read). per_order vì
-- một dịch vụ dùng chung cho mọi tổ chức; supplier nằm trên đơn.
INSERT INTO public.services
  (name, kind, category, audience, price, supplier_scope, description, is_active, sort_order)
SELECT 'Bán hồ sơ tham gia đấu giá', 'commission', 'brokerage', 'buyer', 0, 'per_order',
       'Sàn thu hộ tiền hồ sơ tham gia phiên đấu giá cho tổ chức đấu giá. Phần sàn hưởng theo hợp đồng hợp tác đang hiệu lực.',
       true, 92
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Bán hồ sơ tham gia đấu giá');

INSERT INTO public.service_variants (service_id, variant_key, name, price, is_active, sort_order)
SELECT s.id, 'auction_dossier_fee', 'Theo hợp đồng hợp tác', 0, true, 0
FROM public.services s
WHERE s.name = 'Bán hồ sơ tham gia đấu giá'
  AND NOT EXISTS (SELECT 1 FROM public.service_variants WHERE variant_key = 'auction_dossier_fee');

-- ─── 3. Danh tính đã xác thực (VNeID) ───────────────────────────────────────
-- Bảng riêng, KHÔNG nhét vào profiles: profiles được đọc rộng hơn và có trigger
-- KYC chặn UPDATE. Một người một dòng; "Huỷ liên kết" = xoá dòng.
CREATE TABLE IF NOT EXISTS public.user_verified_identities (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source        TEXT NOT NULL DEFAULT 'vneid' CHECK (source IN ('vneid')),
  full_name     TEXT NOT NULL CHECK (length(btrim(full_name)) >= 3),
  id_number     TEXT NOT NULL CHECK (id_number ~ '^[0-9]{12}$'),
  id_issued_on  DATE,
  date_of_birth DATE NOT NULL,
  gender        TEXT CHECK (gender IS NULL OR gender IN ('male', 'female')),
  address       TEXT NOT NULL CHECK (length(btrim(address)) >= 5),
  verified_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_verified_identities_updated_at ON public.user_verified_identities;
CREATE TRIGGER user_verified_identities_updated_at
  BEFORE UPDATE ON public.user_verified_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_verified_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_verified_identities_select_own" ON public.user_verified_identities;
CREATE POLICY "user_verified_identities_select_own" ON public.user_verified_identities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_verified_identities_delete_own" ON public.user_verified_identities;
CREATE POLICY "user_verified_identities_delete_own" ON public.user_verified_identities
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ⚠️ MÔ PHỎNG: client tự khai "đã xác thực". Bản thật do Edge Function OAuth VNeID
-- ghi bằng service_role; khi đó REVOKE hàm này khỏi authenticated.
CREATE OR REPLACE FUNCTION public.save_vneid_identity(
  _full_name     TEXT,
  _id_number     TEXT,
  _date_of_birth DATE,
  _address       TEXT,
  _gender        TEXT DEFAULT NULL,
  _id_issued_on  DATE DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_verified_identities
    (user_id, source, full_name, id_number, id_issued_on, date_of_birth, gender, address, verified_at)
  VALUES
    (v_uid, 'vneid', btrim(_full_name), btrim(_id_number), _id_issued_on, _date_of_birth, _gender, btrim(_address), now())
  ON CONFLICT (user_id) DO UPDATE SET
    full_name     = EXCLUDED.full_name,
    id_number     = EXCLUDED.id_number,
    id_issued_on  = EXCLUDED.id_issued_on,
    date_of_birth = EXCLUDED.date_of_birth,
    gender        = EXCLUDED.gender,
    address       = EXCLUDED.address,
    verified_at   = now();
END; $$;

REVOKE ALL ON FUNCTION public.save_vneid_identity(TEXT, TEXT, DATE, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_vneid_identity(TEXT, TEXT, DATE, TEXT, TEXT, DATE) TO authenticated;

-- ─── 4. Bảng hồ sơ tham gia ─────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.auction_bidding_contract_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.auction_bidding_contracts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      TEXT NOT NULL UNIQUE,
  -- RESTRICT: đã có tiền đi qua thì phiên / tổ chức không được biến mất âm thầm.
  -- Phiên nháp không bao giờ có hồ sơ nên luồng "Xoá nháp" không bị ảnh hưởng.
  session_id                UUID NOT NULL REFERENCES public.auction_sessions(id) ON DELETE RESTRICT,
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  -- SET NULL: bản chụp danh tính bên dưới mới là hồ sơ pháp lý, không phải tài khoản.
  user_id                   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Bản chụp danh tính người đăng ký.
  full_name                 TEXT NOT NULL CHECK (length(btrim(full_name)) >= 3),
  id_type                   TEXT NOT NULL CHECK (id_type IN ('cccd', 'passport')),
  id_number                 TEXT NOT NULL,
  date_of_birth             DATE,
  gender                    TEXT CHECK (gender IS NULL OR gender IN ('male', 'female')),
  phone                     TEXT NOT NULL CHECK (phone ~ '^0[0-9]{9}$'),
  email                     TEXT NOT NULL CHECK (position('@' IN email) > 1),
  address                   TEXT NOT NULL CHECK (length(btrim(address)) >= 5),
  -- Server tự quyết: 'vneid' chỉ khi bản chụp khớp user_verified_identities.
  identity_source           TEXT NOT NULL DEFAULT 'manual' CHECK (identity_source IN ('manual', 'vneid')),

  -- Thanh toán.
  fee_amount                NUMERIC(18,0) NOT NULL CHECK (fee_amount > 0),
  status                    TEXT NOT NULL DEFAULT 'pending_payment'
                              CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
  hold_expires_at           TIMESTAMPTZ,
  payment_txn_ref           TEXT UNIQUE,
  paid_at                   TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  order_id                  UUID REFERENCES public.orders(id) ON DELETE SET NULL,

  -- Tổ chức quản lý sau thanh toán.
  bidder_no                 INT CHECK (bidder_no IS NULL OR bidder_no > 0),
  bidder_no_assigned_at     TIMESTAMPTZ,
  deposit_status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK (deposit_status IN ('pending', 'received', 'refunded', 'forfeited')),
  deposit_amount_received   NUMERIC(18,0) CHECK (deposit_amount_received IS NULL OR deposit_amount_received > 0),
  deposit_received_at       TIMESTAMPTZ,
  deposit_status_changed_at TIMESTAMPTZ,
  deposit_note              TEXT,
  deposit_updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT abc_id_number_shape CHECK (
    (id_type = 'cccd' AND id_number ~ '^[0-9]{9,12}$')
    OR (id_type = 'passport' AND length(btrim(id_number)) >= 6)
  ),
  CONSTRAINT abc_paid_shape CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND payment_txn_ref IS NOT NULL)),
  -- Số báo danh chỉ tồn tại khi đã trả tiền hồ sơ VÀ tiền đặt trước đã qua bước
  -- "đã nhận" (hoàn/giữ sau phiên vẫn giữ số). Cấp mới thì RPC đòi đúng 'received'.
  CONSTRAINT abc_bidder_no_shape CHECK (bidder_no IS NULL OR (status = 'paid' AND deposit_status <> 'pending')),
  CONSTRAINT abc_deposit_shape CHECK (
    deposit_status = 'pending' OR (status = 'paid' AND deposit_amount_received IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_abc_session_user
  ON public.auction_bidding_contracts (session_id, user_id) WHERE status <> 'cancelled' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_abc_session_bidder_no
  ON public.auction_bidding_contracts (session_id, bidder_no) WHERE bidder_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abc_org_paid
  ON public.auction_bidding_contracts (organization_id, paid_at DESC) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_abc_user
  ON public.auction_bidding_contracts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abc_session_status
  ON public.auction_bidding_contracts (session_id, status);

DROP TRIGGER IF EXISTS auction_bidding_contracts_updated_at ON public.auction_bidding_contracts;
CREATE TRIGGER auction_bidding_contracts_updated_at
  BEFORE UPDATE ON public.auction_bidding_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Quyền ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_bidding_contracts(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'ho-so-tham-gia', _action)
      OR EXISTS (SELECT 1 FROM public.organizations o
                  WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_bidding_contracts(UUID, TEXT) TO authenticated;

ALTER TABLE public.auction_bidding_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "abc_select_own" ON public.auction_bidding_contracts;
CREATE POLICY "abc_select_own" ON public.auction_bidding_contracts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Hồ sơ đang chờ thanh toán chứa CCCD mà tổ chức chưa cần ⇒ chỉ thấy bản đã trả.
DROP POLICY IF EXISTS "abc_select_org" ON public.auction_bidding_contracts;
CREATE POLICY "abc_select_org" ON public.auction_bidding_contracts
  FOR SELECT TO authenticated
  USING (status = 'paid' AND public.can_manage_bidding_contracts(organization_id, 'view'));

-- Admin CHỈ ĐỌC: ghi tay sẽ làm hồ sơ và đơn hàng lệch nhau.
DROP POLICY IF EXISTS "abc_admin_select" ON public.auction_bidding_contracts;
CREATE POLICY "abc_admin_select" ON public.auction_bidding_contracts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 6. Điều khoản bán hồ sơ (NỘI BỘ — biên hoa hồng là bí mật) ──────────────
CREATE OR REPLACE FUNCTION public.auction_dossier_terms(
  _auction_org_id UUID,
  _fee            NUMERIC,
  _at             DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  t_supplier_id      UUID,
  t_service_id       UUID,
  t_variant_id       UUID,
  t_contract_id      UUID,
  t_line_id          UUID,
  t_commission_type  TEXT,
  t_commission_value NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_supplier UUID;
  v_service  UUID;
  v_variant  UUID;
  v_terms    RECORD;
BEGIN
  IF _auction_org_id IS NULL THEN RETURN; END IF;

  SELECT s.id INTO v_supplier
    FROM public.suppliers s
   WHERE s.auction_org_id = _auction_org_id AND s.status = 'active'
   LIMIT 1;
  IF v_supplier IS NULL THEN RETURN; END IF;

  SELECT sv.service_id, sv.id INTO v_service, v_variant
    FROM public.service_variants sv WHERE sv.variant_key = 'auction_dossier_fee';
  IF v_service IS NULL THEN RETURN; END IF;

  SELECT * INTO v_terms FROM public.resolve_contract_terms(v_supplier, v_service, v_variant, _at);
  IF NOT FOUND THEN RETURN; END IF;

  -- Hoa hồng cố định lớn hơn tiền hồ sơ ⇒ đơn sẽ vỡ orders_amount_le_gross_check.
  IF _fee IS NOT NULL AND _fee > 0 AND v_terms.commission_type = 'fixed'
     AND v_terms.commission_value > _fee THEN
    RETURN;
  END IF;

  t_supplier_id      := v_supplier;
  t_service_id       := v_service;
  t_variant_id       := v_variant;
  t_contract_id      := v_terms.contract_id;
  t_line_id          := v_terms.line_id;
  t_commission_type  := v_terms.commission_type;
  t_commission_value := v_terms.commission_value;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.auction_dossier_terms(UUID, NUMERIC, DATE) FROM PUBLIC, anon, authenticated;

-- ─── 7. Đọc công khai: số đếm + có bán hay không ────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_session_contract_summary(_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s      RECORD;
  v_paid INT;
  v_held INT;
BEGIN
  SELECT id, status, dossier_fee, auction_org_id INTO s
    FROM public.auction_sessions
   WHERE id = _session_id AND status IN ('published', 'cancelled');
  IF s.id IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) FILTER (WHERE c.status = 'paid'),
         count(*) FILTER (WHERE c.status = 'pending_payment' AND c.hold_expires_at > now())
    INTO v_paid, v_held
    FROM public.auction_bidding_contracts c
   WHERE c.session_id = _session_id;

  RETURN jsonb_build_object(
    'paid_count',   v_paid,
    'held_count',   v_held,
    'sale_enabled', s.status = 'published'
                    AND COALESCE(s.dossier_fee, 0) > 0
                    AND EXISTS (SELECT 1 FROM public.auction_dossier_terms(s.auction_org_id, s.dossier_fee))
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.auction_session_contract_summary(UUID) TO anon, authenticated;

-- Gợi ý trong form phiên: tổ chức đã đủ điều kiện bán hồ sơ qua sàn chưa.
CREATE OR REPLACE FUNCTION public.org_dossier_sale_ready(_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_auction_org UUID;
BEGIN
  IF NOT public.can_manage_auction_sessions(_organization_id, 'view') THEN
    RETURN false;
  END IF;
  SELECT auction_org_id INTO v_auction_org FROM public.organizations WHERE id = _organization_id;
  RETURN EXISTS (SELECT 1 FROM public.auction_dossier_terms(v_auction_org, NULL));
END; $$;

GRANT EXECUTE ON FUNCTION public.org_dossier_sale_ready(UUID) TO authenticated;

-- ─── 8. Người mua: giữ chỗ + nhập danh tính ─────────────────────────────────
-- Khoá tư vấn theo phiên tuần tự hoá phép đếm trần mà không khoá dòng phiên
-- (tổ chức vẫn sửa phiên được trong lúc người mua đặt chỗ).
CREATE OR REPLACE FUNCTION public.start_bidding_contract(
  _session_id    UUID,
  _full_name     TEXT,
  _id_type       TEXT,
  _id_number     TEXT,
  _phone         TEXT,
  _email         TEXT,
  _address       TEXT,
  _date_of_birth DATE DEFAULT NULL,
  _gender        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_name     TEXT := btrim(COALESCE(_full_name, ''));
  v_idnum    TEXT := upper(regexp_replace(COALESCE(_id_number, ''), '\s', '', 'g'));
  v_phone    TEXT := btrim(COALESCE(_phone, ''));
  v_email    TEXT := lower(btrim(COALESCE(_email, '')));
  v_addr     TEXT := btrim(COALESCE(_address, ''));
  v_dob      DATE := _date_of_birth;
  v_gender   TEXT := NULLIF(_gender, '');
  v_hold     TIMESTAMPTZ := now() + interval '15 minutes';
  v_source   TEXT := 'manual';
  s          RECORD;
  v_ident    RECORD;
  v_existing RECORD;
  v_taken    INT;
  v_id       UUID;
  v_code     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập để mua hồ sơ.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || _session_id::text, 0));

  SELECT * INTO s FROM public.auction_sessions WHERE id = _session_id;
  IF s.id IS NULL OR s.status <> 'published' THEN
    RAISE EXCEPTION 'Phiên không tồn tại hoặc không còn công bố.' USING ERRCODE = 'check_violation';
  END IF;
  IF s.starts_at <= now() THEN
    RAISE EXCEPTION 'Phiên đã bắt đầu — không còn bán hồ sơ.' USING ERRCODE = 'check_violation';
  END IF;
  IF s.registration_start_at IS NOT NULL AND now() < s.registration_start_at THEN
    RAISE EXCEPTION 'Chưa đến thời gian bán hồ sơ.' USING ERRCODE = 'check_violation';
  END IF;
  IF s.registration_end_at IS NOT NULL AND now() > s.registration_end_at THEN
    RAISE EXCEPTION 'Đã hết thời gian bán hồ sơ.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(s.dossier_fee, 0) <= 0
     OR NOT EXISTS (SELECT 1 FROM public.auction_dossier_terms(s.auction_org_id, s.dossier_fee)) THEN
    RAISE EXCEPTION 'Tổ chức chưa mở bán hồ sơ trực tuyến cho phiên này.' USING ERRCODE = 'check_violation';
  END IF;

  -- Xung đột lợi ích: người của tổ chức không tự đăng ký phiên của tổ chức mình.
  IF EXISTS (SELECT 1 FROM public.organization_memberships m
              WHERE m.organization_id = s.organization_id AND m.user_id = v_uid AND m.status = 'ACTIVE')
     OR EXISTS (SELECT 1 FROM public.organizations o
                 WHERE o.id = s.organization_id AND o.owner_id = v_uid) THEN
    RAISE EXCEPTION 'Thành viên tổ chức đấu giá không thể mua hồ sơ phiên của chính tổ chức.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Kiểm tra đầu vào bằng câu tiếng Việt trước khi CHECK constraint báo lỗi thô.
  IF length(v_name) < 3 THEN
    RAISE EXCEPTION 'Họ tên tối thiểu 3 ký tự.' USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type NOT IN ('cccd', 'passport') THEN
    RAISE EXCEPTION 'Loại giấy tờ không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type = 'cccd' AND v_idnum !~ '^[0-9]{9,12}$' THEN
    RAISE EXCEPTION 'Số CCCD gồm 9–12 chữ số.' USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type = 'passport' AND length(v_idnum) < 6 THEN
    RAISE EXCEPTION 'Số hộ chiếu tối thiểu 6 ký tự.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_phone !~ '^0[0-9]{9}$' THEN
    RAISE EXCEPTION 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF position('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'Email không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_addr) < 5 THEN
    RAISE EXCEPTION 'Vui lòng nhập địa chỉ liên hệ.' USING ERRCODE = 'check_violation';
  END IF;

  -- Khớp danh tính đã xác thực ⇒ đánh dấu VNeID và lấy ngày sinh / giới tính từ
  -- bản xác thực (không tin bản client gửi).
  SELECT * INTO v_ident FROM public.user_verified_identities WHERE user_id = v_uid;
  IF v_ident.user_id IS NOT NULL AND _id_type = 'cccd'
     AND v_ident.id_number = v_idnum AND lower(v_ident.full_name) = lower(v_name) THEN
    v_source := 'vneid';
    v_dob    := v_ident.date_of_birth;
    v_gender := v_ident.gender;
  END IF;

  SELECT * INTO v_existing
    FROM public.auction_bidding_contracts
   WHERE session_id = _session_id AND user_id = v_uid AND status <> 'cancelled'
   FOR UPDATE;
  IF v_existing.id IS NOT NULL AND v_existing.status = 'paid' THEN
    RAISE EXCEPTION 'Bạn đã mua hồ sơ tham gia phiên này.' USING ERRCODE = 'check_violation';
  END IF;

  IF s.max_registrants IS NOT NULL THEN
    SELECT count(*) INTO v_taken
      FROM public.auction_bidding_contracts c
     WHERE c.session_id = _session_id
       AND c.user_id IS DISTINCT FROM v_uid
       AND (c.status = 'paid' OR (c.status = 'pending_payment' AND c.hold_expires_at > now()));
    IF v_taken >= s.max_registrants THEN
      RAISE EXCEPTION 'Phiên đã đủ số người đăng ký.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.auction_bidding_contracts
       SET full_name = v_name, id_type = _id_type, id_number = v_idnum,
           date_of_birth = v_dob, gender = v_gender, phone = v_phone, email = v_email,
           address = v_addr, identity_source = v_source,
           fee_amount = s.dossier_fee, hold_expires_at = v_hold
     WHERE id = v_existing.id
     RETURNING id, code INTO v_id, v_code;
  ELSE
    INSERT INTO public.auction_bidding_contracts
      (code, session_id, organization_id, user_id,
       full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
       fee_amount, status, hold_expires_at)
    VALUES
      ('HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'),
       _session_id, s.organization_id, v_uid,
       v_name, _id_type, v_idnum, v_dob, v_gender, v_phone, v_email, v_addr, v_source,
       s.dossier_fee, 'pending_payment', v_hold)
    RETURNING id, code INTO v_id, v_code;
  END IF;

  RETURN jsonb_build_object(
    'contract_id',     v_id,
    'code',            v_code,
    'fee_amount',      s.dossier_fee,
    'hold_expires_at', v_hold,
    'identity_source', v_source
  );
END; $$;

REVOKE ALL ON FUNCTION public.start_bidding_contract(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_bidding_contract(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_bidding_contract(_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.auction_bidding_contracts
     SET status = 'cancelled', cancelled_at = now(), hold_expires_at = NULL
   WHERE id = _contract_id AND user_id = auth.uid() AND status = 'pending_payment';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chỉ huỷ được hồ sơ đang chờ thanh toán của chính bạn.' USING ERRCODE = 'check_violation';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.cancel_bidding_contract(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_bidding_contract(UUID) TO authenticated;

-- ─── 9. Ghi nhận thanh toán ─────────────────────────────────────────────────
-- Hàm THẬT (nội bộ). Một transaction: vé idempotent + đơn hoa hồng + đánh dấu đã
-- trả. KHÔNG dùng claim_payment_txn: hàm đó ở client coi lỗi RPC là "cho qua".
CREATE OR REPLACE FUNCTION public._settle_bidding_contract(
  _contract_id UUID,
  _txn_ref     TEXT,
  _uid         UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sid    UUID;
  c        RECORD;
  s        RECORD;
  v_taken  INT;
  v_claim  TEXT;
  v_terms  RECORD;
  v_sup    UUID;
  v_svc    UUID;
  v_var    UUID;
  v_ctype  TEXT;
  v_cval   NUMERIC;
  v_cid    UUID;
  v_line   UUID;
  v_note   TEXT;
  v_order  UUID;
BEGIN
  IF _uid IS NULL OR btrim(COALESCE(_txn_ref, '')) = '' THEN
    RAISE EXCEPTION 'Thiếu thông tin giao dịch.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT session_id INTO v_sid
    FROM public.auction_bidding_contracts WHERE id = _contract_id AND user_id = _uid;
  IF v_sid IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ tham gia.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Cùng khoá với start_bidding_contract để phép đếm trần nhất quán.
  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));
  SELECT * INTO c FROM public.auction_bidding_contracts WHERE id = _contract_id FOR UPDATE;

  IF c.status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid', 'contract_id', c.id, 'code', c.code, 'session_id', c.session_id);
  END IF;
  IF c.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Hồ sơ đã bị huỷ.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.hold_expires_at IS NULL OR c.hold_expires_at <= now() THEN
    RAISE EXCEPTION 'Thời gian giữ chỗ đã hết — vui lòng quay lại phiên và thanh toán lại.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO s FROM public.auction_sessions WHERE id = c.session_id;
  IF s.status <> 'published' OR s.starts_at <= now() THEN
    RAISE EXCEPTION 'Phiên không còn nhận hồ sơ.' USING ERRCODE = 'check_violation';
  END IF;

  IF s.max_registrants IS NOT NULL THEN
    SELECT count(*) INTO v_taken
      FROM public.auction_bidding_contracts x
     WHERE x.session_id = c.session_id AND x.id <> c.id
       AND (x.status = 'paid' OR (x.status = 'pending_payment' AND x.hold_expires_at > now()));
    IF v_taken >= s.max_registrants THEN
      RAISE EXCEPTION 'Phiên đã đủ số người đăng ký.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  VALUES (btrim(_txn_ref), _uid, 'auction_dossier_fee', 'contract:' || c.id)
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO v_claim;
  IF v_claim IS NULL THEN
    RAISE EXCEPTION 'Mã giao dịch đã được sử dụng.' USING ERRCODE = 'unique_violation';
  END IF;

  v_note := 'Hồ sơ ' || c.code || ' · phiên ' || COALESCE(s.code, '');

  -- Tra lại điều khoản TẠI LÚC GHI SỔ (hợp đồng có thể vừa đổi trong lúc giữ chỗ).
  SELECT * INTO v_terms FROM public.auction_dossier_terms(s.auction_org_id, c.fee_amount);
  IF v_terms.t_supplier_id IS NOT NULL THEN
    v_sup   := v_terms.t_supplier_id;
    v_svc   := v_terms.t_service_id;
    v_var   := v_terms.t_variant_id;
    v_ctype := v_terms.t_commission_type;
    v_cval  := v_terms.t_commission_value;
    v_cid   := v_terms.t_contract_id;
    v_line  := v_terms.t_line_id;
  ELSE
    -- Hợp đồng hết hiệu lực giữa lúc giữ chỗ và lúc trả: người mua đã trả tiền,
    -- không được chặn. Ghi hoa hồng 0 để admin đối soát tay.
    SELECT id INTO v_sup FROM public.suppliers WHERE auction_org_id = s.auction_org_id LIMIT 1;
    IF v_sup IS NULL THEN
      RAISE EXCEPTION 'Tổ chức chưa có hồ sơ đối tác — chưa ghi nhận được thanh toán.'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT sv.service_id, sv.id INTO v_svc, v_var
      FROM public.service_variants sv WHERE sv.variant_key = 'auction_dossier_fee';
    v_ctype := 'fixed';
    v_cval  := 0;
    v_note  := v_note || ' · Chưa có điều khoản hợp đồng lúc ghi sổ — cần đối soát';
  END IF;

  INSERT INTO public.orders (
    user_id, service_id, service_variant_id, quantity, amount, gross_amount,
    supplier_id, commission_type, commission_value, contract_id, contract_line_id,
    fulfillment_status, ordered_at, fulfilled_at, note, created_by
  ) VALUES (
    _uid, v_svc, v_var, 1, 0, c.fee_amount,
    v_sup, v_ctype, v_cval, v_cid, v_line,
    'fulfilled', now(), now(), v_note, _uid
  )
  RETURNING id INTO v_order;

  UPDATE public.auction_bidding_contracts
     SET status = 'paid', paid_at = now(), payment_txn_ref = btrim(_txn_ref),
         order_id = v_order, hold_expires_at = NULL
   WHERE id = c.id;

  RETURN jsonb_build_object('status', 'paid', 'contract_id', c.id, 'code', c.code,
                            'session_id', c.session_id, 'order_id', v_order);
END; $$;

REVOKE ALL ON FUNCTION public._settle_bidding_contract(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- ⚠️ MÔ PHỎNG: người mua tự báo "đã thanh toán". Xoá khi có IPN VNPay thật.
CREATE OR REPLACE FUNCTION public.pay_bidding_contract(_contract_id UUID, _txn_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public._settle_bidding_contract(_contract_id, _txn_ref, auth.uid());
END; $$;

REVOKE ALL ON FUNCTION public.pay_bidding_contract(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_bidding_contract(UUID, TEXT) TO authenticated;

-- ─── 10. Tổ chức: tiền đặt trước ────────────────────────────────────────────
-- pending → received → refunded | forfeited ; lùi được một bước để sửa nhầm.
-- Lùi về pending xoá luôn số báo danh (số chỉ tồn tại sau khi đã nhận tiền).
CREATE OR REPLACE FUNCTION public.org_set_contract_deposit(
  _contract_id UUID,
  _status      TEXT,
  _amount      NUMERIC DEFAULT NULL,
  _note        TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_ok     BOOLEAN;
  v_amount NUMERIC;
BEGIN
  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;
  IF c.id IS NULL OR NOT public.can_manage_bidding_contracts(c.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ, hoặc bạn không có quyền cập nhật.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'paid' THEN
    RAISE EXCEPTION 'Chỉ cập nhật tiền đặt trước cho hồ sơ đã thanh toán.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status NOT IN ('pending', 'received', 'refunded', 'forfeited') THEN
    RAISE EXCEPTION 'Trạng thái tiền đặt trước không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;

  v_ok := (_status = c.deposit_status AND _status = 'received')
       OR (c.deposit_status = 'pending'  AND _status = 'received')
       OR (c.deposit_status = 'received' AND _status IN ('pending', 'refunded', 'forfeited'))
       OR (c.deposit_status IN ('refunded', 'forfeited') AND _status = 'received');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Không thể chuyển tiền đặt trước từ "%" sang "%".', c.deposit_status, _status
      USING ERRCODE = 'check_violation';
  END IF;

  IF c.session_status = 'cancelled' AND NOT (c.deposit_status = 'received' AND _status = 'refunded') THEN
    RAISE EXCEPTION 'Phiên đã huỷ — chỉ ghi nhận hoàn trả tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  v_amount := CASE WHEN _status = 'pending' THEN NULL ELSE COALESCE(_amount, c.deposit_amount_received) END;
  IF _status <> 'pending' AND COALESCE(v_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Nhập số tiền đặt trước đã nhận.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status = 'forfeited' AND btrim(COALESCE(_note, '')) = '' THEN
    RAISE EXCEPTION 'Nhập lý do không hoàn trả tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET deposit_status            = _status,
         deposit_amount_received   = v_amount,
         deposit_received_at       = CASE
                                       WHEN _status = 'pending' THEN NULL
                                       WHEN c.deposit_status = 'pending' THEN now()
                                       ELSE deposit_received_at
                                     END,
         deposit_status_changed_at = now(),
         deposit_note              = CASE WHEN _note IS NULL THEN deposit_note ELSE NULLIF(btrim(_note), '') END,
         deposit_updated_by        = auth.uid(),
         bidder_no                 = CASE WHEN _status = 'pending' THEN NULL ELSE bidder_no END,
         bidder_no_assigned_at     = CASE WHEN _status = 'pending' THEN NULL ELSE bidder_no_assigned_at END
   WHERE id = c.id;
END; $$;

REVOKE ALL ON FUNCTION public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ─── 11. Tổ chức: số báo danh ───────────────────────────────────────────────
-- _bidder_no NULL = tự cấp max+1 trong phiên (giữ số cũ nếu đã có).
CREATE OR REPLACE FUNCTION public.org_assign_bidder_no(_contract_id UUID, _bidder_no INT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sid UUID;
  v_org UUID;
  c     RECORD;
  v_no  INT;
BEGIN
  SELECT session_id, organization_id INTO v_sid, v_org
    FROM public.auction_bidding_contracts WHERE id = _contract_id;
  IF v_sid IS NULL OR NOT public.can_manage_bidding_contracts(v_org, 'update') THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ, hoặc bạn không có quyền cập nhật.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || v_sid::text, 0));

  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;

  IF c.status <> 'paid' THEN
    RAISE EXCEPTION 'Chỉ cấp số báo danh cho hồ sơ đã thanh toán.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.session_status = 'cancelled' THEN
    RAISE EXCEPTION 'Phiên đã huỷ — không cấp số báo danh.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.deposit_status <> 'received' THEN
    RAISE EXCEPTION 'Chỉ cấp số báo danh sau khi đã xác nhận nhận tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  IF _bidder_no IS NULL THEN
    v_no := COALESCE(c.bidder_no,
                     (SELECT COALESCE(max(bidder_no), 0) + 1
                        FROM public.auction_bidding_contracts WHERE session_id = c.session_id));
  ELSE
    IF _bidder_no <= 0 THEN
      RAISE EXCEPTION 'Số báo danh phải là số nguyên dương.' USING ERRCODE = 'check_violation';
    END IF;
    v_no := _bidder_no;
  END IF;

  IF EXISTS (SELECT 1 FROM public.auction_bidding_contracts
              WHERE session_id = c.session_id AND bidder_no = v_no AND id <> c.id) THEN
    RAISE EXCEPTION 'Số báo danh % đã cấp cho hồ sơ khác trong phiên.', v_no USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET bidder_no = v_no, bidder_no_assigned_at = now()
   WHERE id = c.id;
  RETURN v_no;
END; $$;

REVOKE ALL ON FUNCTION public.org_assign_bidder_no(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_assign_bidder_no(UUID, INT) TO authenticated;

-- ─── 12. Không cho hạ trần người đăng ký dưới số đã bán ─────────────────────
CREATE OR REPLACE FUNCTION public.auction_sessions_cap_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_paid INT;
BEGIN
  IF NEW.max_registrants IS NOT NULL AND NEW.max_registrants IS DISTINCT FROM OLD.max_registrants THEN
    SELECT count(*) INTO v_paid
      FROM public.auction_bidding_contracts WHERE session_id = NEW.id AND status = 'paid';
    IF v_paid > NEW.max_registrants THEN
      RAISE EXCEPTION 'Đã có % hồ sơ đã thanh toán — không thể giảm số người đăng ký tối đa xuống %.',
        v_paid, NEW.max_registrants USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_sessions_cap_guard ON public.auction_sessions;
CREATE TRIGGER auction_sessions_cap_guard
  BEFORE UPDATE OF max_registrants ON public.auction_sessions
  FOR EACH ROW EXECUTE FUNCTION public.auction_sessions_cap_guard();

-- ─── 13. Mã quyền tổ chức `ho-so-tham-gia` ──────────────────────────────────
-- Backfill CẢ MANAGER lẫn AGENT (bài học 20260906100002). OWNER không cần dòng.
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'ho-so-tham-gia', v.action
FROM public.org_roles r
JOIN (VALUES
  ('MANAGER', 'view'), ('MANAGER', 'update'),
  ('AGENT',   'view')
) AS v(code, action) ON v.code = r.code
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Preset cho tổ chức tạo mới — chép nguyên bản 20260911000003, chỉ thêm ho-so-tham-gia.
CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _owner_role_id UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, code, description, is_system)
  VALUES (_org_id, 'Chủ sở hữu', 'OWNER', 'Toàn quyền trong tổ chức. Không thể xóa.', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO _owner_role_id;

  INSERT INTO public.org_roles (organization_id, name, code, description, is_system) VALUES
    (_org_id, 'Quản lý',   'MANAGER', 'Quản lý hồ sơ năng lực, hồ sơ dự tuyển và thành viên.', false),
    (_org_id, 'Nhân viên', 'AGENT',   'Xem hồ sơ và lập hồ sơ dự tuyển.', false)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT r.id, v.module, v.action
  FROM public.org_roles r
  JOIN (VALUES
    ('MANAGER','tong-quan','view'),
    ('MANAGER','nl-thong-tin-chung','view'),   ('MANAGER','nl-thong-tin-chung','update'),
    ('MANAGER','nl-dau-gia-vien','view'),      ('MANAGER','nl-dau-gia-vien','create'),
    ('MANAGER','nl-dau-gia-vien','update'),    ('MANAGER','nl-dau-gia-vien','delete'),
    ('MANAGER','nhan-su','view'),              ('MANAGER','nhan-su','update'),
    ('MANAGER','nhan-su','export'),
    ('MANAGER','boi-duong','view'),            ('MANAGER','boi-duong','create'),
    ('MANAGER','boi-duong','update'),          ('MANAGER','boi-duong','delete'),
    ('MANAGER','boi-duong','export'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','yeu-cau-ky-gui','view'),       ('MANAGER','yeu-cau-ky-gui','update'),
    ('MANAGER','phien-dau-gia','view'),        ('MANAGER','phien-dau-gia','create'),
    ('MANAGER','phien-dau-gia','update'),      ('MANAGER','phien-dau-gia','delete'),
    ('MANAGER','ho-so-tham-gia','view'),       ('MANAGER','ho-so-tham-gia','update'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nhan-su','view'),                ('AGENT','nhan-su','export'),
    ('AGENT','boi-duong','view'),              ('AGENT','boi-duong','export'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','yeu-cau-ky-gui','view'),
    ('AGENT','phien-dau-gia','view'),
    ('AGENT','ho-so-tham-gia','view'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;

-- ─── 14. Kiểm chứng ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_leak TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.service_variants WHERE variant_key = 'auction_dossier_fee') THEN
    RAISE EXCEPTION 'Thiếu biến thể dịch vụ auction_dossier_fee';
  END IF;

  -- Hàm nội bộ không được lọt cho vai thường.
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_leak
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('auction_dossier_terms', '_settle_bidding_contract')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm nội bộ vẫn gọi được bởi vai thường: %', v_leak;
  END IF;

  -- Hàm ghi của người mua / tổ chức không được mở cho khách vãng lai.
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_leak
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('start_bidding_contract', 'pay_bidding_contract', 'cancel_bidding_contract',
                       'org_set_contract_deposit', 'org_assign_bidder_no', 'save_vneid_identity')
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm ghi vẫn gọi được bởi anon: %', v_leak;
  END IF;

  RAISE NOTICE 'OK: hồ sơ tham gia đấu giá sẵn sàng';
END $$;

-- Người mua là tổ chức + uỷ quyền + ảnh giấy tờ trên hồ sơ tham gia — W0/M2
-- (docs/bidder-ekyc-checkin-plan.md §2.2, B1/B2).
--
-- Hồ sơ là BẢN CHỤP pháp lý ⇒ đường dẫn ảnh được CHÉP vào hồ sơ, không trỏ ngược
-- về user_verified_identities (người dùng đổi/xoá danh tính sau đó không làm hồ
-- sơ đã nộp thay đổi). Ảnh bị policy chặn xoá khi còn hồ sơ tham chiếu.
--
-- start_bidding_contract ĐỔI CHỮ KÝ: (_session_id UUID, _payload JSONB). Mọi
-- trường người đăng ký nằm trong payload để lần sau thêm trường không phải đổi
-- chữ ký nữa. CREATE OR REPLACE không đổi được chữ ký (tạo hàm nạp chồng ⇒
-- PostgREST PGRST203) ⇒ DROP bản cũ, áp lại REVOKE/GRANT, assert còn đúng 1 bản.
--
-- Payload (client: StartContractPayload trong src/types/bidding-contract.ts):
--   { buyer_kind: 'individual'|'organization', phone, email,
--     principal:    { full_name, id_type, id_number, date_of_birth?, gender?, address,
--                     id_front_path?, id_back_path?, read_method?, edited_fields? },
--     organization: { name, tax_code, address, reg_doc_path }      -- khi organization
--     proxy:        { full_name, id_type, id_number, date_of_birth?, gender?, phone,
--                     address, id_front_path, id_back_path?, read_method?,
--                     edited_fields?, poa_doc_path } | null }
-- principal = chính người đăng ký (cá nhân) HOẶC người đại diện theo pháp luật (tổ chức).

-- ─── 1. Cột mới ─────────────────────────────────────────────────────────────
ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN IF NOT EXISTS buyer_kind             TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS org_name               TEXT,
  ADD COLUMN IF NOT EXISTS org_tax_code           TEXT,
  ADD COLUMN IF NOT EXISTS org_address            TEXT,
  ADD COLUMN IF NOT EXISTS org_reg_doc_path       TEXT,
  ADD COLUMN IF NOT EXISTS id_front_path          TEXT,
  ADD COLUMN IF NOT EXISTS id_back_path           TEXT,
  ADD COLUMN IF NOT EXISTS id_read_method         TEXT,
  ADD COLUMN IF NOT EXISTS id_edited_fields       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_proxy              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxy_full_name        TEXT,
  ADD COLUMN IF NOT EXISTS proxy_id_type          TEXT,
  ADD COLUMN IF NOT EXISTS proxy_id_number        TEXT,
  ADD COLUMN IF NOT EXISTS proxy_date_of_birth    DATE,
  ADD COLUMN IF NOT EXISTS proxy_gender           TEXT,
  ADD COLUMN IF NOT EXISTS proxy_phone            TEXT,
  ADD COLUMN IF NOT EXISTS proxy_address          TEXT,
  ADD COLUMN IF NOT EXISTS proxy_id_front_path    TEXT,
  ADD COLUMN IF NOT EXISTS proxy_id_back_path     TEXT,
  ADD COLUMN IF NOT EXISTS proxy_id_read_method   TEXT,
  ADD COLUMN IF NOT EXISTS proxy_id_edited_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS poa_doc_path           TEXT;

ALTER TABLE public.auction_bidding_contracts
  DROP CONSTRAINT IF EXISTS abc_buyer_kind_check,
  DROP CONSTRAINT IF EXISTS abc_read_method_check,
  DROP CONSTRAINT IF EXISTS abc_org_shape,
  DROP CONSTRAINT IF EXISTS abc_proxy_shape,
  DROP CONSTRAINT IF EXISTS abc_images_shape;

ALTER TABLE public.auction_bidding_contracts
  ADD CONSTRAINT abc_buyer_kind_check CHECK (buyer_kind IN ('individual', 'organization')),
  ADD CONSTRAINT abc_read_method_check CHECK (
    (id_read_method IS NULL OR id_read_method IN ('qr', 'ocr', 'typed'))
    AND (proxy_id_read_method IS NULL OR proxy_id_read_method IN ('qr', 'ocr', 'typed'))
  ),
  ADD CONSTRAINT abc_org_shape CHECK (
    (buyer_kind = 'individual'
       AND org_name IS NULL AND org_tax_code IS NULL AND org_address IS NULL AND org_reg_doc_path IS NULL)
    OR (buyer_kind = 'organization'
       AND length(btrim(COALESCE(org_name, ''))) >= 3
       AND org_tax_code ~ '^[0-9]{10}([0-9]{3})?$'
       AND length(btrim(COALESCE(org_address, ''))) >= 5
       AND org_reg_doc_path IS NOT NULL)
  ),
  ADD CONSTRAINT abc_proxy_shape CHECK (
    (NOT has_proxy
       AND proxy_full_name IS NULL AND proxy_id_type IS NULL AND proxy_id_number IS NULL
       AND proxy_date_of_birth IS NULL AND proxy_gender IS NULL AND proxy_phone IS NULL
       AND proxy_address IS NULL AND proxy_id_front_path IS NULL AND proxy_id_back_path IS NULL
       AND proxy_id_read_method IS NULL AND poa_doc_path IS NULL)
    OR (has_proxy
       AND length(btrim(COALESCE(proxy_full_name, ''))) >= 3
       AND ((proxy_id_type = 'cccd' AND proxy_id_number ~ '^[0-9]{9,12}$')
            OR (proxy_id_type = 'passport' AND length(btrim(COALESCE(proxy_id_number, ''))) >= 6))
       AND (proxy_gender IS NULL OR proxy_gender IN ('male', 'female'))
       AND proxy_phone ~ '^0[0-9]{9}$'
       AND length(btrim(COALESCE(proxy_address, ''))) >= 5
       AND proxy_id_front_path IS NOT NULL
       AND (proxy_id_type = 'passport' OR proxy_id_back_path IS NOT NULL)
       AND proxy_id_read_method IS NOT NULL
       AND poa_doc_path IS NOT NULL)
  ),
  -- Ảnh giấy tờ của người đăng ký bắt buộc với hồ sơ tạo SAU mốc chuyển đổi, trừ
  -- khi danh tính khớp VNeID. Không dùng NOT VALID: hồ sơ cũ vẫn bị kiểm lại mỗi
  -- lần UPDATE (đổi tiền đặt trước…) và sẽ vỡ.
  ADD CONSTRAINT abc_images_shape CHECK (
    created_at < timestamptz '2026-10-08 00:00:00+07'
    OR identity_source = 'vneid'
    OR (id_front_path IS NOT NULL AND id_read_method IS NOT NULL
        AND (id_type = 'passport' OR id_back_path IS NOT NULL))
  );

COMMENT ON COLUMN public.auction_bidding_contracts.buyer_kind IS
  'individual = cá nhân tự đăng ký; organization = tổ chức (full_name… là người đại diện theo pháp luật).';
COMMENT ON COLUMN public.auction_bidding_contracts.has_proxy IS
  'Người tham dự là người được uỷ quyền (proxy_*) + giấy uỷ quyền poa_doc_path.';

-- ─── 2. Storage: tham chiếu + quyền đọc của tổ chức ─────────────────────────
CREATE OR REPLACE FUNCTION public.buyer_kyc_path_referenced(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_verified_identities v
                  WHERE _name IN (v.id_front_path, v.id_back_path))
      OR EXISTS (SELECT 1 FROM public.auction_bidding_contracts c
                  WHERE c.status <> 'cancelled'
                    AND _name IN (c.id_front_path, c.id_back_path, c.org_reg_doc_path,
                                  c.proxy_id_front_path, c.proxy_id_back_path, c.poa_doc_path))
$$;

-- Tổ chức chỉ đọc ảnh của hồ sơ ĐÃ thanh toán thuộc tổ chức mình (cùng ranh giới
-- với policy abc_select_org). 'checkin' = nhân viên điểm danh cần so ảnh tại cửa.
CREATE OR REPLACE FUNCTION public.can_read_buyer_kyc_object(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_bidding_contracts c
     WHERE c.status = 'paid'
       AND _name IN (c.id_front_path, c.id_back_path, c.org_reg_doc_path,
                     c.proxy_id_front_path, c.proxy_id_back_path, c.poa_doc_path)
       AND (public.can_manage_bidding_contracts(c.organization_id, 'view')
            OR public.can_manage_bidding_contracts(c.organization_id, 'checkin'))
  )
$$;

REVOKE ALL ON FUNCTION public.can_read_buyer_kyc_object(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_buyer_kyc_object(TEXT) TO authenticated;

DROP POLICY IF EXISTS "buyer_kyc_select_org" ON storage.objects;
CREATE POLICY "buyer_kyc_select_org"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buyer-kyc' AND public.can_read_buyer_kyc_object(name));

-- ─── 3. Đọc + kiểm payload người đăng ký (nội bộ) ───────────────────────────
CREATE OR REPLACE FUNCTION public._jsonb_text_array(_j JSONB)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(_j) = 'array'
              THEN ARRAY(SELECT jsonb_array_elements_text(_j))
              ELSE '{}'::text[] END
$$;

REVOKE ALL ON FUNCTION public._jsonb_text_array(JSONB) FROM PUBLIC, anon, authenticated;

-- Kiểm một khối danh tính; RAISE câu tiếng Việt có nêu "của ai".
CREATE OR REPLACE FUNCTION public._kyc_check_identity(
  _who       TEXT,
  _full_name TEXT,
  _id_type   TEXT,
  _id_number TEXT,
  _address   TEXT,
  _gender    TEXT,
  _dob       DATE
) RETURNS VOID
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
BEGIN
  IF length(COALESCE(_full_name, '')) < 3 THEN
    RAISE EXCEPTION 'Họ tên %: tối thiểu 3 ký tự.', _who USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type IS NULL OR _id_type NOT IN ('cccd', 'passport') THEN
    RAISE EXCEPTION 'Loại giấy tờ của % không hợp lệ.', _who USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type = 'cccd' AND COALESCE(_id_number, '') !~ '^[0-9]{9,12}$' THEN
    RAISE EXCEPTION 'Số CCCD của % gồm 9–12 chữ số.', _who USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type = 'passport' AND length(COALESCE(_id_number, '')) < 6 THEN
    RAISE EXCEPTION 'Số hộ chiếu của % tối thiểu 6 ký tự.', _who USING ERRCODE = 'check_violation';
  END IF;
  IF length(COALESCE(_address, '')) < 5 THEN
    RAISE EXCEPTION 'Vui lòng nhập địa chỉ của %.', _who USING ERRCODE = 'check_violation';
  END IF;
  IF _gender IS NOT NULL AND _gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính của % không hợp lệ.', _who USING ERRCODE = 'check_violation';
  END IF;
  IF _dob IS NOT NULL AND (_dob > CURRENT_DATE - interval '14 years' OR _dob < DATE '1900-01-01') THEN
    RAISE EXCEPTION 'Ngày sinh của % không hợp lệ.', _who USING ERRCODE = 'check_violation';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public._kyc_check_identity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;

-- Trả về một dòng hồ sơ CHỈ có các cột bên tham gia đã điền + chuẩn hoá. Dùng
-- chung cho start_bidding_contract và resubmit_bidding_contract (M3) ⇒ hai
-- đường ghi không bao giờ lệch luật nhau.
CREATE OR REPLACE FUNCTION public._bidding_parties_from_payload(_uid UUID, _payload JSONB)
RETURNS public.auction_bidding_contracts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r       public.auction_bidding_contracts;
  p       JSONB := CASE WHEN jsonb_typeof(_payload->'principal') = 'object' THEN _payload->'principal' ELSE '{}'::jsonb END;
  o       JSONB := CASE WHEN jsonb_typeof(_payload->'organization') = 'object' THEN _payload->'organization' END;
  x       JSONB := CASE WHEN jsonb_typeof(_payload->'proxy') = 'object' THEN _payload->'proxy' END;
  v_who   TEXT;
  v_ident RECORD;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'Thiếu thông tin người đăng ký.' USING ERRCODE = 'check_violation';
  END IF;

  r.buyer_kind := COALESCE(NULLIF(_payload->>'buyer_kind', ''), 'individual');
  IF r.buyer_kind NOT IN ('individual', 'organization') THEN
    RAISE EXCEPTION 'Loại người đăng ký không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  v_who := CASE r.buyer_kind WHEN 'organization' THEN 'người đại diện theo pháp luật' ELSE 'người đăng ký' END;

  -- Liên hệ của hồ sơ.
  r.phone := btrim(COALESCE(_payload->>'phone', ''));
  r.email := lower(btrim(COALESCE(_payload->>'email', '')));
  IF r.phone !~ '^0[0-9]{9}$' THEN
    RAISE EXCEPTION 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF position('@' IN r.email) < 2 THEN
    RAISE EXCEPTION 'Email không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;

  -- Người đăng ký / người đại diện theo pháp luật.
  r.full_name     := btrim(COALESCE(p->>'full_name', ''));
  r.id_type       := NULLIF(p->>'id_type', '');
  r.id_number     := upper(regexp_replace(COALESCE(p->>'id_number', ''), '\s', '', 'g'));
  r.date_of_birth := NULLIF(p->>'date_of_birth', '')::date;
  r.gender        := NULLIF(p->>'gender', '');
  r.address       := btrim(COALESCE(p->>'address', ''));
  PERFORM public._kyc_check_identity(v_who, r.full_name, r.id_type, r.id_number, r.address, r.gender, r.date_of_birth);

  -- Khớp VNeID ⇒ nguồn 'vneid', ngày sinh / giới tính lấy từ bản xác thực.
  r.identity_source := 'manual';
  SELECT * INTO v_ident FROM public.user_verified_identities WHERE user_id = _uid AND source = 'vneid';
  IF v_ident.user_id IS NOT NULL AND r.id_type = 'cccd'
     AND v_ident.id_number = r.id_number AND lower(v_ident.full_name) = lower(r.full_name) THEN
    r.identity_source := 'vneid';
    r.date_of_birth   := v_ident.date_of_birth;
    r.gender          := v_ident.gender;
  END IF;

  r.id_front_path := NULLIF(btrim(COALESCE(p->>'id_front_path', '')), '');
  r.id_back_path  := NULLIF(btrim(COALESCE(p->>'id_back_path', '')), '');
  IF r.id_front_path IS NULL AND r.id_back_path IS NULL AND r.identity_source = 'vneid' THEN
    r.id_read_method   := NULL;
    r.id_edited_fields := '{}';
  ELSE
    IF NOT public._buyer_kyc_path_ok(_uid, r.id_front_path) THEN
      RAISE EXCEPTION 'Vui lòng tải ảnh mặt trước giấy tờ của %.', v_who USING ERRCODE = 'check_violation';
    END IF;
    IF r.id_type = 'cccd' AND NOT public._buyer_kyc_path_ok(_uid, r.id_back_path) THEN
      RAISE EXCEPTION 'Vui lòng tải ảnh mặt sau CCCD của %.', v_who USING ERRCODE = 'check_violation';
    END IF;
    IF r.id_back_path IS NOT NULL AND NOT public._buyer_kyc_path_ok(_uid, r.id_back_path) THEN
      RAISE EXCEPTION 'Ảnh mặt sau giấy tờ của % không hợp lệ.', v_who USING ERRCODE = 'check_violation';
    END IF;
    r.id_read_method := COALESCE(NULLIF(p->>'read_method', ''), 'typed');
    IF r.id_read_method NOT IN ('qr', 'ocr', 'typed') THEN
      RAISE EXCEPTION 'Cách đọc giấy tờ không hợp lệ.' USING ERRCODE = 'check_violation';
    END IF;
    r.id_edited_fields := public._kyc_edited_fields(public._jsonb_text_array(p->'edited_fields'));
  END IF;

  -- Tổ chức.
  IF r.buyer_kind = 'organization' THEN
    IF o IS NULL THEN
      RAISE EXCEPTION 'Thiếu thông tin tổ chức đăng ký.' USING ERRCODE = 'check_violation';
    END IF;
    r.org_name         := btrim(COALESCE(o->>'name', ''));
    r.org_tax_code     := regexp_replace(COALESCE(o->>'tax_code', ''), '[\s-]', '', 'g');
    r.org_address      := btrim(COALESCE(o->>'address', ''));
    r.org_reg_doc_path := NULLIF(btrim(COALESCE(o->>'reg_doc_path', '')), '');
    IF length(r.org_name) < 3 THEN
      RAISE EXCEPTION 'Tên tổ chức tối thiểu 3 ký tự.' USING ERRCODE = 'check_violation';
    END IF;
    IF r.org_tax_code !~ '^[0-9]{10}([0-9]{3})?$' THEN
      RAISE EXCEPTION 'Mã số thuế gồm 10 hoặc 13 chữ số.' USING ERRCODE = 'check_violation';
    END IF;
    IF length(r.org_address) < 5 THEN
      RAISE EXCEPTION 'Vui lòng nhập địa chỉ trụ sở tổ chức.' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT public._buyer_kyc_path_ok(_uid, r.org_reg_doc_path) THEN
      RAISE EXCEPTION 'Vui lòng tải giấy chứng nhận đăng ký doanh nghiệp.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Người được uỷ quyền.
  r.has_proxy := x IS NOT NULL;
  IF r.has_proxy THEN
    r.proxy_full_name     := btrim(COALESCE(x->>'full_name', ''));
    r.proxy_id_type       := NULLIF(x->>'id_type', '');
    r.proxy_id_number     := upper(regexp_replace(COALESCE(x->>'id_number', ''), '\s', '', 'g'));
    r.proxy_date_of_birth := NULLIF(x->>'date_of_birth', '')::date;
    r.proxy_gender        := NULLIF(x->>'gender', '');
    r.proxy_phone         := btrim(COALESCE(x->>'phone', ''));
    r.proxy_address       := btrim(COALESCE(x->>'address', ''));
    PERFORM public._kyc_check_identity('người được uỷ quyền', r.proxy_full_name, r.proxy_id_type,
                                       r.proxy_id_number, r.proxy_address, r.proxy_gender, r.proxy_date_of_birth);
    IF r.proxy_phone !~ '^0[0-9]{9}$' THEN
      RAISE EXCEPTION 'Số điện thoại người được uỷ quyền gồm 10 chữ số, bắt đầu bằng 0.' USING ERRCODE = 'check_violation';
    END IF;
    IF r.proxy_id_number = r.id_number THEN
      RAISE EXCEPTION 'Người được uỷ quyền phải là người khác với %.', v_who USING ERRCODE = 'check_violation';
    END IF;

    r.proxy_id_front_path := NULLIF(btrim(COALESCE(x->>'id_front_path', '')), '');
    r.proxy_id_back_path  := NULLIF(btrim(COALESCE(x->>'id_back_path', '')), '');
    r.poa_doc_path        := NULLIF(btrim(COALESCE(x->>'poa_doc_path', '')), '');
    IF NOT public._buyer_kyc_path_ok(_uid, r.proxy_id_front_path) THEN
      RAISE EXCEPTION 'Vui lòng tải ảnh mặt trước giấy tờ của người được uỷ quyền.' USING ERRCODE = 'check_violation';
    END IF;
    IF r.proxy_id_type = 'cccd' AND NOT public._buyer_kyc_path_ok(_uid, r.proxy_id_back_path) THEN
      RAISE EXCEPTION 'Vui lòng tải ảnh mặt sau CCCD của người được uỷ quyền.' USING ERRCODE = 'check_violation';
    END IF;
    IF r.proxy_id_back_path IS NOT NULL AND NOT public._buyer_kyc_path_ok(_uid, r.proxy_id_back_path) THEN
      RAISE EXCEPTION 'Ảnh mặt sau giấy tờ của người được uỷ quyền không hợp lệ.' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT public._buyer_kyc_path_ok(_uid, r.poa_doc_path) THEN
      RAISE EXCEPTION 'Vui lòng tải giấy uỷ quyền.' USING ERRCODE = 'check_violation';
    END IF;
    r.proxy_id_read_method := COALESCE(NULLIF(x->>'read_method', ''), 'typed');
    IF r.proxy_id_read_method NOT IN ('qr', 'ocr', 'typed') THEN
      RAISE EXCEPTION 'Cách đọc giấy tờ không hợp lệ.' USING ERRCODE = 'check_violation';
    END IF;
    r.proxy_id_edited_fields := public._kyc_edited_fields(public._jsonb_text_array(x->'edited_fields'));
  ELSE
    r.proxy_id_edited_fields := '{}';
  END IF;

  RETURN r;
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Ngày sinh không hợp lệ.' USING ERRCODE = 'check_violation';
END; $$;

REVOKE ALL ON FUNCTION public._bidding_parties_from_payload(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ─── 4. start_bidding_contract — chữ ký mới ─────────────────────────────────
DROP FUNCTION IF EXISTS public.start_bidding_contract(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.start_bidding_contract(_session_id UUID, _payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_hold     TIMESTAMPTZ := now() + interval '15 minutes';
  s          RECORD;
  v          public.auction_bidding_contracts;
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

  v := public._bidding_parties_from_payload(v_uid, _payload);

  -- 'refunded' = hồ sơ bị tổ chức từ chối (M3) ⇒ được mua lại như hồ sơ đã huỷ.
  SELECT * INTO v_existing
    FROM public.auction_bidding_contracts
   WHERE session_id = _session_id AND user_id = v_uid AND status NOT IN ('cancelled', 'refunded')
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
           fee_amount = s.dossier_fee, hold_expires_at = v_hold
     WHERE id = v_existing.id
     RETURNING id, code INTO v_id, v_code;
  ELSE
    INSERT INTO public.auction_bidding_contracts
      (code, session_id, organization_id, user_id, buyer_kind,
       full_name, id_type, id_number, date_of_birth, gender, phone, email, address, identity_source,
       id_front_path, id_back_path, id_read_method, id_edited_fields,
       org_name, org_tax_code, org_address, org_reg_doc_path,
       has_proxy, proxy_full_name, proxy_id_type, proxy_id_number, proxy_date_of_birth, proxy_gender,
       proxy_phone, proxy_address, proxy_id_front_path, proxy_id_back_path, proxy_id_read_method,
       proxy_id_edited_fields, poa_doc_path,
       fee_amount, status, hold_expires_at)
    VALUES
      ('HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'),
       _session_id, s.organization_id, v_uid, v.buyer_kind,
       v.full_name, v.id_type, v.id_number, v.date_of_birth, v.gender, v.phone, v.email, v.address, v.identity_source,
       v.id_front_path, v.id_back_path, v.id_read_method, v.id_edited_fields,
       v.org_name, v.org_tax_code, v.org_address, v.org_reg_doc_path,
       v.has_proxy, v.proxy_full_name, v.proxy_id_type, v.proxy_id_number, v.proxy_date_of_birth, v.proxy_gender,
       v.proxy_phone, v.proxy_address, v.proxy_id_front_path, v.proxy_id_back_path, v.proxy_id_read_method,
       v.proxy_id_edited_fields, v.poa_doc_path,
       s.dossier_fee, 'pending_payment', v_hold)
    RETURNING id, code INTO v_id, v_code;
  END IF;

  RETURN jsonb_build_object(
    'contract_id',     v_id,
    'code',            v_code,
    'fee_amount',      s.dossier_fee,
    'hold_expires_at', v_hold,
    'identity_source', v.identity_source
  );
END; $$;

REVOKE ALL ON FUNCTION public.start_bidding_contract(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_bidding_contract(UUID, JSONB) TO authenticated;

-- ─── 5. Kiểm chứng ─────────────────────────────────────────────────────────
DO $$
DECLARE v_n INT; v_bad TEXT;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace AND proname = 'start_bidding_contract';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'start_bidding_contract phải còn đúng 1 bản, đang có %', v_n;
  END IF;
  IF has_function_privilege('anon', 'public.start_bidding_contract(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'start_bidding_contract không được mở cho anon';
  END IF;

  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_bad
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('_bidding_parties_from_payload', '_kyc_check_identity', '_jsonb_text_array')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm nội bộ vẫn gọi được bởi vai thường: %', v_bad;
  END IF;

  RAISE NOTICE 'OK: M2 người mua tổ chức + uỷ quyền + ảnh giấy tờ';
END $$;

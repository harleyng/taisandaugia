-- eKYC người mua hồ sơ — W0/M1 (docs/bidder-ekyc-checkin-plan.md §2.1).
--
-- Danh tính LƯU VÀO HỒ SƠ người dùng để lần mua sau không phải KYC lại (A4).
-- Mở rộng user_verified_identities (một dòng / người) thay vì thêm bảng: VNeID
-- và ảnh 2 mặt CCCD là HAI NGUỒN của CÙNG một danh tính.
--
--   source = 'vneid'    — mock VNeID cũ, CCCD 12 số, không có ảnh.
--   source = 'id_photo' — ảnh giấy tờ + dữ liệu đọc QR/OCR/gõ tay, CHO SỬA;
--                         edited_fields ghi trường người dùng đã sửa sau khi đọc.
--
-- ⚠️ save_id_photo_identity TIN CLIENT như save_vneid_identity. Bù lại: tổ chức
-- duyệt MỌI hồ sơ tham gia (M3) và nhìn thấy ảnh gốc + trường đã sửa.
--
-- Bucket `buyer-kyc` PRIVATE, đường dẫn {user_id}/{uuid}.{ext}, KHÔNG BAO GIỜ ghi
-- đè (không có policy UPDATE). Quyền đọc của tổ chức + chặn xoá ảnh đang được hồ
-- sơ tham chiếu được hoàn thiện ở M2 (cột ảnh trên hồ sơ có ở đó).

-- ─── 1. Mở rộng bảng danh tính ──────────────────────────────────────────────
ALTER TABLE public.user_verified_identities
  ADD COLUMN IF NOT EXISTS id_type       TEXT NOT NULL DEFAULT 'cccd',
  ADD COLUMN IF NOT EXISTS id_front_path TEXT,
  ADD COLUMN IF NOT EXISTS id_back_path  TEXT,
  ADD COLUMN IF NOT EXISTS read_method   TEXT,
  ADD COLUMN IF NOT EXISTS edited_fields TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.user_verified_identities
  DROP CONSTRAINT IF EXISTS user_verified_identities_source_check,
  DROP CONSTRAINT IF EXISTS user_verified_identities_id_number_check,
  DROP CONSTRAINT IF EXISTS uvi_id_type_check,
  DROP CONSTRAINT IF EXISTS uvi_read_method_check,
  DROP CONSTRAINT IF EXISTS uvi_id_shape,
  DROP CONSTRAINT IF EXISTS uvi_photo_shape,
  DROP CONSTRAINT IF EXISTS uvi_path_owner;

ALTER TABLE public.user_verified_identities
  ADD CONSTRAINT user_verified_identities_source_check CHECK (source IN ('vneid', 'id_photo')),
  ADD CONSTRAINT uvi_id_type_check CHECK (id_type IN ('cccd', 'passport')),
  ADD CONSTRAINT uvi_read_method_check CHECK (read_method IS NULL OR read_method IN ('qr', 'ocr', 'typed')),
  -- vneid ⇒ CCCD 12 số (định danh điện tử). id_photo ⇒ theo loại giấy tờ, cùng
  -- luật với abc_id_number_shape của hồ sơ tham gia.
  ADD CONSTRAINT uvi_id_shape CHECK (
    (source = 'vneid' AND id_type = 'cccd' AND id_number ~ '^[0-9]{12}$')
    OR (source = 'id_photo' AND (
          (id_type = 'cccd' AND id_number ~ '^[0-9]{9,12}$')
          OR (id_type = 'passport' AND length(btrim(id_number)) >= 6)))
  ),
  -- Hộ chiếu chỉ có trang thông tin ⇒ không đòi mặt sau.
  ADD CONSTRAINT uvi_photo_shape CHECK (
    source <> 'id_photo'
    OR (id_front_path IS NOT NULL AND read_method IS NOT NULL
        AND (id_type = 'passport' OR id_back_path IS NOT NULL))
  ),
  ADD CONSTRAINT uvi_path_owner CHECK (
    (id_front_path IS NULL OR split_part(id_front_path, '/', 1) = user_id::text)
    AND (id_back_path IS NULL OR split_part(id_back_path, '/', 1) = user_id::text)
  );

COMMENT ON COLUMN public.user_verified_identities.source IS
  'vneid = mock VNeID; id_photo = ảnh giấy tờ + dữ liệu đọc QR/OCR/gõ tay (người dùng tự khai, tổ chức duyệt).';
COMMENT ON COLUMN public.user_verified_identities.edited_fields IS
  'Trường người dùng đã sửa so với giá trị đọc từ QR/OCR — tổ chức soi kỹ các trường này khi duyệt.';

-- ─── 2. Bucket ảnh giấy tờ (PRIVATE) ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('buyer-kyc', 'buyer-kyc', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Đường dẫn có hợp lệ cho người dùng này không: nằm trong thư mục của họ VÀ tệp
-- đã thật sự được tải lên. Dùng chung cho RPC lưu danh tính và RPC hồ sơ tham gia.
CREATE OR REPLACE FUNCTION public._buyer_kyc_path_ok(_uid UUID, _path TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL
     AND _path IS NOT NULL
     AND split_part(_path, '/', 1) = _uid::text
     AND _path !~ '\.\.'
     AND EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'buyer-kyc' AND o.name = _path)
$$;

REVOKE ALL ON FUNCTION public._buyer_kyc_path_ok(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Ảnh đang được dùng thì không xoá được. Bản M1 chỉ biết bảng danh tính; M2 thay
-- bằng bản có cả các cột ảnh trên hồ sơ tham gia.
CREATE OR REPLACE FUNCTION public.buyer_kyc_path_referenced(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_verified_identities v
                  WHERE _name IN (v.id_front_path, v.id_back_path))
$$;

REVOKE ALL ON FUNCTION public.buyer_kyc_path_referenced(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buyer_kyc_path_referenced(TEXT) TO authenticated;

DROP POLICY IF EXISTS "buyer_kyc_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "buyer_kyc_select_own" ON storage.objects;
DROP POLICY IF EXISTS "buyer_kyc_delete_own" ON storage.objects;

CREATE POLICY "buyer_kyc_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'buyer-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "buyer_kyc_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buyer-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "buyer_kyc_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'buyer-kyc'
         AND (storage.foldername(name))[1] = auth.uid()::text
         AND NOT public.buyer_kyc_path_referenced(name));

-- ─── 3. Lưu danh tính từ ảnh giấy tờ ────────────────────────────────────────
-- ⚠️ TIN CLIENT (như save_vneid_identity). Ghi đè dòng cũ — kể cả dòng VNeID: một
-- người một danh tính. Ảnh cũ không bị xoá ở đây (SQL không xoá được tệp storage);
-- client tự xoá sau khi lưu, policy chặn nếu ảnh còn được hồ sơ nào dùng.
CREATE OR REPLACE FUNCTION public.save_id_photo_identity(
  _id_type        TEXT,
  _id_number      TEXT,
  _full_name      TEXT,
  _date_of_birth  DATE,
  _address        TEXT,
  _id_front_path  TEXT,
  _id_back_path   TEXT DEFAULT NULL,
  _gender         TEXT DEFAULT NULL,
  _id_issued_on   DATE DEFAULT NULL,
  _read_method    TEXT DEFAULT 'typed',
  _edited_fields  TEXT[] DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_idnum  TEXT := upper(regexp_replace(COALESCE(_id_number, ''), '\s', '', 'g'));
  v_name   TEXT := btrim(COALESCE(_full_name, ''));
  v_addr   TEXT := btrim(COALESCE(_address, ''));
  v_back   TEXT := NULLIF(btrim(COALESCE(_id_back_path, '')), '');
  v_edited TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập.' USING ERRCODE = 'insufficient_privilege';
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
  IF length(v_name) < 3 THEN
    RAISE EXCEPTION 'Họ tên tối thiểu 3 ký tự.' USING ERRCODE = 'check_violation';
  END IF;
  IF _date_of_birth IS NULL OR _date_of_birth > CURRENT_DATE - interval '14 years' THEN
    RAISE EXCEPTION 'Ngày sinh không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_addr) < 5 THEN
    RAISE EXCEPTION 'Vui lòng nhập địa chỉ thường trú.' USING ERRCODE = 'check_violation';
  END IF;
  IF _gender IS NOT NULL AND _gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(_read_method, 'typed') NOT IN ('qr', 'ocr', 'typed') THEN
    RAISE EXCEPTION 'Cách đọc giấy tờ không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT public._buyer_kyc_path_ok(v_uid, _id_front_path) THEN
    RAISE EXCEPTION 'Vui lòng tải ảnh mặt trước giấy tờ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _id_type = 'cccd' AND NOT public._buyer_kyc_path_ok(v_uid, v_back) THEN
    RAISE EXCEPTION 'Vui lòng tải ảnh mặt sau CCCD.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_back IS NOT NULL AND NOT public._buyer_kyc_path_ok(v_uid, v_back) THEN
    RAISE EXCEPTION 'Ảnh mặt sau không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;

  v_edited := public._kyc_edited_fields(_edited_fields);

  INSERT INTO public.user_verified_identities
    (user_id, source, id_type, full_name, id_number, id_issued_on, date_of_birth, gender, address,
     id_front_path, id_back_path, read_method, edited_fields, verified_at)
  VALUES
    (v_uid, 'id_photo', _id_type, v_name, v_idnum, _id_issued_on, _date_of_birth, _gender, v_addr,
     _id_front_path, v_back, COALESCE(_read_method, 'typed'), v_edited, now())
  ON CONFLICT (user_id) DO UPDATE SET
    source        = EXCLUDED.source,
    id_type       = EXCLUDED.id_type,
    full_name     = EXCLUDED.full_name,
    id_number     = EXCLUDED.id_number,
    id_issued_on  = EXCLUDED.id_issued_on,
    date_of_birth = EXCLUDED.date_of_birth,
    gender        = EXCLUDED.gender,
    address       = EXCLUDED.address,
    id_front_path = EXCLUDED.id_front_path,
    id_back_path  = EXCLUDED.id_back_path,
    read_method   = EXCLUDED.read_method,
    edited_fields = EXCLUDED.edited_fields,
    verified_at   = now();
END; $$;

-- Danh sách trường được phép đánh dấu "đã sửa" — lọc im lặng thứ khác.
CREATE OR REPLACE FUNCTION public._kyc_edited_fields(_fields TEXT[])
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT f ORDER BY f), '{}')
    FROM unnest(COALESCE(_fields, '{}')) AS f
   WHERE f IN ('full_name', 'id_number', 'date_of_birth', 'gender', 'address', 'id_issued_on')
$$;

REVOKE ALL ON FUNCTION public._kyc_edited_fields(TEXT[]) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.save_id_photo_identity(TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_id_photo_identity(TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT[]) TO authenticated;

-- save_vneid_identity cũ ghi đè mọi cột cũ nhưng KHÔNG dọn cột ảnh ⇒ dòng id_photo
-- chuyển sang vneid sẽ giữ ảnh rác. Chép lại, dọn luôn các cột mới.
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
    (user_id, source, id_type, full_name, id_number, id_issued_on, date_of_birth, gender, address, verified_at)
  VALUES
    (v_uid, 'vneid', 'cccd', btrim(_full_name), btrim(_id_number), _id_issued_on, _date_of_birth, _gender, btrim(_address), now())
  ON CONFLICT (user_id) DO UPDATE SET
    source        = 'vneid',
    id_type       = 'cccd',
    full_name     = EXCLUDED.full_name,
    id_number     = EXCLUDED.id_number,
    id_issued_on  = EXCLUDED.id_issued_on,
    date_of_birth = EXCLUDED.date_of_birth,
    gender        = EXCLUDED.gender,
    address       = EXCLUDED.address,
    id_front_path = NULL,
    id_back_path  = NULL,
    read_method   = NULL,
    edited_fields = '{}',
    verified_at   = now();
END; $$;

REVOKE ALL ON FUNCTION public.save_vneid_identity(TEXT, TEXT, DATE, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_vneid_identity(TEXT, TEXT, DATE, TEXT, TEXT, DATE) TO authenticated;

-- ─── 4. Kiểm chứng ─────────────────────────────────────────────────────────
DO $$
DECLARE v_bad TEXT;
BEGIN
  SELECT string_agg(policyname, ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname LIKE 'buyer_kyc_%'
     AND COALESCE(qual, with_check) ILIKE '%auth.uid() IS NOT NULL%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Policy bucket buyer-kyc quá rộng: %', v_bad;
  END IF;

  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_bad
    FROM pg_proc p
   CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('_buyer_kyc_path_ok', '_kyc_edited_fields')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Hàm nội bộ vẫn gọi được bởi vai thường: %', v_bad;
  END IF;

  RAISE NOTICE 'OK: M1 danh tính người mua + bucket buyer-kyc';
END $$;

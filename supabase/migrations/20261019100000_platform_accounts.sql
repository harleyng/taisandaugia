-- Phase 4 tách sàn (docs/auction-platform-split-plan.md) — tài khoản dùng chung cho
-- 2 nền tảng: Tài Sản Đấu Giá (info) và Sàn đấu giá trực tuyến (auction, repo taisanviet).
-- Cùng một auth.users; mỗi nền tảng có Điều khoản / Chính sách RIÊNG và ghi nhận
-- đồng ý RIÊNG.
--
--  1. legal_documents.platform + RPC đọc theo nền tảng.
--     BẪY TƯƠNG THÍCH: bản taisandaugia đang chạy production đọc thẳng bảng và coi
--     dòng mới nhất của mỗi doc_type là bản đang áp dụng. Nếu nó thấy dòng của sàn
--     (hiệu lực mới hơn) ⇒ đăng xuất hàng loạt + đóng dấu sai phiên bản vào
--     profiles.terms_version. Vì vậy MỌI đọc/ghi trực tiếp bảng (cả admin) chỉ còn
--     thấy platform = 'info'; code mới đọc/ghi qua các RPC bên dưới.
--  2. profiles.signup_platform — nền tảng nơi tài khoản được tạo.
--  3. user_platform_consents — đồng ý pháp lý của nền tảng KHÁC info (consent của
--     info vẫn nằm trên profiles.terms_* / privacy_* như cũ, code cũ còn đọc).
--     record_legal_consent / my_legal_consent che sự khác biệt chỗ lưu này.
--  4. handle_new_user phân nhánh theo signup_platform.
--  5. auth_handoff_codes — mã một lần cho edge fn `auth-handoff`
--     ("Đăng nhập bằng tài khoản Tài Sản Đấu Giá").
--  6. Seed Điều khoản + Chính sách của sàn (phiên bản khởi tạo).

-- ─── 1. legal_documents.platform ─────────────────────────────────────────────
ALTER TABLE public.legal_documents
  ADD COLUMN platform text NOT NULL DEFAULT 'info'
  CONSTRAINT legal_documents_platform_check CHECK (platform IN ('info', 'auction'));

ALTER TABLE public.legal_documents DROP CONSTRAINT legal_documents_doc_type_version_key;
ALTER TABLE public.legal_documents
  ADD CONSTRAINT legal_documents_platform_doc_type_version_key UNIQUE (platform, doc_type, version);

DROP INDEX IF EXISTS public.idx_legal_documents_type_date;
CREATE INDEX idx_legal_documents_platform_type_date
  ON public.legal_documents (platform, doc_type, effective_date DESC, created_at DESC);

DROP POLICY IF EXISTS "legal_documents_public_read" ON public.legal_documents;
CREATE POLICY "legal_documents_public_read"
  ON public.legal_documents FOR SELECT
  USING (platform = 'info' AND effective_date <= now());

DROP POLICY IF EXISTS "legal_documents_admin_all" ON public.legal_documents;
CREATE POLICY "legal_documents_admin_all"
  ON public.legal_documents FOR ALL
  USING (platform = 'info' AND public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (platform = 'info' AND public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Phiên bản đang áp dụng của mỗi loại cho một nền tảng (anon OK). Hai bản cùng
-- ngày hiệu lực: bản tạo sau thắng (khớp classifyLegalVersions ở client).
CREATE OR REPLACE FUNCTION public.legal_active_versions(p_platform text)
RETURNS TABLE (doc_type text, version text, effective_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (d.doc_type) d.doc_type, d.version, d.effective_date
  FROM public.legal_documents d
  WHERE d.platform = p_platform
    AND d.effective_date <= now()
  ORDER BY d.doc_type, d.effective_date DESC, d.created_at DESC;
$$;

-- Bản đang áp dụng KÈM nội dung (trang công khai /dieu-khoan-su-dung, /chinh-sach-bao-mat).
CREATE OR REPLACE FUNCTION public.legal_active_document(p_platform text, p_doc_type text)
RETURNS SETOF public.legal_documents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.*
  FROM public.legal_documents d
  WHERE d.platform = p_platform
    AND d.doc_type = p_doc_type
    AND d.effective_date <= now()
  ORDER BY d.effective_date DESC, d.created_at DESC
  LIMIT 1;
$$;

-- Admin: mọi phiên bản (cả bản Chờ áp dụng) — p_platform NULL = cả hai nền tảng.
CREATE OR REPLACE FUNCTION public.admin_legal_documents(p_platform text DEFAULT NULL)
RETURNS SETOF public.legal_documents
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Chỉ quản trị viên được xem văn bản pháp lý' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT d.*
    FROM public.legal_documents d
    WHERE p_platform IS NULL OR d.platform = p_platform
    ORDER BY d.platform, d.doc_type, d.effective_date DESC, d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_legal_document(p_id uuid)
RETURNS SETOF public.legal_documents
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Chỉ quản trị viên được xem văn bản pháp lý' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT d.* FROM public.legal_documents d WHERE d.id = p_id;
END;
$$;

-- Phiên bản là BẤT BIẾN: chỉ có tạo mới (không update / delete).
CREATE OR REPLACE FUNCTION public.admin_create_legal_version(
  p_platform       text,
  p_doc_type       text,
  p_version        text,
  p_effective_date date,
  p_changelog      text DEFAULT NULL,
  p_content        text DEFAULT NULL
)
RETURNS public.legal_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.legal_documents;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Chỉ quản trị viên được tạo văn bản pháp lý' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_version), '') IS NULL THEN
    RAISE EXCEPTION 'Vui lòng nhập nhãn phiên bản' USING ERRCODE = '22023';
  END IF;
  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày hiệu lực' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.legal_documents (platform, doc_type, version, effective_date, changelog, content)
  VALUES (p_platform, p_doc_type, btrim(p_version), p_effective_date,
          NULLIF(btrim(p_changelog), ''), NULLIF(btrim(p_content), ''))
  RETURNING * INTO v_row;
  RETURN v_row;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Phiên bản "%" đã tồn tại cho loại văn bản này', btrim(p_version)
      USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_legal_documents(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_legal_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_legal_version(text, text, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_legal_documents(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_legal_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_legal_version(text, text, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legal_active_versions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_active_document(text, text) TO anon, authenticated;

-- ─── 2. profiles.signup_platform ─────────────────────────────────────────────
-- Thêm cột KÈM default để lấp 'info' cho mọi tài khoản cũ mà không UPDATE (không
-- kích trigger updated_at / KYC), rồi bỏ default: tài khoản mới do handle_new_user
-- ghi; đăng ký Google (không có metadata) để NULL tới lần đăng nhập đầu, khi
-- record_legal_consent nhận về nền tảng đó.
ALTER TABLE public.profiles
  ADD COLUMN signup_platform text DEFAULT 'info'
  CONSTRAINT profiles_signup_platform_check CHECK (signup_platform IN ('info', 'auction'));
ALTER TABLE public.profiles ALTER COLUMN signup_platform DROP DEFAULT;

COMMENT ON COLUMN public.profiles.signup_platform IS
  'Nền tảng nơi tài khoản được tạo (info | auction). NULL = đăng ký OAuth chưa đăng nhập lần nào.';

-- ─── 3. user_platform_consents ───────────────────────────────────────────────
CREATE TABLE public.user_platform_consents (
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'info' KHÔNG ở đây: consent của Tài Sản Đấu Giá vẫn trên profiles (code cũ đọc).
  platform            text        NOT NULL CHECK (platform IN ('auction')),
  terms_version       text,
  terms_accepted_at   timestamptz,
  privacy_version     text,
  privacy_accepted_at timestamptz,
  -- Đồng ý nhận email tiếp thị CỦA NỀN TẢNG NÀY (profiles.notifications_enabled là của info).
  marketing_opt_in    boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, platform)
);

ALTER TABLE public.user_platform_consents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER user_platform_consents_updated_at
  BEFORE UPDATE ON public.user_platform_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chỉ đọc dòng của mình; ghi DUY NHẤT qua record_legal_consent / handle_new_user
-- (server tự lấy phiên bản đang áp dụng ⇒ client không tự khai phiên bản được).
CREATE POLICY "own rows"
  ON public.user_platform_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_platform_consents_admin_read"
  ON public.user_platform_consents FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Đóng dấu "nhấn Đăng nhập = đồng ý" phiên bản ĐANG ÁP DỤNG của nền tảng (gọi ở sự
-- kiện SIGNED_IN — useTermsGate). Chỉ đổi accepted_at khi phiên bản thực sự đổi.
-- Đồng thời nhận signup_platform cho tài khoản OAuth còn NULL.
CREATE OR REPLACE FUNCTION public.record_legal_consent(p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_terms   text;
  v_privacy text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập' USING ERRCODE = '28000';
  END IF;
  IF p_platform IS NULL OR p_platform NOT IN ('info', 'auction') THEN
    RAISE EXCEPTION 'Nền tảng không hợp lệ: %', p_platform USING ERRCODE = '22023';
  END IF;

  SELECT max(a.version) FILTER (WHERE a.doc_type = 'terms'),
         max(a.version) FILTER (WHERE a.doc_type = 'privacy')
    INTO v_terms, v_privacy
  FROM public.legal_active_versions(p_platform) a;

  IF p_platform = 'info' THEN
    UPDATE public.profiles p
       SET terms_version       = COALESCE(v_terms, p.terms_version),
           terms_accepted_at   = CASE WHEN v_terms IS NOT NULL AND v_terms IS DISTINCT FROM p.terms_version
                                      THEN now() ELSE p.terms_accepted_at END,
           privacy_version     = COALESCE(v_privacy, p.privacy_version),
           privacy_accepted_at = CASE WHEN v_privacy IS NOT NULL AND v_privacy IS DISTINCT FROM p.privacy_version
                                      THEN now() ELSE p.privacy_accepted_at END,
           signup_platform     = COALESCE(p.signup_platform, 'info')
     WHERE p.id = v_uid
       AND (   (v_terms   IS NOT NULL AND v_terms   IS DISTINCT FROM p.terms_version)
            OR (v_privacy IS NOT NULL AND v_privacy IS DISTINCT FROM p.privacy_version)
            OR p.signup_platform IS NULL);
    RETURN;
  END IF;

  IF v_terms IS NOT NULL OR v_privacy IS NOT NULL THEN
    INSERT INTO public.user_platform_consents AS c
      (user_id, platform, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at)
    VALUES
      (v_uid, p_platform,
       v_terms,   CASE WHEN v_terms   IS NOT NULL THEN now() END,
       v_privacy, CASE WHEN v_privacy IS NOT NULL THEN now() END)
    ON CONFLICT (user_id, platform) DO UPDATE
      SET terms_version       = COALESCE(EXCLUDED.terms_version, c.terms_version),
          terms_accepted_at   = CASE WHEN EXCLUDED.terms_version IS NOT NULL
                                      AND EXCLUDED.terms_version IS DISTINCT FROM c.terms_version
                                     THEN now() ELSE c.terms_accepted_at END,
          privacy_version     = COALESCE(EXCLUDED.privacy_version, c.privacy_version),
          privacy_accepted_at = CASE WHEN EXCLUDED.privacy_version IS NOT NULL
                                      AND EXCLUDED.privacy_version IS DISTINCT FROM c.privacy_version
                                     THEN now() ELSE c.privacy_accepted_at END
      WHERE (EXCLUDED.terms_version   IS NOT NULL AND EXCLUDED.terms_version   IS DISTINCT FROM c.terms_version)
         OR (EXCLUDED.privacy_version IS NOT NULL AND EXCLUDED.privacy_version IS DISTINCT FROM c.privacy_version);
  END IF;

  UPDATE public.profiles
     SET signup_platform = p_platform
   WHERE id = v_uid AND signup_platform IS NULL;
END;
$$;

-- Phiên bản user hiện đã đồng ý trên một nền tảng (0 dòng = chưa ghi nhận lần nào).
CREATE OR REPLACE FUNCTION public.my_legal_consent(p_platform text)
RETURNS TABLE (terms_version text, privacy_version text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT p.terms_version, p.privacy_version
  FROM public.profiles p
  WHERE p_platform = 'info' AND p.id = auth.uid()
  UNION ALL
  SELECT c.terms_version, c.privacy_version
  FROM public.user_platform_consents c
  WHERE p_platform <> 'info' AND c.platform = p_platform AND c.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.record_legal_consent(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_legal_consent(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legal_consent(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_legal_consent(text) TO authenticated;

-- ─── 4. handle_new_user theo nền tảng đăng ký ────────────────────────────────
-- Bản LIVE trước đó = 20260714000001 (đã đối chiếu pg_get_functiondef 2026-10-19).
-- Đăng ký trên sàn: KHÔNG ghi consent / opt-in email vào cột của Tài Sản Đấu Giá
-- (nếu ghi, cổng consent bên đó thấy "phiên bản lạ" ⇒ buộc đăng xuất); ghi vào
-- user_platform_consents. Bản INFO cũ chưa gửi signup_platform nhưng luôn gửi
-- terms_accepted ⇒ coi là 'info'. Không metadata (Google) ⇒ NULL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meta     jsonb   := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_accepted boolean := (v_meta->>'terms_accepted')::boolean IS TRUE;
  v_opt_in   boolean := COALESCE((v_meta->>'notifications_enabled')::boolean, false);
  v_platform text    := NULLIF(v_meta->>'signup_platform', '');
  v_info     boolean;
BEGIN
  IF v_platform IS NULL AND v_meta ? 'terms_accepted' THEN
    v_platform := 'info';
  END IF;
  IF v_platform IS NOT NULL AND v_platform NOT IN ('info', 'auction') THEN
    v_platform := NULL;
  END IF;
  v_info := v_platform IS DISTINCT FROM 'auction';

  INSERT INTO public.profiles (
    id, email, name, kyc_status,
    notifications_enabled,
    terms_accepted_at, terms_version,
    privacy_accepted_at, privacy_version,
    signup_platform
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_meta->>'name',
    'NOT_APPLIED'::kyc_status,
    v_info AND v_opt_in,
    CASE WHEN v_info AND v_accepted THEN now() END,
    CASE WHEN v_info AND v_accepted THEN v_meta->>'terms_version' END,
    CASE WHEN v_info AND v_accepted THEN now() END,
    CASE WHEN v_info AND v_accepted THEN v_meta->>'privacy_version' END,
    v_platform
  );

  IF v_platform = 'auction' AND v_accepted THEN
    INSERT INTO public.user_platform_consents (
      user_id, platform,
      terms_version, terms_accepted_at,
      privacy_version, privacy_accepted_at,
      marketing_opt_in
    )
    VALUES (
      NEW.id, 'auction',
      v_meta->>'terms_version', now(),
      v_meta->>'privacy_version', now(),
      v_opt_in
    );
  END IF;

  -- Assign default USER role (no BROKER role needed)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'USER');

  RETURN NEW;
END;
$function$;

-- ─── 5. auth_handoff_codes ───────────────────────────────────────────────────
-- Mã một lần (60 s) cho "Đăng nhập bằng tài khoản Tài Sản Đấu Giá". CHỈ edge fn
-- auth-handoff (service_role) chạm vào: RLS bật, không policy nào. Chỉ lưu BĂM
-- SHA-256 của mã và của `state` (state do sàn sinh, giữ trong sessionStorage của
-- tab ⇒ chống login-CSRF: mã của kẻ khác không đổi được trong tab của nạn nhân).
CREATE TABLE public.auth_handoff_codes (
  code_hash       text        PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash      text        NOT NULL,
  target_platform text        NOT NULL CHECK (target_platform IN ('auction')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz
);

ALTER TABLE public.auth_handoff_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_handoff_codes FROM anon, authenticated;

CREATE INDEX idx_auth_handoff_codes_expires ON public.auth_handoff_codes (expires_at);

-- ─── 6. Văn bản pháp lý của Sàn đấu giá trực tuyến (bản khởi tạo) ─────────────
INSERT INTO public.legal_documents (platform, doc_type, version, effective_date, changelog, content) VALUES
('auction', 'terms', '2026-10-19', '2026-10-19',
 'Phiên bản khởi tạo của Sàn đấu giá trực tuyến. Bản do đội kỹ thuật soạn — cần bộ phận pháp chế rà soát trước khi vận hành chính thức.',
 $html$<h2 id="gioi-thieu">1. Giới thiệu</h2>
<p>Sàn đấu giá trực tuyến ("Sàn") là nền tảng thuộc hệ sinh thái Tài Sản Đấu Giá, cung cấp hạ tầng kỹ thuật để các tổ chức hành nghề đấu giá tài sản ("Tổ chức đấu giá") tổ chức phiên đấu giá theo hình thức trực tuyến và để người tham gia đấu giá đăng ký hồ sơ, nộp tiền đặt trước, điểm danh và trả giá.</p>
<p>Bằng việc tạo tài khoản, đăng nhập hoặc sử dụng Sàn, bạn đồng ý với Điều khoản sử dụng này. Nếu không đồng ý, vui lòng không sử dụng Sàn.</p>

<h2 id="vai-tro">2. Vai trò của Sàn và Tổ chức đấu giá</h2>
<p>Mỗi phiên đấu giá trên Sàn do một Tổ chức đấu giá tổ chức và điều hành; tên Tổ chức đấu giá được hiển thị trên trang phiên. Tổ chức đấu giá chịu trách nhiệm về quy chế cuộc đấu giá, việc xét duyệt hồ sơ, điều hành phiên, công bố kết quả và lập biên bản theo quy định của pháp luật về đấu giá tài sản.</p>
<p>Sàn không phải là người có tài sản đấu giá, không phải người tham gia đấu giá và không quyết định kết quả của phiên. Sàn chịu trách nhiệm vận hành hạ tầng, ghi nhận và lưu giữ các thao tác trên hệ thống một cách trung thực.</p>

<h2 id="tai-khoan">3. Tài khoản</h2>
<p>Bạn có thể tạo tài khoản trực tiếp trên Sàn (bằng email, số điện thoại hoặc Google) hoặc đăng nhập bằng tài khoản Tài Sản Đấu Giá sẵn có. Hai nền tảng dùng chung một tài khoản; việc đồng ý Điều khoản của nền tảng này không thay cho việc đồng ý Điều khoản của nền tảng kia.</p>
<p>Bạn phải đủ 18 tuổi, có đầy đủ năng lực hành vi dân sự và cung cấp thông tin chính xác. Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động phát sinh từ tài khoản của mình, bao gồm các lần trả giá.</p>

<h2 id="tham-gia">4. Đăng ký tham gia phiên đấu giá</h2>
<p>Để tham gia một phiên, bạn cần nộp hồ sơ tham gia đấu giá, thanh toán tiền hồ sơ và nộp tiền đặt trước theo quy chế của phiên. Hồ sơ chỉ hợp lệ khi được Tổ chức đấu giá xét duyệt.</p>
<p>Bạn phải xác thực danh tính (qua VNeID hoặc ảnh giấy tờ tùy thân) trước khi được trả giá. Người không thuộc diện được tham gia đấu giá theo quy định của pháp luật không được đăng ký tham gia.</p>

<h2 id="tra-gia">5. Trả giá trực tuyến</h2>
<p>Mỗi lần trả giá được hệ thống ghi nhận theo thời gian máy chủ và có giá trị ràng buộc đối với bạn. Bạn chỉ được rút lại giá đã trả trong phạm vi quy chế của phiên cho phép.</p>
<p>Kết quả phiên được xác định theo dữ liệu ghi nhận trên hệ thống và được Tổ chức đấu giá công bố, lập biên bản. Người trúng đấu giá có nghĩa vụ ký hợp đồng mua bán tài sản và thanh toán theo quy chế; vi phạm các nghĩa vụ này có thể dẫn đến việc không được nhận lại tiền đặt trước.</p>

<h2 id="hanh-vi-cam">6. Hành vi bị cấm</h2>
<ul>
<li>Thông đồng, móc nối với người tham gia khác, Tổ chức đấu giá hoặc người có tài sản để dìm giá, nâng giá hoặc làm sai lệch kết quả.</li>
<li>Đăng ký, trả giá thay người khác khi không có giấy ủy quyền hợp lệ; sử dụng thông tin hoặc giấy tờ giả.</li>
<li>Can thiệp, tấn công, khai thác lỗi hoặc dùng công cụ tự động gây ảnh hưởng đến hoạt động của Sàn.</li>
<li>Cản trở hoạt động đấu giá hoặc gây rối trong phòng đấu giá trực tuyến.</li>
</ul>
<p>Sàn và Tổ chức đấu giá có quyền tạm khóa tài khoản, hủy kết quả trả giá liên quan và thông báo cho cơ quan có thẩm quyền khi phát hiện vi phạm.</p>

<h2 id="su-co">7. Sự cố kỹ thuật</h2>
<p>Khi xảy ra sự cố kỹ thuật làm gián đoạn phiên, Tổ chức đấu giá có thể tạm dừng, tiếp tục hoặc tổ chức lại phiên theo quy chế và quy định của pháp luật. Bạn tự chịu trách nhiệm về thiết bị và đường truyền internet của mình.</p>

<h2 id="phi">8. Phí và thanh toán</h2>
<p>Tiền hồ sơ, tiền đặt trước và cách hoàn trả tiền đặt trước được quy định trong quy chế của từng phiên. Khoản thanh toán qua cổng thanh toán được xử lý bởi đơn vị trung gian thanh toán; Sàn không lưu thông tin thẻ của bạn.</p>

<h2 id="trach-nhiem">9. Giới hạn trách nhiệm</h2>
<p>Thông tin về tài sản do người có tài sản và Tổ chức đấu giá cung cấp. Bạn nên tự xem xét tài sản và hồ sơ pháp lý trước khi tham gia. Trong phạm vi pháp luật cho phép, Sàn không chịu trách nhiệm về thiệt hại gián tiếp phát sinh từ việc sử dụng Sàn.</p>

<h2 id="du-lieu">10. Dữ liệu cá nhân</h2>
<p>Việc thu thập và xử lý dữ liệu cá nhân trên Sàn được thực hiện theo Chính sách bảo mật của Sàn đấu giá trực tuyến.</p>

<h2 id="thay-doi">11. Thay đổi điều khoản</h2>
<p>Sàn có thể cập nhật Điều khoản này. Phiên bản mới có hiệu lực từ ngày ghi trên trang; khi đó bạn sẽ được yêu cầu đăng nhập lại và việc tiếp tục sử dụng Sàn đồng nghĩa với việc bạn đồng ý phiên bản mới.</p>

<h2 id="luat-ap-dung">12. Luật áp dụng và giải quyết tranh chấp</h2>
<p>Điều khoản này được điều chỉnh bởi pháp luật Cộng hòa Xã hội Chủ nghĩa Việt Nam, bao gồm pháp luật về đấu giá tài sản. Tranh chấp được ưu tiên giải quyết bằng thương lượng; nếu không thành, tranh chấp được giải quyết tại Tòa án có thẩm quyền của Việt Nam.</p>

<h2 id="lien-he">13. Liên hệ</h2>
<p>Mọi câu hỏi về Điều khoản sử dụng, vui lòng liên hệ: <strong>contact@taisandaugia.vn</strong>.</p>$html$),
('auction', 'privacy', '2026-10-19', '2026-10-19',
 'Phiên bản khởi tạo của Sàn đấu giá trực tuyến. Bản do đội kỹ thuật soạn — cần bộ phận pháp chế rà soát trước khi vận hành chính thức.',
 $html$<p>Sàn đấu giá trực tuyến ("Sàn", "chúng tôi") tôn trọng quyền riêng tư của bạn. Chính sách này mô tả dữ liệu cá nhân chúng tôi thu thập khi bạn sử dụng Sàn, mục đích xử lý, đối tượng được chia sẻ và quyền của bạn, phù hợp với pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.</p>

<h2 id="du-lieu-thu-thap">1. Dữ liệu chúng tôi thu thập</h2>
<ul>
<li><strong>Tài khoản:</strong> họ tên, email, số điện thoại, mật khẩu (được mã hóa), thông tin đăng nhập Google nếu bạn dùng.</li>
<li><strong>Định danh:</strong> số CCCD/hộ chiếu, ngày sinh, địa chỉ, ảnh giấy tờ tùy thân và ảnh chân dung, hoặc kết quả xác thực từ VNeID.</li>
<li><strong>Hồ sơ tham gia đấu giá:</strong> thông tin đăng ký, giấy ủy quyền, tài khoản ngân hàng nhận hoàn tiền đặt trước, chứng từ nộp tiền.</li>
<li><strong>Hoạt động đấu giá:</strong> lịch sử điểm danh, trả giá, rút giá, kết quả phiên, hợp đồng mua bán.</li>
<li><strong>Kỹ thuật:</strong> địa chỉ IP, thiết bị, trình duyệt, thời điểm truy cập — dùng để bảo đảm tính toàn vẹn của phiên.</li>
<li><strong>Trao đổi:</strong> câu hỏi và tin nhắn bạn gửi qua mục Hỏi đáp của phiên.</li>
</ul>

<h2 id="muc-dich">2. Mục đích xử lý</h2>
<ul>
<li>Tạo và quản lý tài khoản, xác thực danh tính người tham gia đấu giá.</li>
<li>Để Tổ chức đấu giá xét duyệt hồ sơ, điều hành phiên, công bố kết quả, lập biên bản và hợp đồng.</li>
<li>Xử lý thanh toán tiền hồ sơ, tiền đặt trước và hoàn trả tiền đặt trước.</li>
<li>Phát hiện, ngăn chặn gian lận và vi phạm; giải quyết khiếu nại, tranh chấp.</li>
<li>Gửi thông báo về phiên bạn đăng ký; gửi thông tin tiếp thị chỉ khi bạn đồng ý.</li>
</ul>

<h2 id="chia-se">3. Chia sẻ dữ liệu</h2>
<ul>
<li><strong>Tổ chức đấu giá</strong> của phiên bạn đăng ký: hồ sơ, danh tính, lịch sử trả giá trong phiên đó.</li>
<li><strong>Người có tài sản:</strong> thông tin cần thiết của người trúng đấu giá để ký kết và thực hiện hợp đồng mua bán.</li>
<li><strong>Đơn vị trung gian thanh toán, dịch vụ xác thực danh tính</strong> trong phạm vi cần thiết để cung cấp dịch vụ.</li>
<li><strong>Cơ quan nhà nước có thẩm quyền</strong> khi pháp luật yêu cầu.</li>
</ul>
<p>Người tham gia đấu giá khác chỉ thấy số báo danh của bạn, không thấy danh tính. Chúng tôi không bán dữ liệu cá nhân của bạn.</p>

<h2 id="tai-khoan-chung">4. Tài khoản dùng chung với Tài Sản Đấu Giá</h2>
<p>Sàn và Tài Sản Đấu Giá dùng chung hệ thống tài khoản, nên thông tin đăng nhập và hồ sơ cơ bản (họ tên, email, số điện thoại) được dùng trên cả hai nền tảng. Sự đồng ý Điều khoản, Chính sách và nhận email tiếp thị được ghi nhận riêng cho từng nền tảng.</p>

<h2 id="luu-tru">5. Lưu trữ và bảo mật</h2>
<p>Dữ liệu được lưu trên hạ tầng máy chủ có kiểm soát truy cập, mã hóa khi truyền tải và phân quyền theo vai trò. Hồ sơ liên quan đến phiên đấu giá được lưu trong thời hạn pháp luật về đấu giá tài sản và lưu trữ quy định; dữ liệu khác được lưu trong thời gian tài khoản còn hoạt động hoặc theo yêu cầu của pháp luật.</p>

<h2 id="quyen">6. Quyền của bạn</h2>
<p>Bạn có quyền được biết, truy cập, chỉnh sửa dữ liệu của mình; rút lại sự đồng ý; yêu cầu xóa hoặc hạn chế xử lý dữ liệu; phản đối việc xử lý cho mục đích tiếp thị; và khiếu nại theo quy định. Một số dữ liệu gắn với phiên đấu giá đã diễn ra không thể xóa trước thời hạn lưu trữ bắt buộc.</p>

<h2 id="cookie">7. Cookie và lưu trữ trên trình duyệt</h2>
<p>Sàn dùng bộ nhớ trình duyệt để duy trì phiên đăng nhập và ghi nhớ tùy chọn hiển thị. Tắt chức năng này có thể khiến bạn không đăng nhập được.</p>

<h2 id="thay-doi">8. Thay đổi chính sách</h2>
<p>Chúng tôi có thể cập nhật Chính sách này. Phiên bản mới có hiệu lực từ ngày ghi trên trang; khi đó bạn sẽ được yêu cầu đăng nhập lại để tiếp tục sử dụng Sàn.</p>

<h2 id="lien-he">9. Liên hệ</h2>
<p>Yêu cầu về dữ liệu cá nhân, vui lòng gửi tới: <strong>contact@taisandaugia.vn</strong>.</p>$html$);

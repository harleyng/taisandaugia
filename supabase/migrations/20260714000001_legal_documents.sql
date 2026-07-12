-- Văn bản pháp lý (Điều khoản sử dụng + Chính sách bảo mật) — registry phiên bản.
--
-- Admin quản lý nhãn phiên bản + NGÀY HIỆU LỰC + ghi chú thay đổi cho mỗi loại
-- (`terms` / `privacy`). Nội dung thân bài vẫn nằm trong 2 trang code
-- (/dieu-khoan-su-dung, /chinh-sach-bao-mat) — đây chỉ là registry metadata.
--
-- Consent ghi nhận theo TỪNG loại: profiles.{terms,privacy}_version. Khi admin
-- xuất bản phiên bản mới (effective_date ≤ hôm nay), user đã đồng ý phiên bản CŨ
-- sẽ bị buộc đăng xuất để đồng ý lại (xử lý ở client — useTermsGate).
--
-- set_updated_at() + has_role()/app_role đã tồn tại (migration trước) — chỉ tham chiếu.

-- ─── 1. Bảng registry ────────────────────────────────────────────────────────
CREATE TABLE public.legal_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type       TEXT        NOT NULL CHECK (doc_type IN ('terms','privacy')),
  version        TEXT        NOT NULL,               -- nhãn phiên bản, vd "2026-08-01"
  effective_date DATE        NOT NULL,               -- ngày hiệu lực
  changelog      TEXT,                                -- ghi chú thay đổi
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version)
);

CREATE INDEX idx_legal_documents_type_date
  ON public.legal_documents (doc_type, effective_date DESC);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anon/app: chỉ đọc phiên bản đã hiệu lực (để login text / gate / signup đọc được version hiện hành)
CREATE POLICY "legal_documents_public_read"
  ON public.legal_documents FOR SELECT
  USING (effective_date <= now());

-- Admin toàn quyền (giống partners_admin_all) — FOR ALL cũng phủ SELECT nên admin xem được cả phiên bản đã lên lịch
CREATE POLICY "legal_documents_admin_all"
  ON public.legal_documents FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Seed khớp trạng thái hiện tại (TERMS_VERSION = '2026-05-17') → KHÔNG logout hàng loạt lúc deploy
INSERT INTO public.legal_documents (doc_type, version, effective_date, changelog) VALUES
  ('terms',   '2026-05-17', '2026-05-17', 'Phiên bản khởi tạo'),
  ('privacy', '2026-05-17', '2026-05-17', 'Phiên bản khởi tạo');

-- ─── 2. Cột consent Chính sách bảo mật trên profiles ─────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_version     text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

-- Backfill: user đã đồng ý Điều khoản coi như đã đồng ý Chính sách cùng mốc → không bị đá ra
UPDATE public.profiles
  SET privacy_version = terms_version, privacy_accepted_at = terms_accepted_at
  WHERE terms_version IS NOT NULL AND privacy_version IS NULL;

-- ─── 3. Trigger tạo profile: đóng dấu CẢ hai loại consent từ metadata ─────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, name, kyc_status,
    notifications_enabled,
    terms_accepted_at, terms_version,
    privacy_accepted_at, privacy_version
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    'NOT_APPLIED'::kyc_status,
    COALESCE((NEW.raw_user_meta_data->>'notifications_enabled')::boolean, false),
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean IS TRUE
         THEN now() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean IS TRUE
         THEN NEW.raw_user_meta_data->>'terms_version' ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean IS TRUE
         THEN now() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean IS TRUE
         THEN NEW.raw_user_meta_data->>'privacy_version' ELSE NULL END
  );

  -- Assign default USER role (no BROKER role needed)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'USER');

  RETURN NEW;
END;
$function$;

-- Wizard "Số hoá tài sản": ảnh trở thành BẮT BUỘC (tối thiểu 1, mọi nhóm cấp 1),
-- video là tuỳ chọn, và các nhóm không có giấy tờ đăng ký sở hữu (máy móc / hàng
-- hoá / đồ dùng) thay giấy tờ bằng một BẢN CAM KẾT có chữ ký điện tử.
--
-- Chỉ bất động sản và xe cộ mới có sổ đỏ / cà-vẹt. Bắt các nhóm còn lại tải giấy
-- tờ là rào cản vô nghĩa — thực tế người dùng sẽ tải bừa một tệp để qua cửa, tức
-- là ta thu được rác thay vì bằng chứng.

-- ─── 1. Cột mới trên asset_postings ──────────────────────────────────────────
ALTER TABLE public.asset_postings
  ADD COLUMN IF NOT EXISTS video_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ownership_declaration JSONB;

-- Ràng buộc hình dạng: JSONB không tự bảo vệ được như cột phẳng. Không có CHECK
-- này thì một lần đổi tên khoá sẽ âm thầm trôi qua, và bản xuất phục vụ đối soát
-- pháp lý sau này sẽ không tìm thấy gì.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'asset_postings_ownership_declaration_shape'
      AND conrelid = 'public.asset_postings'::regclass
  ) THEN
    ALTER TABLE public.asset_postings
      ADD CONSTRAINT asset_postings_ownership_declaration_shape CHECK (
        ownership_declaration IS NULL OR (
          jsonb_typeof(ownership_declaration) = 'object'
          AND jsonb_exists(ownership_declaration, 'name')
          AND jsonb_exists(ownership_declaration, 'accepted_at')
          AND jsonb_exists(ownership_declaration, 'version')
          AND length(trim(ownership_declaration ->> 'name')) >= 3
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.asset_postings.video_urls IS
  'Public URL video tài sản (tuỳ chọn, tối đa 1). Tách riêng khỏi image_urls để giữ bất biến image_urls[0] = ảnh bìa.';

COMMENT ON COLUMN public.asset_postings.ownership_declaration IS
  'Bản cam kết sở hữu {name, accepted_at, version} cho nhóm tài sản không có giấy tờ đăng ký. JSONB vì đây là consent theo TỪNG hàng tài sản — khác với consent theo người dùng ở profiles.terms_accepted_at/terms_version (cột phẳng, singleton). Đừng "sửa" cho giống nhau.';

-- ─── 2. Storage: cho phép video vào bucket asset-media ───────────────────────
-- GIỮ NGUYÊN file_size_limit = 10485760 (10MB). file_size_limit là chốt chặn
-- CỨNG duy nhất và áp theo bucket; allowed_mime_types chỉ soi Content-Type do
-- client tự khai. Nâng limit lên vì video đồng nghĩa với việc trần 10MB của ảnh
-- biến mất vĩnh viễn — nên video cũng chịu chung mức 10MB.
--
-- Không nhận video/quicktime: .mov từ iPhone thường là HEVC, Chrome/Firefox
-- không giải mã được ⇒ upload "thành công" nhưng khung hình đen.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'
]
WHERE id = 'asset-media';

-- 4 policy sẵn có của asset-media vẫn khớp: video ghi vào ${uid}/video/${uuid}.ext
-- nên (storage.foldername(name))[1] vẫn là auth.uid()::text.

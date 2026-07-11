-- Public bucket cho ảnh banner quảng cáo (Desktop 795×255, Mobile 375×200).
-- Ảnh phải đọc công khai vì sẽ hiển thị trên website. Chỉ admin được upload/xoá.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-banners',
  'ad-banners',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

CREATE POLICY "ad_banners_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-banners');

CREATE POLICY "ad_banners_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ad-banners'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "ad_banners_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ad-banners'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

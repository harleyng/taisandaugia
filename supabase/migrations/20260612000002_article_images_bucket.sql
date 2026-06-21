-- Public bucket for article images (thumbnails + inline editor images)
-- Images must be publicly readable since they appear on the public website.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-images',
  'article-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Anyone can read (bucket is public, but explicit policy for clarity)
CREATE POLICY "article_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'article-images');

-- Only admins can upload
CREATE POLICY "article_images_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'article-images'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- Only admins can delete
CREATE POLICY "article_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'article-images'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

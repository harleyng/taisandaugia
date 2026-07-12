-- Public bucket cho logo đối tác. Đọc công khai (hiển thị homepage); chỉ admin upload/xoá.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partner-logos',
  'partner-logos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
);

CREATE POLICY "partner_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-logos');

CREATE POLICY "partner_logos_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'partner-logos'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "partner_logos_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'partner-logos'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

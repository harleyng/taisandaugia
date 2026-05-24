INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
);

CREATE POLICY "org members can read org-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "org members can upload org-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "org members can update org-documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "org members can delete org-documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'org-documents' AND auth.uid() IS NOT NULL);

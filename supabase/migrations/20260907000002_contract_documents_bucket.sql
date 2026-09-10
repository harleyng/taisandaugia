-- Bucket bản scan hợp đồng hợp tác.
--
-- ⚠️ KHÁC HẲN `partner-logos` (20260712000010): bucket đó `public = true` và có
-- policy đọc cho mọi người vì logo vốn để trưng ra trang chủ. Hợp đồng thì chứa
-- điều khoản hoa hồng — đọc CŨNG phải gác quyền admin, và client phải lấy file
-- bằng `createSignedUrl` chứ không `getPublicUrl`.
--
-- Path quy ước: {supplier_id}/{contract_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false,
  10485760,  -- 10 MB, khớp trần upload hồ sơ KYC
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contract_documents_admin_read"   ON storage.objects;
DROP POLICY IF EXISTS "contract_documents_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "contract_documents_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "contract_documents_admin_delete" ON storage.objects;

CREATE POLICY "contract_documents_admin_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contract-documents'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "contract_documents_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contract-documents'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- Cần cho `upsert: true` khi thay bản scan: Storage làm UPDATE chứ không INSERT.
CREATE POLICY "contract_documents_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'contract-documents'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "contract_documents_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contract-documents'
    AND public.has_role(auth.uid(), 'ADMIN'::app_role)
  );

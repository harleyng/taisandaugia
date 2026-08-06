-- ─────────────────────────────────────────────────────────────────────────────
-- Tủ tài liệu — chuyển metadata từ localStorage sang Supabase
--
-- BỐI CẢNH: file tài liệu ĐÃ nằm trên Storage (bucket 'org-documents') từ
-- migration 20260522000001, nhưng metadata (tên, thư mục, tag, phiên bản, liên
-- kết) lại lưu ở localStorage của TỪNG trình duyệt. Hệ quả đang xảy ra:
--   • mở máy khác  → file vẫn tồn tại, vẫn tính tiền lưu trữ, nhưng không ai
--     nhìn thấy và không ai xoá được  ⇒ rò rỉ dữ liệu + rò rỉ chi phí;
--   • đồng nghiệp cùng tổ chức không thấy tài liệu của nhau;
--   • không audit được ai tải lên cái gì.
--
-- ĐỒNG THỜI VÁ MỘT LỖ HỔNG PHÂN QUYỀN. Policy cũ của bucket là:
--     bucket_id = 'org-documents' AND auth.uid() IS NOT NULL
-- tức MỌI người dùng đã đăng nhập đều đọc / ghi đè / XOÁ được file của MỌI tổ
-- chức. Kết hợp với ORG_ID='default' hardcode ở supabase-storage.ts (mọi tổ
-- chức ghi chung một prefix) thì hồ sơ pháp lý, tờ khai thuế, hồ sơ nhân sự của
-- công ty này bị công ty khác đọc và xoá được.
--
-- Bucket hiện có 0 object nên KHÔNG có dữ liệu nào bị phơi và không cần di trú
-- file. Đường dẫn mới bắt buộc là {organization_id}/{document_id}/v{n}/{file}.
--
-- Cột đầy đủ, KHÔNG dùng JSONB payload: ba mảng lồng trong type Document
-- (versions, linkedEntities, tags) được tách thành bảng con / mảng Postgres
-- có kiểu thật, để truy vấn và ràng buộc được ở tầng DB.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Gate phân quyền ─────────────────────────────────────────────────────
-- CỐ Ý gate theo TƯ CÁCH THÀNH VIÊN, không tạo module RBAC mới: hành vi hiện
-- tại (localStorage) là bất kỳ ai vào được /portal đều thấy tủ tài liệu, nên
-- thêm module quyền ở đây sẽ âm thầm siết quyền của người đang dùng. Nếu sau
-- này cần phân quyền mịn cho tủ tài liệu thì thêm module 'nl-tu-tai-lieu' và
-- chỉ cần sửa đúng hàm này.
--
-- Nhánh owner_id là bắt buộc: org_has_permission chỉ nhìn
-- organization_memberships ACTIVE, còn portal resolve tổ chức qua
-- organizations.owner_id. Org nào thiếu dòng membership cho chủ sở hữu thì chủ
-- sẽ bị RLS chặn và thấy empty state khó hiểu (xem chú thích cùng vấn đề trong
-- 20260805000030_org_auctioneers.sql).
CREATE OR REPLACE FUNCTION public.can_access_org_documents(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _org_id IS NOT NULL AND (
    public.is_org_member(auth.uid(), _org_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations o
       WHERE o.id = _org_id AND o.owner_id = auth.uid()
    )
  )
$$;

-- ─── 2. Thư mục ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_document_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (btrim(name) <> ''),
  -- Cây thư mục. ON DELETE CASCADE: xoá thư mục cha thì xoá cả nhánh con.
  parent_id       UUID REFERENCES public.org_document_folders(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  color           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Thùng rác: giữ nguyên hành vi soft-delete của bản localStorage.
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT org_document_folders_name_uq UNIQUE (organization_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_doc_folders_org
  ON public.org_document_folders (organization_id) WHERE deleted_at IS NULL;

-- ─── 3. Tài liệu ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Xoá thư mục KHÔNG xoá tài liệu — chúng rơi về "Chưa phân loại" (folder_id
  -- NULL), giống cách bản localStorage cho phép folderId = null.
  folder_id       UUID REFERENCES public.org_document_folders(id) ON DELETE SET NULL,

  display_name      TEXT NOT NULL CHECK (btrim(display_name) <> ''),
  description       TEXT,
  -- Mảng Postgres có kiểu thật, không phải JSONB — lọc theo tag đi được index GIN.
  tags              TEXT[] NOT NULL DEFAULT '{}',
  expiry_date       DATE,
  is_starred        BOOLEAN NOT NULL DEFAULT false,

  mime_category     TEXT NOT NULL DEFAULT 'OTHER'
                    CHECK (mime_category IN ('PDF','WORD','EXCEL','IMAGE','OTHER')),
  original_filename TEXT NOT NULL,
  -- BIGINT: INTEGER tràn ở 2GB, tủ tài liệu là chỗ rất dễ chạm giới hạn đó.
  size_bytes        BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_path      TEXT NOT NULL,
  current_version   INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_org_documents_org
  ON public.org_documents (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_documents_folder
  ON public.org_documents (folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_documents_tags
  ON public.org_documents USING GIN (tags);

-- ─── 4. Phiên bản (thay mảng versions[]) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_document_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES public.org_documents(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL CHECK (version >= 1),
  storage_path TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT org_document_versions_uq UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_org_doc_versions_doc
  ON public.org_document_versions (document_id, version DESC);

-- ─── 5. Liên kết tới thực thể khác (thay mảng linkedEntities[]) ─────────────
CREATE TABLE IF NOT EXISTS public.org_document_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.org_documents(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL
              CHECK (entity_type IN ('AUCTIONEER','AUCTION','TAX_YEAR','INFRASTRUCTURE_SECTION','LEGAL_DOC')),
  -- TEXT chứ không UUID: TAX_YEAR dùng năm ("2025"), INFRASTRUCTURE_SECTION
  -- dùng mã mục ("II_1_1"), LEGAL_DOC dùng id field trên form. Chỉ AUCTIONEER
  -- và AUCTION mới là UUID.
  entity_id   TEXT NOT NULL CHECK (btrim(entity_id) <> ''),
  label       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_document_links_uq UNIQUE (document_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_org_doc_links_entity
  ON public.org_document_links (entity_type, entity_id);

-- ─── 6. updated_at tự động ──────────────────────────────────────────────────
-- Dùng lại public.set_updated_at() đã có (đang gắn cho 32 trigger khác) thay vì
-- thêm hàm thứ ba làm cùng một việc.
DROP TRIGGER IF EXISTS trg_org_doc_folders_touch ON public.org_document_folders;
CREATE TRIGGER trg_org_doc_folders_touch
  BEFORE UPDATE ON public.org_document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_org_documents_touch ON public.org_documents;
CREATE TRIGGER trg_org_documents_touch
  BEFORE UPDATE ON public.org_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 7. RLS ─────────────────────────────────────────────────────────────────
-- LƯU Ý QUY ƯỚC: đây là dữ liệu THUỘC TỔ CHỨC, nên KHÔNG dùng policy
-- "own rows" (auth.uid() = user_id) như các bảng credit/unlock của cá nhân.
-- Dùng sai sẽ khiến thành viên thứ hai của cùng tổ chức không thấy gì.
ALTER TABLE public.org_document_folders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_document_links    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_document_folders_all ON public.org_document_folders;
CREATE POLICY org_document_folders_all ON public.org_document_folders
  FOR ALL TO authenticated
  USING (public.can_access_org_documents(organization_id))
  WITH CHECK (public.can_access_org_documents(organization_id));

DROP POLICY IF EXISTS org_documents_all ON public.org_documents;
CREATE POLICY org_documents_all ON public.org_documents
  FOR ALL TO authenticated
  USING (public.can_access_org_documents(organization_id))
  WITH CHECK (public.can_access_org_documents(organization_id));

-- Bảng con không có organization_id: quyền suy từ tài liệu cha để không
-- denormalize (và không thể lệch với cha).
DROP POLICY IF EXISTS org_document_versions_all ON public.org_document_versions;
CREATE POLICY org_document_versions_all ON public.org_document_versions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_documents d
     WHERE d.id = document_id AND public.can_access_org_documents(d.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_documents d
     WHERE d.id = document_id AND public.can_access_org_documents(d.organization_id)
  ));

DROP POLICY IF EXISTS org_document_links_all ON public.org_document_links;
CREATE POLICY org_document_links_all ON public.org_document_links
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_documents d
     WHERE d.id = document_id AND public.can_access_org_documents(d.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_documents d
     WHERE d.id = document_id AND public.can_access_org_documents(d.organization_id)
  ));

-- ─── 8. VÁ LỖ HỔNG bucket 'org-documents' ───────────────────────────────────
-- Policy cũ cho mọi user đăng nhập đọc/ghi/xoá toàn bucket. Thay bằng gate
-- theo tổ chức, lấy organization_id từ segment ĐẦU của đường dẫn:
--     {organization_id}/{document_id}/v{n}/{filename}
CREATE OR REPLACE FUNCTION public.org_documents_path_org(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  seg TEXT := split_part(_name, '/', 1);
BEGIN
  -- Đường dẫn cũ dùng prefix 'default' (không phải UUID) → trả NULL để policy
  -- từ chối, thay vì để exception làm vỡ cả truy vấn storage.
  RETURN seg::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS "org members can read org-documents"   ON storage.objects;
DROP POLICY IF EXISTS "org members can upload org-documents" ON storage.objects;
DROP POLICY IF EXISTS "org members can update org-documents" ON storage.objects;
DROP POLICY IF EXISTS "org members can delete org-documents" ON storage.objects;

DROP POLICY IF EXISTS org_documents_storage_all ON storage.objects;
CREATE POLICY org_documents_storage_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.can_access_org_documents(public.org_documents_path_org(name))
  )
  WITH CHECK (
    bucket_id = 'org-documents'
    AND public.can_access_org_documents(public.org_documents_path_org(name))
  );

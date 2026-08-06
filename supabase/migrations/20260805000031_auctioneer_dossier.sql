-- ─────────────────────────────────────────────────────────────────────────────
-- Số hoá hồ sơ đấu giá viên / lãnh đạo — Migration B
--
-- 4 mảng nội dung của hồ sơ:
--   (a) định danh mở rộng   → cột thêm vào org_auctioneers (thuộc về con người)
--   (b) giấy tờ hành nghề   → org_auctioneer_documents
--   (c) quá trình công tác  → org_auctioneer_events (WORK / AUCTION)
--   (d) đào tạo, khen thưởng→ org_auctioneer_events (TRAINING / REWARD / DISCIPLINE)
--
-- (c) và (d) chung một bảng vì cùng hình dạng "một mốc có ngày, tiêu đề, đối
-- tác, mô tả, đính kèm". Tách bốn bảng chỉ thêm 4 hook/dialog/bộ RLS mà không
-- thêm tính đúng đắn — ràng buộc bắt buộc theo loại vẫn nằm ở Zod phía client.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Mảng (a): định danh mở rộng ─────────────────────────────────────────
ALTER TABLE public.org_auctioneers
  ADD COLUMN IF NOT EXISTS id_number       TEXT,
  ADD COLUMN IF NOT EXISTS id_type         TEXT CHECK (id_type IN ('CCCD', 'PASSPORT')),
  ADD COLUMN IF NOT EXISTS id_issued_date  DATE,
  ADD COLUMN IF NOT EXISTS id_issued_place TEXT,
  ADD COLUMN IF NOT EXISTS hometown        TEXT,
  ADD COLUMN IF NOT EXISTS ethnicity       TEXT,
  ADD COLUMN IF NOT EXISTS nationality     TEXT DEFAULT 'Việt Nam',
  ADD COLUMN IF NOT EXISTS gender          TEXT CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS major           TEXT,
  ADD COLUMN IF NOT EXISTS alma_mater      TEXT,
  -- Chức danh hiển thị công khai; rỗng thì suy ra từ `position`.
  ADD COLUMN IF NOT EXISTS public_title    TEXT,
  -- URL trực tiếp (bucket public) — client anon không mint được signed URL.
  ADD COLUMN IF NOT EXISTS portrait_url    TEXT,
  ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dossier_updated_at TIMESTAMPTZ;

-- Index phục vụ RPC công khai ở Migration C.
CREATE INDEX IF NOT EXISTS idx_org_auctioneers_public
  ON public.org_auctioneers (auction_org_id)
  WHERE is_public_profile AND is_active AND auction_org_id IS NOT NULL;

-- ─── 2. Mảng (b): giấy tờ hành nghề ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_auctioneer_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auctioneer_id UUID NOT NULL REFERENCES public.org_auctioneers(id) ON DELETE CASCADE,
  -- Denormalize để policy chỉ là một lời gọi hàm, không join ngược về cha.
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'DGV_CARD',        -- Thẻ đấu giá viên
    'CCHN',            -- Chứng chỉ hành nghề
    'DEGREE',          -- Bằng cấp
    'TRAINING_CERT',   -- Chứng chỉ đào tạo nghề đấu giá
    'CRIMINAL_RECORD', -- Lý lịch tư pháp
    'LABOR_CONTRACT',  -- Hợp đồng lao động
    'PORTRAIT',        -- Ảnh chân dung
    'OTHER'
  )),
  title       TEXT,
  doc_number  TEXT,
  issuer      TEXT,
  issued_date DATE,
  expiry_date DATE,
  file_paths  TEXT[] NOT NULL DEFAULT '{}',   -- đường dẫn trong bucket PRIVATE
  notes       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oad_auctioneer
  ON public.org_auctioneer_documents (auctioneer_id, doc_type);

DROP TRIGGER IF EXISTS oad_updated_at ON public.org_auctioneer_documents;
CREATE TRIGGER oad_updated_at BEFORE UPDATE ON public.org_auctioneer_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Mảng (c)+(d): dòng thời gian ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_auctioneer_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auctioneer_id UUID NOT NULL REFERENCES public.org_auctioneers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'WORK',       -- quá trình công tác
    'AUCTION',    -- cuộc đấu giá đã điều hành
    'TRAINING',   -- bồi dưỡng nghiệp vụ
    'REWARD',     -- khen thưởng
    'DISCIPLINE'  -- kỷ luật / xử phạt
  )),
  title             TEXT NOT NULL,
  organization_name TEXT,          -- WORK: nơi công tác · AUCTION: đơn vị có tài sản
  role              TEXT,          -- WORK: chức vụ · AUCTION: vai trò điều hành
  started_on        DATE,
  ended_on          DATE,
  reference_no      TEXT,          -- AUCTION: số hợp đồng · REWARD: số quyết định
  outcome           TEXT,          -- AUCTION: thành/không thành · TRAINING: xếp loại
  amount            NUMERIC(18, 0),-- AUCTION: giá trúng
  hours             INT,           -- TRAINING: số giờ bồi dưỡng
  notes             TEXT,
  attachments       TEXT[] NOT NULL DEFAULT '{}',
  -- id bản ghi nguồn trong tsd:auction-records, để nhập lại không nhân đôi.
  source_record_id  TEXT,
  sort_order        INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oae_auctioneer
  ON public.org_auctioneer_events (auctioneer_id, event_type, started_on DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oae_source
  ON public.org_auctioneer_events (auctioneer_id, source_record_id)
  WHERE source_record_id IS NOT NULL;

DROP TRIGGER IF EXISTS oae_updated_at ON public.org_auctioneer_events;
CREATE TRIGGER oae_updated_at BEFORE UPDATE ON public.org_auctioneer_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. RLS cho hai bảng con ────────────────────────────────────────────────
ALTER TABLE public.org_auctioneer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_auctioneer_events    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oad_select" ON public.org_auctioneer_documents;
CREATE POLICY "oad_select" ON public.org_auctioneer_documents
  FOR SELECT TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'view'));

DROP POLICY IF EXISTS "oad_insert" ON public.org_auctioneer_documents;
CREATE POLICY "oad_insert" ON public.org_auctioneer_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'create'));

DROP POLICY IF EXISTS "oad_update" ON public.org_auctioneer_documents;
CREATE POLICY "oad_update" ON public.org_auctioneer_documents
  FOR UPDATE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'update'));

DROP POLICY IF EXISTS "oad_delete" ON public.org_auctioneer_documents;
CREATE POLICY "oad_delete" ON public.org_auctioneer_documents
  FOR DELETE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'delete'));

DROP POLICY IF EXISTS "oad_admin_all" ON public.org_auctioneer_documents;
CREATE POLICY "oad_admin_all" ON public.org_auctioneer_documents
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "oae_select" ON public.org_auctioneer_events;
CREATE POLICY "oae_select" ON public.org_auctioneer_events
  FOR SELECT TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'view'));

DROP POLICY IF EXISTS "oae_insert" ON public.org_auctioneer_events;
CREATE POLICY "oae_insert" ON public.org_auctioneer_events
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'create'));

DROP POLICY IF EXISTS "oae_update" ON public.org_auctioneer_events;
CREATE POLICY "oae_update" ON public.org_auctioneer_events
  FOR UPDATE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'update'));

DROP POLICY IF EXISTS "oae_delete" ON public.org_auctioneer_events;
CREATE POLICY "oae_delete" ON public.org_auctioneer_events
  FOR DELETE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'delete'));

DROP POLICY IF EXISTS "oae_admin_all" ON public.org_auctioneer_events;
CREATE POLICY "oae_admin_all" ON public.org_auctioneer_events
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 5. Bucket ──────────────────────────────────────────────────────────────
-- Ảnh chân dung PUBLIC (trang công khai cần đọc bằng URL trực tiếp), giấy tờ
-- PRIVATE (CCCD, lý lịch tư pháp… chỉ đọc bằng signed URL).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('personnel-portraits', 'personnel-portraits', true,   5242880,
     ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('personnel-docs',      'personnel-docs',      false, 10485760,
     ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Đường dẫn theo TỔ CHỨC: {organization_id}/{auctioneer_id}/{uuid}.{ext}
-- KHÔNG dùng foldername[1] = auth.uid() như bucket kyc-ekyc: hồ sơ nhân sự
-- thuộc về tổ chức, hai thành viên cùng quản roster đều phải đọc/ghi được.
--
-- Regex UUID là BẮT BUỘC: thiếu nó, một object có segment đầu không phải UUID
-- sẽ làm phép ép ::uuid throw và 500 mọi thao tác trong bucket.
CREATE OR REPLACE FUNCTION public.personnel_folder_org(_name TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(_name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN ((storage.foldername(_name))[1])::uuid
    ELSE NULL
  END
$$;

DROP POLICY IF EXISTS "personnel_docs_org_all" ON storage.objects;
CREATE POLICY "personnel_docs_org_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'personnel-docs'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_org_auctioneers(public.personnel_folder_org(name), 'view')
  )
  WITH CHECK (
    bucket_id = 'personnel-docs'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_org_auctioneers(public.personnel_folder_org(name), 'update')
  );

DROP POLICY IF EXISTS "personnel_portraits_public_read" ON storage.objects;
CREATE POLICY "personnel_portraits_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'personnel-portraits');

DROP POLICY IF EXISTS "personnel_portraits_org_write" ON storage.objects;
CREATE POLICY "personnel_portraits_org_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'personnel-portraits'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_org_auctioneers(public.personnel_folder_org(name), 'update')
  )
  WITH CHECK (
    bucket_id = 'personnel-portraits'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_org_auctioneers(public.personnel_folder_org(name), 'update')
  );

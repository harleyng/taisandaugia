-- ─────────────────────────────────────────────────────────────────────────────
-- Hồ sơ nhân sự trở thành NƠI XUẤT BẢN, không còn là nơi nhập liệu
--
-- Dữ liệu sống ở Hồ sơ năng lực (Đấu giá viên + Lịch sử đấu giá); màn Hồ sơ
-- nhân sự chỉ chọn người + template rồi kết xuất. Mỗi lần Generate lưu lại
-- một bản ghi + file, để tải lại về sau không phải trả phí lần nữa và vẫn
-- đúng bản đã nộp (dữ liệu nguồn có thể đã đổi).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personnel_dossier_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Người bị xoá khỏi roster thì bản đã xuất vẫn phải còn ⇒ SET NULL, và
  -- giữ tên/số thẻ dạng ảnh chụp để danh sách không trống nghĩa.
  auctioneer_id   UUID REFERENCES public.org_auctioneers(id) ON DELETE SET NULL,
  auctioneer_name TEXT NOT NULL,
  license_number  TEXT,

  template TEXT NOT NULL CHECK (template IN ('FULL', 'SUMMARY', 'EXPERIENCE')),
  format   TEXT NOT NULL CHECK (format IN ('PDF', 'DOCX')),

  file_path        TEXT,                 -- trong bucket personnel-exports
  file_size_bytes  INT,
  credits_charged  INT NOT NULL DEFAULT 0,

  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pde_org
  ON public.personnel_dossier_exports (organization_id, generated_at DESC);

ALTER TABLE public.personnel_dossier_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pde_select" ON public.personnel_dossier_exports;
CREATE POLICY "pde_select" ON public.personnel_dossier_exports
  FOR SELECT TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'view'));

-- Ghi lịch sử xuất cần quyền 'view' chứ không phải 'create': nút "Xuất hồ sơ"
-- vốn chỉ đòi quyền xem (xem migration 20260805000040 của module nhan-su).
-- Đòi 'create' ở đây sẽ làm Nhân viên bấm Generate được nhưng không ghi được
-- bản ghi ⇒ mất phí mà danh sách trống.
DROP POLICY IF EXISTS "pde_insert" ON public.personnel_dossier_exports;
CREATE POLICY "pde_insert" ON public.personnel_dossier_exports
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'view'));

DROP POLICY IF EXISTS "pde_delete" ON public.personnel_dossier_exports;
CREATE POLICY "pde_delete" ON public.personnel_dossier_exports
  FOR DELETE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'delete'));

DROP POLICY IF EXISTS "pde_admin_all" ON public.personnel_dossier_exports;
CREATE POLICY "pde_admin_all" ON public.personnel_dossier_exports
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── Bucket file đã xuất ────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('personnel-exports', 'personnel-exports', false, 20971520,
   ARRAY['application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Cùng quy ước org-scoped + regex guard UUID như bucket personnel-docs:
-- thiếu guard thì một object có segment đầu không phải UUID sẽ làm phép ép
-- ::uuid throw và 500 mọi thao tác trong bucket.
DROP POLICY IF EXISTS "personnel_exports_org_all" ON storage.objects;
CREATE POLICY "personnel_exports_org_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'personnel-exports'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_org_auctioneers(public.personnel_folder_org(name), 'view')
  )
  WITH CHECK (
    bucket_id = 'personnel-exports'
    AND public.personnel_folder_org(name) IS NOT NULL
    AND public.can_manage_org_auctioneers(public.personnel_folder_org(name), 'view')
  );

-- ─── Dọn sự kiện AUCTION ────────────────────────────────────────────────────
-- Cuộc đấu giá nay ĐỌC THẲNG từ module Lịch sử đấu giá lúc kết xuất, không lưu
-- bản sao trong hồ sơ nữa. Không xoá thì template sẽ in trùng hai lần cùng một
-- cuộc: một bản từ đây, một bản derive.
DELETE FROM public.org_auctioneer_events WHERE event_type = 'AUCTION';

ALTER TABLE public.org_auctioneer_events
  DROP CONSTRAINT IF EXISTS org_auctioneer_events_event_type_check;
ALTER TABLE public.org_auctioneer_events
  ADD CONSTRAINT org_auctioneer_events_event_type_check
  CHECK (event_type IN ('WORK', 'TRAINING', 'REWARD', 'DISCIPLINE'));

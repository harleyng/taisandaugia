-- ─────────────────────────────────────────────────────────────────────────────
-- Số hoá hồ sơ đấu giá viên / lãnh đạo — Migration A
--
-- Chuyển roster đấu giá viên từ localStorage['tsd:auctioneers'] sang Supabase.
-- Đây là bảng nền: mảng hồ sơ chi tiết (giấy tờ, quá trình công tác, đào tạo)
-- nằm ở Migration B; RPC công khai nằm ở Migration C.
--
-- Phân quyền: dùng lại module RBAC 'nl-dau-gia-vien' đã seed trong
-- 20260805000020_org_rbac.sql. KHÔNG tạo module mới, KHÔNG sửa
-- org_seed_default_roles của luồng việc đó.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Gate quyền ──────────────────────────────────────────────────────────
-- org_has_permission() chỉ nhìn organization_memberships ACTIVE. Portal lại
-- resolve tổ chức qua organizations.owner_id (xem ThongTinChungPage.tsx). Nếu
-- một org nào đó thiếu dòng membership cho chủ sở hữu thì chủ sẽ resolve ra
-- organizationId nhưng bị RLS chặn ⇒ empty state khó hiểu. Bọc thêm nhánh
-- owner_id cho chắc. SECURITY DEFINER để không đệ quy RLS.
CREATE OR REPLACE FUNCTION public.can_manage_org_auctioneers(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'nl-dau-gia-vien', _action)
      OR EXISTS (
           SELECT 1 FROM public.organizations o
            WHERE o.id = _org_id AND o.owner_id = auth.uid()
         )
$$;

-- ─── 2. Bảng roster ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_auctioneers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Cầu nối tới danh bạ công khai. Denormalize từ
  -- organizations.license_info->>'auction_org_id' để trang /auction-org/:id
  -- không phải join qua JSONB lúc đọc.
  auction_org_id  UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,

  -- Nguồn dữ liệu (crawl Cổng Quốc gia vs nhập tay)
  source          TEXT NOT NULL DEFAULT 'MANUAL'
                  CHECK (source IN ('CRAWLED', 'MANUAL', 'CRAWLED_USER_ENRICHED')),
  crawled_at      TIMESTAMPTZ,
  crawled_from_url TEXT,
  is_verified_by_public_source BOOLEAN NOT NULL DEFAULT false,

  -- Thông tin công khai trên Cổng Quốc gia
  full_name                     TEXT NOT NULL,
  date_of_birth                 DATE,
  permanent_address             TEXT,
  professional_cert_number      TEXT NOT NULL DEFAULT '',   -- CCHN
  professional_cert_issued_date DATE,
  license_number                TEXT NOT NULL,              -- số thẻ ĐGV
  license_issued_date           DATE NOT NULL,
  license_expiry_date           DATE,
  joined_date                   DATE NOT NULL,
  ended_date                    DATE,

  position      TEXT NOT NULL DEFAULT 'AUCTIONEER'
                CHECK (position IN ('DIRECTOR', 'DEPUTY_DIRECTOR', 'AUCTIONEER')),
  contract_type TEXT NOT NULL DEFAULT 'OFFICIAL'
                CHECK (contract_type IN ('OFFICIAL', 'COLLABORATOR')),

  -- Thông tin nội bộ — không bao giờ lộ ra trang công khai
  email          TEXT,
  phone          TEXT,
  internal_notes TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,

  -- Xuất xứ từng trường + nhật ký ghi đè dữ liệu crawl
  field_sources      JSONB  NOT NULL DEFAULT '{}'::jsonb,
  overrides          JSONB  NOT NULL DEFAULT '[]'::jsonb,
  attached_documents TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Khớp dedupe key của src/lib/auctioneers/merge.ts (theo số thẻ ĐGV)
  CONSTRAINT org_auctioneers_license_uq UNIQUE (organization_id, license_number)
);

CREATE INDEX IF NOT EXISTS idx_org_auctioneers_org
  ON public.org_auctioneers (organization_id, is_active);

DROP TRIGGER IF EXISTS org_auctioneers_updated_at ON public.org_auctioneers;
CREATE TRIGGER org_auctioneers_updated_at
  BEFORE UPDATE ON public.org_auctioneers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
-- CHÚ Ý: không có policy public-read ở đây. RLS là row-level, không phải
-- column-level — một policy USING (is_public_profile) sẽ lộ CẢ DÒNG (CCCD,
-- email, điện thoại, ghi chú nội bộ) cho client anon gõ select *. Trang công
-- khai đọc qua RPC public_org_auctioneers() ở Migration C.
ALTER TABLE public.org_auctioneers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_auctioneers_select" ON public.org_auctioneers;
CREATE POLICY "org_auctioneers_select" ON public.org_auctioneers
  FOR SELECT TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'view'));

DROP POLICY IF EXISTS "org_auctioneers_insert" ON public.org_auctioneers;
CREATE POLICY "org_auctioneers_insert" ON public.org_auctioneers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'create'));

DROP POLICY IF EXISTS "org_auctioneers_update" ON public.org_auctioneers;
CREATE POLICY "org_auctioneers_update" ON public.org_auctioneers
  FOR UPDATE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'update'));

DROP POLICY IF EXISTS "org_auctioneers_delete" ON public.org_auctioneers;
CREATE POLICY "org_auctioneers_delete" ON public.org_auctioneers
  FOR DELETE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'delete'));

DROP POLICY IF EXISTS "org_auctioneers_admin_all" ON public.org_auctioneers;
CREATE POLICY "org_auctioneers_admin_all" ON public.org_auctioneers
  FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

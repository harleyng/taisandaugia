-- ─────────────────────────────────────────────────────────────────────────────
-- Đợt di trú localStorage → Supabase, phần A:
--   • tax                 (tsd:tax-records)
--   • general-info        (tsd:general-info)
--   • demandSubscription  (demandSubscription.v1)
--
-- CỘT ĐẦY ĐỦ, không JSONB payload: mọi trường vô hướng thành cột có kiểu thật,
-- mọi mảng lồng thành bảng con hoặc mảng Postgres có kiểu.
--
-- HAI MÔ HÌNH RLS trong migration này, cố ý khác nhau:
--   • org_*   → dữ liệu THUỘC TỔ CHỨC, gate theo tư cách thành viên;
--   • user_*  → dữ liệu CÁ NHÂN, quy ước "own rows" (auth.uid() = user_id).
-- Dùng lẫn là lỗi: "own rows" cho bảng org khiến thành viên thứ hai không thấy
-- gì; membership-gate cho bảng cá nhân thì lộ dữ liệu người khác.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Gate dùng chung cho dữ liệu tổ chức ────────────────────────────────────
-- Cùng khuôn với can_access_org_documents (20260806000030). Nhánh owner_id là
-- BẮT BUỘC: is_org_member chỉ nhìn organization_memberships ACTIVE, còn portal
-- resolve tổ chức qua organizations.owner_id.
CREATE OR REPLACE FUNCTION public.can_access_org_capacity(_org_id UUID)
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

-- ═══ 1. THUẾ & TÀI CHÍNH ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_tax_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  year        INTEGER NOT NULL CHECK (year BETWEEN 1990 AND 2200),
  record_type TEXT NOT NULL CHECK (record_type IN ('CIT', 'NSNN')),
  -- NUMERIC(18,0) chứ không BIGINT/float: tiền VND không có phần thập phân, và
  -- float sẽ làm tròn sai ở mức nghìn tỷ. NUMERIC là kiểu duy nhất đúng cho tiền.
  amount      NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  -- User phải tự tick xác nhận số tiền đã trừ VAT (z.literal(true) ở form).
  vat_excluded  BOOLEAN NOT NULL DEFAULT false,
  is_finalized  BOOLEAN NOT NULL DEFAULT false,
  finalized_date DATE,
  notes         TEXT,
  -- Soft delete: giữ hành vi của bản localStorage (bản ghi thuế là dữ liệu kế
  -- toán, xoá hẳn thì không đối chiếu lại được).
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  -- Điểm mục IV.9 suy từ amount; lưu lại để báo cáo không phải tính lại.
  score_contribution SMALLINT NOT NULL DEFAULT 0 CHECK (score_contribution BETWEEN 0 AND 3),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_tax_records_org
  ON public.org_tax_records (organization_id, year DESC) WHERE NOT is_deleted;

-- Mảng supportingDocuments[] → bảng con. doc_id trỏ tới org_documents nhưng
-- KHÔNG đặt khoá ngoại: bản ghi thuế cũ có thể tham chiếu tài liệu đã bị xoá
-- vĩnh viễn, và mất tham chiếu không được phép làm mất cả bản ghi thuế.
CREATE TABLE IF NOT EXISTS public.org_tax_record_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_record_id UUID NOT NULL REFERENCES public.org_tax_records(id) ON DELETE CASCADE,
  doc_id        TEXT NOT NULL CHECK (btrim(doc_id) <> ''),
  doc_type      TEXT NOT NULL DEFAULT 'OTHER'
                CHECK (doc_type IN ('TAX_RETURN','TAX_RECEIPT','AUDIT_REPORT','OTHER')),
  file_name     TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_tax_record_documents_uq UNIQUE (tax_record_id, doc_id)
);

-- ═══ 2. THÔNG TIN CHUNG TỔ CHỨC ═════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_general_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE: mỗi tổ chức đúng một bản thông tin chung (bản localStorage cũng là
  -- một object đơn, không phải danh sách).
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Định danh
  name              TEXT NOT NULL DEFAULT '',
  short_name        TEXT,
  org_type          TEXT CHECK (org_type IN ('TRUNG_TAM_DV','CONG_TY_HOP_DANH','DN_TU_NHAN')),
  tax_code          TEXT NOT NULL DEFAULT '',
  registration_code TEXT,

  -- Nhận diện thương hiệu
  logo_url      TEXT,
  logo_initials TEXT,
  brand_color   TEXT,

  -- Địa chỉ
  address  TEXT NOT NULL DEFAULT '',
  ward     TEXT,
  district TEXT,
  province TEXT NOT NULL DEFAULT '',

  -- Liên hệ
  phone             TEXT NOT NULL DEFAULT '',
  alternative_phone TEXT,
  fax               TEXT,
  email             TEXT NOT NULL DEFAULT '',
  alternative_email TEXT,
  website           TEXT,

  -- Người đại diện theo pháp luật
  legal_rep_name             TEXT NOT NULL DEFAULT '',
  legal_rep_position         TEXT,
  legal_rep_id_number        TEXT,
  legal_rep_id_issued_date   DATE,
  legal_rep_id_issued_place  TEXT,

  -- Thành lập
  founded_date                    DATE,
  establishment_decision_number   TEXT,
  establishment_decision_date     DATE,
  establishment_decision_issuer   TEXT,
  -- Đường dẫn Storage tới bản scan, KHÔNG phải nội dung file.
  establishment_decision_file     TEXT,

  business_license_number TEXT,
  business_license_date   DATE,
  business_license_issuer TEXT,
  business_license_file   TEXT,

  -- Danh sách Bộ Tư pháp (mục I của bộ tiêu chí năng lực)
  is_listed_in_moj_directory BOOLEAN NOT NULL DEFAULT false,
  moj_listing_notes          TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.org_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_name       TEXT NOT NULL DEFAULT '',
  account_number  TEXT NOT NULL DEFAULT '',
  account_holder  TEXT NOT NULL DEFAULT '',
  branch          TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ràng buộc ở tầng DB thay vì chỉ tin vào UI: tối đa MỘT tài khoản chính mỗi
-- tổ chức. Partial unique index là cách duy nhất diễn đạt được điều này.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_bank_accounts_one_primary
  ON public.org_bank_accounts (organization_id) WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_org_bank_accounts_org
  ON public.org_bank_accounts (organization_id, sort_order);

CREATE TABLE IF NOT EXISTS public.org_branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  type            TEXT NOT NULL DEFAULT 'BRANCH' CHECK (type IN ('BRANCH','REP_OFFICE')),
  address         TEXT NOT NULL DEFAULT '',
  province        TEXT NOT NULL DEFAULT '',
  district        TEXT,
  ward            TEXT,
  phone           TEXT,
  email           TEXT,
  manager_name    TEXT,
  established_date DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_branches_org
  ON public.org_branches (organization_id) WHERE is_active;

-- ═══ 3. GÓI THEO DÕI NHU CẦU (dữ liệu CÁ NHÂN) ══════════════════════════════
-- Đây là chỗ đang mất tiền của user: credit ĐÃ trừ thật qua Supabase nhưng gói
-- lại lưu ở localStorage, nên đổi trình duyệt/xoá cache là mất gói đã trả tiền
-- mà không có cách nào đối chiếu.
CREATE TABLE IF NOT EXISTS public.user_demand_subscriptions (
  -- PK là user_id: mỗi người đúng một gói đang hiệu lực, gia hạn thì cộng dồn
  -- vào expires_at (cùng quy ước stacking như unlockCompany/unlockOwner).
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier       TEXT NOT NULL CHECK (tier IN ('weekly','monthly','yearly')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_demand_subscriptions_period CHECK (expires_at > started_at)
);

-- ═══ 4. Trigger updated_at ══════════════════════════════════════════════════
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'org_tax_records','org_general_info','org_bank_accounts',
    'org_branches','user_demand_subscriptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ═══ 5. RLS ═════════════════════════════════════════════════════════════════

ALTER TABLE public.org_tax_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_tax_record_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_general_info           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_bank_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_branches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_demand_subscriptions  ENABLE ROW LEVEL SECURITY;

-- Bảng có organization_id: gate trực tiếp.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_tax_records','org_general_info','org_bank_accounts','org_branches'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %s_org_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %s_org_all ON public.%I FOR ALL TO authenticated
         USING (public.can_access_org_capacity(organization_id))
         WITH CHECK (public.can_access_org_capacity(organization_id))', t, t);
  END LOOP;
END $$;

-- Bảng con không có organization_id: quyền suy từ bản ghi cha để không
-- denormalize (và không thể lệch với cha).
DROP POLICY IF EXISTS org_tax_record_documents_all ON public.org_tax_record_documents;
CREATE POLICY org_tax_record_documents_all ON public.org_tax_record_documents
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_tax_records r
     WHERE r.id = tax_record_id AND public.can_access_org_capacity(r.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_tax_records r
     WHERE r.id = tax_record_id AND public.can_access_org_capacity(r.organization_id)
  ));

-- Dữ liệu CÁ NHÂN → quy ước "own rows" của CLAUDE.md.
DROP POLICY IF EXISTS user_demand_subscriptions_own ON public.user_demand_subscriptions;
CREATE POLICY user_demand_subscriptions_own ON public.user_demand_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

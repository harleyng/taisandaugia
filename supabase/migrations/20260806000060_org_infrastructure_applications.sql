-- ─────────────────────────────────────────────────────────────────────────────
-- Đợt di trú localStorage → Supabase, phần B (hai module nặng nhất):
--   • infrastructure  (tsd:infrastructure)   — 7 mục lồng sâu
--   • applications    (tsd:applications, tsd:application:{id}, tsd:capacity:profile)
--
-- CỘT ĐẦY ĐỦ. Với 7 mục của infrastructure, "cột đầy đủ" nghĩa là LÀM PHẲNG các
-- trường vô hướng theo tiền tố mục (hq_, rp_, cam_office_, cam_auction_, web_,
-- oap_, ar_) thay vì 7 cột JSONB. Dài hơn nhưng bù lại: DB kiểm được CHECK trên
-- từng enum, báo cáo query được từng trường, và thêm/bớt trường là migration
-- tường minh chứ không phải đổi ngầm hình dạng JSON.
--
-- Ảnh (PhotoAttachment[]) của CẢ 7 mục gom vào MỘT bảng con có cột `section`:
-- chúng cùng hình dạng, tách 7 bảng chỉ nhân bản schema và code.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ 1. CƠ SỞ VẬT CHẤT ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_infrastructure (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Một bản ghi cho mỗi tổ chức. Bản localStorage hardcode orgId='default' nên
  -- MỌI tổ chức từng ghi chung một chỗ — UNIQUE ở đây chặn tái diễn.
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- ── Mục II.1.1 — Trụ sở ───────────────────────────────────────────────────
  hq_address          TEXT NOT NULL DEFAULT '',
  hq_ward             TEXT NOT NULL DEFAULT '',
  hq_district         TEXT NOT NULL DEFAULT '',
  hq_province         TEXT NOT NULL DEFAULT '',
  hq_phone            TEXT NOT NULL DEFAULT '',
  hq_email            TEXT NOT NULL DEFAULT '',
  hq_working_area     NUMERIC(10,2) CHECK (hq_working_area IS NULL OR hq_working_area >= 0),
  hq_floor_count      SMALLINT CHECK (hq_floor_count IS NULL OR hq_floor_count >= 0),
  hq_is_owned         BOOLEAN NOT NULL DEFAULT true,
  hq_lease_end_date   DATE,
  hq_last_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Mục II.1.2 — Điểm tiếp nhận hồ sơ ─────────────────────────────────────
  rp_is_at_headquarters   BOOLEAN NOT NULL DEFAULT true,
  rp_address              TEXT,
  rp_working_hours        TEXT NOT NULL DEFAULT '',
  -- Mảng Postgres có kiểu, không JSONB: ['T2','T3',...]
  rp_working_days         TEXT[] NOT NULL DEFAULT '{}',
  rp_public_notice_method TEXT NOT NULL DEFAULT '',
  rp_last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Mục II.2.1 — Camera tại trụ sở ────────────────────────────────────────
  cam_office_has_system           BOOLEAN NOT NULL DEFAULT false,
  cam_office_locations            TEXT[] NOT NULL DEFAULT '{}',
  cam_office_can_extract_recording BOOLEAN NOT NULL DEFAULT false,
  cam_office_can_store_with_case  BOOLEAN NOT NULL DEFAULT false,
  cam_office_technical_notes      TEXT,
  cam_office_last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Mục II.2.2 — Camera tại nơi đấu giá ───────────────────────────────────
  cam_auction_has_system            BOOLEAN NOT NULL DEFAULT false,
  cam_auction_is_same_as_office     BOOLEAN NOT NULL DEFAULT false,
  cam_auction_locations             TEXT[] NOT NULL DEFAULT '{}',
  cam_auction_can_extract_recording BOOLEAN NOT NULL DEFAULT false,
  cam_auction_can_store_with_case   BOOLEAN NOT NULL DEFAULT false,
  cam_auction_technical_notes       TEXT,
  cam_auction_last_updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Mục II.3 — Trang thông tin điện tử ────────────────────────────────────
  web_type                     TEXT NOT NULL DEFAULT 'OWN_DOMAIN'
                               CHECK (web_type IN ('OWN_DOMAIN','SUB_PORTAL_DOJ')),
  web_url                      TEXT NOT NULL DEFAULT '',
  web_is_reachable             BOOLEAN,
  web_last_checked             TIMESTAMPTZ,
  web_has_regular_updates      BOOLEAN NOT NULL DEFAULT false,
  web_last_content_update_date DATE,
  web_last_updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Mục II.4 — Nền tảng đấu giá trực tuyến ────────────────────────────────
  oap_qualification_type    TEXT NOT NULL DEFAULT 'NONE'
                            CHECK (oap_qualification_type IN ('APPROVED','CONDUCTED_LAST_YEAR','NONE')),
  oap_approval_document_number TEXT,
  oap_approval_date         DATE,
  oap_approved_by           TEXT,
  oap_approval_document     TEXT,
  oap_url                   TEXT,
  oap_is_own_platform       BOOLEAN,
  oap_platform_provider     TEXT,
  oap_last_year_auction_count INTEGER CHECK (oap_last_year_auction_count IS NULL OR oap_last_year_auction_count >= 0),
  oap_last_updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Mục II.5 — Lưu trữ hồ sơ ──────────────────────────────────────────────
  ar_is_at_headquarters BOOLEAN NOT NULL DEFAULT true,
  ar_address            TEXT,
  ar_area               NUMERIC(10,2) CHECK (ar_area IS NULL OR ar_area >= 0),
  ar_storage_type       TEXT NOT NULL DEFAULT 'CABINET'
                        CHECK (ar_storage_type IN ('CABINET','ROOM','WAREHOUSE','DIGITAL','HYBRID')),
  ar_security_measures  TEXT[] NOT NULL DEFAULT '{}',
  ar_last_updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Điểm (suy diễn, lưu lại để báo cáo khỏi tính lại) ─────────────────────
  total_score            NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_1_1           NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_1_2           NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_2_1           NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_2_2           NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_3             NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_4             NUMERIC(6,2) NOT NULL DEFAULT 0,
  score_ii_5             NUMERIC(6,2) NOT NULL DEFAULT 0,
  completion_percentage  SMALLINT NOT NULL DEFAULT 0
                         CHECK (completion_percentage BETWEEN 0 AND 100),
  sections_needing_update TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ảnh/ảnh chụp màn hình của cả 7 mục.
CREATE TABLE IF NOT EXISTS public.org_infrastructure_photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  infrastructure_id UUID NOT NULL REFERENCES public.org_infrastructure(id) ON DELETE CASCADE,
  -- Mục nào sở hữu ảnh này. 'website'/'online_platform' là ảnh chụp màn hình.
  section TEXT NOT NULL CHECK (section IN (
    'headquarters','reception_point','camera_at_office','camera_at_auction',
    'website','online_platform','archive'
  )),
  -- Trỏ tới org_documents nhưng KHÔNG khoá ngoại: ảnh cũ có thể tham chiếu tài
  -- liệu đã xoá vĩnh viễn, mất tham chiếu không được làm mất bản ghi cơ sở vật chất.
  document_id  TEXT,
  storage_path TEXT NOT NULL,
  file_name    TEXT NOT NULL DEFAULT '',
  file_size    BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  caption      TEXT,
  taken_at     TIMESTAMPTZ,
  width        INTEGER NOT NULL DEFAULT 0,
  height       INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_infra_photos_section
  ON public.org_infrastructure_photos (infrastructure_id, section, sort_order);

-- ═══ 2. HỒ SƠ NĂNG LỰC TỔNG HỢP ═════════════════════════════════════════════
-- CapacityProfile: ảnh chụp điểm năng lực toàn tổ chức, các module khác ghi vào.
CREATE TABLE IF NOT EXISTS public.org_capacity_profile (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name    TEXT,

  on_ministry_list        BOOLEAN NOT NULL DEFAULT false,   -- Mục I
  score_ii                NUMERIC(6,2) NOT NULL DEFAULT 0,  -- Cơ sở vật chất /19
  score_iv_1_to_4         NUMERIC(6,2) NOT NULL DEFAULT 0,  -- Lịch sử đấu giá /21
  auctions_completed      INTEGER NOT NULL DEFAULT 0,
  auctions_missing_price  INTEGER NOT NULL DEFAULT 0,
  score_iv_5              NUMERIC(6,2) NOT NULL DEFAULT 0,  -- Số năm hoạt động /5
  years_active            NUMERIC(5,2) NOT NULL DEFAULT 0,
  score_iv_6_to_8         NUMERIC(6,2) NOT NULL DEFAULT 0,  -- Đấu giá viên /13
  auctioneer_count        INTEGER NOT NULL DEFAULT 0,
  score_iv_9              NUMERIC(6,2) NOT NULL DEFAULT 0,  -- Thuế năm trước /6
  -- Đơn vị: TRIỆU VND (giữ đúng đơn vị của type CapacityProfile để không lệch
  -- khi so sánh với điểm đã tính).
  tax_paid_previous_year  NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_capacity_score    NUMERIC(6,2) NOT NULL DEFAULT 0,  -- /76
  warnings                TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ 3. HỒ SƠ DỰ TUYỂN ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Tên do user đặt; rỗng thì UI suy tiêu đề từ thông báo.
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','EXPORTED','SUBMITTED','WON','LOST')),

  -- ── Thông báo đấu giá ─────────────────────────────────────────────────────
  ann_owner_name        TEXT NOT NULL DEFAULT '',
  ann_asset_description TEXT NOT NULL DEFAULT '',
  -- '' trong type nghĩa là "chưa chọn" ⇒ NULL ở DB, và CHECK chỉ áp khi có giá trị.
  ann_asset_category    TEXT CHECK (ann_asset_category IN
                        ('LAND_USE_RIGHT','ADMIN_VIOLATION','ENFORCEMENT','MACHINERY','VEHICLE','OTHER')),
  ann_starting_price    NUMERIC(18,0) CHECK (ann_starting_price IS NULL OR ann_starting_price >= 0),
  ann_asset_location    TEXT NOT NULL DEFAULT '',
  ann_province          TEXT NOT NULL DEFAULT '',
  ann_deadline          DATE,
  ann_url               TEXT,
  ann_number            TEXT,
  ann_date              DATE,

  -- ── Ảnh chụp điểm năng lực tại thời điểm lập hồ sơ ────────────────────────
  -- CỐ Ý sao chép chứ không join org_capacity_profile: hồ sơ đã nộp phải giữ
  -- nguyên con số lúc nộp, không được đổi theo khi năng lực tổ chức thay đổi.
  cap_score_i          NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_score_ii         NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_score_iv_1_to_4  NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_score_iv_5       NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_score_iv_6_to_8  NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_score_iv_9       NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_total_score      NUMERIC(6,2) NOT NULL DEFAULT 0,
  cap_warnings         TEXT[] NOT NULL DEFAULT '{}',
  cap_snapshot_at      TIMESTAMPTZ,

  -- ── Mục 3 — Phương án đấu giá (/16) ───────────────────────────────────────
  plan_format                  TEXT NOT NULL DEFAULT '',
  plan_reception_plan          TEXT NOT NULL DEFAULT '',
  plan_participant_conditions  TEXT NOT NULL DEFAULT '',
  plan_anti_collusion_measures TEXT NOT NULL DEFAULT '',
  plan_score                   NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- ── Tổng hợp ──────────────────────────────────────────────────────────────
  section_v_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_score     NUMERIC(6,2) NOT NULL DEFAULT 0,
  export_format   TEXT CHECK (export_format IN ('SEPARATED','INTEGRATED','CUSTOM')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_applications_org
  ON public.org_applications (organization_id, updated_at DESC);

-- Mảng sectionVCriteria[]
CREATE TABLE IF NOT EXISTS public.org_application_criteria (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.org_applications(id) ON DELETE CASCADE,
  -- Mã tiêu chí theo bộ tiêu chí (không phải UUID) — giữ nguyên `id` phía UI.
  criterion_key  TEXT NOT NULL CHECK (btrim(criterion_key) <> ''),
  label          TEXT NOT NULL DEFAULT '',
  max_points     NUMERIC(6,2) NOT NULL DEFAULT 0,
  nature         TEXT NOT NULL DEFAULT 'PROPOSAL' CHECK (nature IN ('CAPACITY','PROPOSAL')),
  nature_auto_detected BOOLEAN NOT NULL DEFAULT false,
  -- BOOLEAN NULL diễn đạt đúng CriterionMeets = true | false | null
  -- ("chưa đánh giá" khác hẳn "không đạt").
  meets          BOOLEAN,
  evidence       TEXT NOT NULL DEFAULT '',
  attached_doc_ids TEXT[] NOT NULL DEFAULT '{}',
  auto_match_matched BOOLEAN,
  auto_match_items   TEXT[] NOT NULL DEFAULT '{}',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT org_application_criteria_uq UNIQUE (application_id, criterion_key)
);

-- Mảng exportedFiles[]
CREATE TABLE IF NOT EXISTS public.org_application_exports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.org_applications(id) ON DELETE CASCADE,
  url            TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  exported_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_application_exports_app
  ON public.org_application_exports (application_id, exported_at DESC);

-- ═══ 4. Trigger updated_at ══════════════════════════════════════════════════
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'org_infrastructure','org_capacity_profile','org_applications'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ═══ 5. RLS ═════════════════════════════════════════════════════════════════
ALTER TABLE public.org_infrastructure        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_infrastructure_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_capacity_profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_applications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_application_criteria  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_application_exports   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_infrastructure','org_capacity_profile','org_applications'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %s_org_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %s_org_all ON public.%I FOR ALL TO authenticated
         USING (public.can_access_org_capacity(organization_id))
         WITH CHECK (public.can_access_org_capacity(organization_id))', t, t);
  END LOOP;
END $$;

-- Bảng con: quyền suy từ cha.
DROP POLICY IF EXISTS org_infrastructure_photos_all ON public.org_infrastructure_photos;
CREATE POLICY org_infrastructure_photos_all ON public.org_infrastructure_photos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_infrastructure i
     WHERE i.id = infrastructure_id AND public.can_access_org_capacity(i.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_infrastructure i
     WHERE i.id = infrastructure_id AND public.can_access_org_capacity(i.organization_id)
  ));

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_application_criteria','org_application_exports'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %s_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %s_all ON public.%I FOR ALL TO authenticated
         USING (EXISTS (SELECT 1 FROM public.org_applications a
                         WHERE a.id = application_id
                           AND public.can_access_org_capacity(a.organization_id)))
         WITH CHECK (EXISTS (SELECT 1 FROM public.org_applications a
                              WHERE a.id = application_id
                                AND public.can_access_org_capacity(a.organization_id)))', t, t);
  END LOOP;
END $$;

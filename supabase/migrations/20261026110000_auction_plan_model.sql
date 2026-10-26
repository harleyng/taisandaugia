-- ─────────────────────────────────────────────────────────────────────────────
-- Kế hoạch đấu giá — mô hình dữ liệu, quyền và RPC luồng duyệt
-- Phase 2 của docs/owner-auction-planning-plan.md (mục A2, A4, A7).
--
-- Một MÔ HÌNH kế hoạch cho HAI cấp (A2):
--   • Hình A — tỉnh sở hữu Trạm, mỗi xã là một CHI NHÁNH (`branch_id`), cán bộ xã
--     là thành viên bị giới hạn chi nhánh (`branch_scope`).
--   • Hình B — xã có Trạm riêng, liên kết làm con của Trạm tỉnh (Phase 14).
--
-- ⚠️ Ngoại lệ có chủ đích với luật Phase 14 "trụ sở chỉ ĐỌC": ở hình B, thành
-- viên Trạm CHA có `ke-hoach:approve` được TRẢ LẠI / GHI NHẬN PHÊ DUYỆT kế hoạch
-- của Trạm CON. Ngoại lệ đó nằm GỌN trong `auction_plan_reviewer_ok` và các RPC
-- duyệt — KHÔNG BAO GIỜ đưa vào `owner_ws_has` (nếu không trụ sở sẽ ghi được mọi
-- bảng của chi nhánh).
--
-- ⚠️ Người bị giới hạn chi nhánh KHÔNG BAO GIỜ có `approve` hiệu lực (A2): mọi
-- cổng duyệt đi qua `auction_plan_can_approve()` = quyền module + KHÔNG giới hạn
-- chi nhánh (`owner_ws_branch_ok(ws, NULL)`).
--
-- Bảng của SÀN ĐẤU GIÁ (`auction_sessions`, `auction_session_items`…) chỉ ĐỌC —
-- xem docs/platform-ownership.md. Migration này không chạm tới chúng.
-- ─────────────────────────────────────────────────────────────────────────────

-- DDL + backfill trên các bảng nóng của RBAC: khoá hết trong MỘT câu ở đầu giao
-- dịch để không deadlock với truy vấn app (common-pitfalls.md, 2026-09-26 P4).
LOCK TABLE public.owner_ws_roles, public.owner_ws_role_permissions,
           public.asset_owner_workspaces, public.workspace_branches
      IN ACCESS EXCLUSIVE MODE;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. DANH MỤC QUYỀN: module 'ke-hoach' + thao tác MỚI 'approve'
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚠️ Bản dưới đây được dựng từ `pg_get_functiondef` của bản ĐANG CHẠY
-- (2026-10-26, 50 cặp / 16 module) rồi THÊM 6 cặp 'ke-hoach' ⇒ 56 cặp / 17
-- module. Đừng bao giờ sửa hàm này từ một file migration cũ (bẫy 2026-10-01).
--
-- 'approve' là thao tác chưa từng có trong danh mục. Danh sách thao tác KHÔNG bị
-- CHECK ở bảng nào cả — `owner_ws_role_permissions_guard` chỉ đối chiếu với hàm
-- này — nên thêm vào đây là đủ ở phía DB. Phía client, union `OwnerAction` là
-- tập ĐÓNG: đã nới trong `src/lib/ownerWorkspace/permissions.ts`.
CREATE OR REPLACE FUNCTION public.owner_ws_permission_catalog()
RETURNS TABLE(module text, action text)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  VALUES
    ('chi-tieu', 'view'), ('chi-tieu', 'create'), ('chi-tieu', 'update'), ('chi-tieu', 'delete'),
    ('ke-hoach', 'view'), ('ke-hoach', 'create'), ('ke-hoach', 'update'), ('ke-hoach', 'delete'),
    ('ke-hoach', 'finalize'), ('ke-hoach', 'approve'),
    ('tai-san', 'view'), ('tai-san', 'update'),
    ('ket-qua', 'view'), ('ket-qua', 'update'), ('ket-qua', 'delete'),
    ('so-hoa', 'view'), ('so-hoa', 'create'), ('so-hoa', 'update'), ('so-hoa', 'share'),
    ('ky-gui', 'view'), ('ky-gui', 'create'), ('ky-gui', 'update'),
    ('hop-dong-mua-ban', 'view'), ('hop-dong-mua-ban', 'update'),
    ('thu-tien', 'view'), ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
    ('truyen-thong', 'view'), ('truyen-thong', 'create'), ('truyen-thong', 'update'),
    ('truyen-thong', 'delete'), ('truyen-thong', 'finalize'), ('truyen-thong', 'share'),
    ('phan-tich', 'view'),
    ('dong-tien', 'view'),
    ('bao-cao-dinh-ky', 'view'), ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'),
    ('bao-cao-dinh-ky', 'delete'), ('bao-cao-dinh-ky', 'finalize'), ('bao-cao-dinh-ky', 'share'),
    ('chi-nhanh', 'view'), ('chi-nhanh', 'update'),
    ('thanh-vien', 'view'), ('thanh-vien', 'create'), ('thanh-vien', 'update'), ('thanh-vien', 'delete'),
    ('vai-tro', 'view'), ('vai-tro', 'create'), ('vai-tro', 'update'), ('vai-tro', 'delete'),
    ('lien-ket', 'view'), ('lien-ket', 'update'),
    ('nhat-ky', 'view'), ('nhat-ky', 'share')
$function$;

-- Vai trò mặc định (A7): Cán bộ lập & TRÌNH kế hoạch, KHÔNG duyệt; Người xem chỉ
-- xem (quy tắc `action='view'` cho mọi module ⇒ tự có 'ke-hoach:view').
CREATE OR REPLACE FUNCTION public.owner_ws_default_role_permissions(p_code text)
RETURNS TABLE(module text, action text)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT c.module, c.action
    FROM public.owner_ws_permission_catalog() c
   WHERE c.module <> 'nhat-ky'
     AND ((p_code = 'VIEWER' AND c.action = 'view')
      OR (p_code = 'STAFF' AND (
            c.action = 'view'
         OR (c.module, c.action) IN (
              ('tai-san', 'update'),
              ('ket-qua', 'update'), ('ket-qua', 'delete'),
              ('so-hoa', 'create'), ('so-hoa', 'update'), ('so-hoa', 'share'),
              ('ky-gui', 'create'), ('ky-gui', 'update'),
              ('hop-dong-mua-ban', 'update'),
              ('thu-tien', 'create'), ('thu-tien', 'update'), ('thu-tien', 'delete'),
              ('truyen-thong', 'create'), ('truyen-thong', 'update'),
              ('ke-hoach', 'create'), ('ke-hoach', 'update'), ('ke-hoach', 'delete'),
              ('ke-hoach', 'finalize'),
              ('bao-cao-dinh-ky', 'create'), ('bao-cao-dinh-ky', 'update'), ('bao-cao-dinh-ky', 'delete')))))
$function$;

-- Cấp cho các Trạm ĐANG CÓ. Chỉ STAFF / VIEWER mặc định — vai trò TỰ TẠO không
-- được cấp module mới lúc triển khai (cùng luật với 'truyen-thong'); Trưởng đơn
-- vị là `is_system` nên đã toàn quyền, kể cả 'approve'.
INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
SELECT r.id, d.module, d.action
  FROM public.owner_ws_roles r
  CROSS JOIN LATERAL public.owner_ws_default_role_permissions(r.code) d
 WHERE NOT r.is_system
   AND r.code IN ('STAFF', 'VIEWER')
   AND d.module = 'ke-hoach'
ON CONFLICT (role_id, module, action) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. CỔNG QUYỀN RIÊNG CỦA KẾ HOẠCH
-- ═════════════════════════════════════════════════════════════════════════════

-- "Duyệt" hiệu lực = có `ke-hoach:approve` VÀ không bị giới hạn chi nhánh (A2).
-- `owner_ws_branch_ok(ws, NULL)` đúng là phép thử đó: Trưởng đơn vị và thành
-- viên không giới hạn ⇒ true; người có `branch_scope` ⇒ false (NULL = ANY(...)
-- trả NULL ⇒ COALESCE false). Một chỗ duy nhất, mọi cổng duyệt gọi vào đây.
CREATE OR REPLACE FUNCTION public.auction_plan_can_approve(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_has(p_workspace_id, 'ke-hoach', 'approve')
     AND public.owner_ws_branch_ok(p_workspace_id, NULL)
$$;

COMMENT ON FUNCTION public.auction_plan_can_approve(UUID) IS
  'Quyền duyệt kế hoạch hiệu lực trong MỘT Trạm: ke-hoach:approve + KHÔNG bị giới hạn chi nhánh (A2). Người bị giới hạn chi nhánh không bao giờ duyệt được.';

REVOKE ALL ON FUNCTION public.auction_plan_can_approve(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_can_approve(UUID) TO authenticated;

-- "Ai ở trên tôi" — HÀM DUY NHẤT cho cả hai hình triển khai (A2).
--   hình A: người duyệt là thành viên CÙNG Trạm, có approve, không giới hạn chi nhánh;
--   hình B: người duyệt là thành viên đang hoạt động của Trạm CHA, có approve.
-- Định nghĩa sau khi có bảng `auction_plans` (xem mục 9) — khai trước để các
-- policy tham chiếu được, nên ở đây dùng bản tạm trả false.
CREATE OR REPLACE FUNCTION public.auction_plan_reviewer_ok(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT false $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. ĐỢT LẬP KẾ HOẠCH (tỉnh → xã) — A4.1
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.auction_plan_cycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  plan_year       INT  NOT NULL CHECK (plan_year BETWEEN 2020 AND 2100),
  kind            TEXT NOT NULL DEFAULT 'annual' CHECK (kind IN ('annual', 'supplement')),
  status          TEXT NOT NULL DEFAULT 'open'   CHECK (status IN ('open', 'closed')),
  submit_deadline DATE,
  instructions    TEXT,
  attachment_urls TEXT[] NOT NULL DEFAULT '{}',
  closed_at       TIMESTAMPTZ,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT apc_one_per_year UNIQUE (workspace_id, plan_year, kind)
);

COMMENT ON TABLE public.auction_plan_cycles IS
  'Đợt lập kế hoạch do cấp tỉnh mở: hạn trình + hướng dẫn + chỉ tiêu giao cho từng xã. Chỉ ghi qua RPC auction_plan_cycle_*.';

CREATE INDEX IF NOT EXISTS idx_apc_workspace ON public.auction_plan_cycles (workspace_id, plan_year DESC);

CREATE TABLE IF NOT EXISTS public.auction_plan_cycle_units (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id           UUID NOT NULL REFERENCES public.auction_plan_cycles(id) ON DELETE CASCADE,
  -- Ép từ đợt (RLS khỏi join) — cùng mẹo với owner_workspace_target_criteria.
  workspace_id       UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  admin_unit_code    TEXT NOT NULL REFERENCES public.admin_units(code) ON DELETE RESTRICT,
  branch_id          UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  child_workspace_id UUID REFERENCES public.asset_owner_workspaces(id) ON DELETE SET NULL,
  assigned_revenue   NUMERIC(18,0) CHECK (assigned_revenue IS NULL OR assigned_revenue >= 0),
  assigned_count     INT           CHECK (assigned_count   IS NULL OR assigned_count BETWEEN 0 AND 999999),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT apcu_one_per_unit UNIQUE (cycle_id, admin_unit_code),
  -- Một đơn vị trong đợt là chi nhánh (hình A) HOẶC Trạm con (hình B), không cả hai.
  CONSTRAINT apcu_one_shape CHECK (branch_id IS NULL OR child_workspace_id IS NULL)
);

COMMENT ON TABLE public.auction_plan_cycle_units IS
  'Một dòng = một xã/phường trong đợt: chi nhánh (hình A) hoặc Trạm con đã liên kết (hình B) + chỉ tiêu thu giao.';

CREATE INDEX IF NOT EXISTS idx_apcu_cycle  ON public.auction_plan_cycle_units (cycle_id);
CREATE INDEX IF NOT EXISTS idx_apcu_branch ON public.auction_plan_cycle_units (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apcu_child  ON public.auction_plan_cycle_units (child_workspace_id) WHERE child_workspace_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. KẾ HOẠCH — A4.2
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.auction_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  branch_id         UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  admin_unit_code   TEXT NOT NULL REFERENCES public.admin_units(code) ON DELETE RESTRICT,
  cycle_id          UUID REFERENCES public.auction_plan_cycles(id) ON DELETE SET NULL,
  plan_year         INT  NOT NULL CHECK (plan_year BETWEEN 2020 AND 2100),
  kind              TEXT NOT NULL DEFAULT 'annual' CHECK (kind IN ('annual', 'supplement')),
  title             TEXT,
  level             TEXT NOT NULL DEFAULT 'commune'
                         CHECK (level IN ('commune', 'province', 'consolidated')),
  status            TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'submitted', 'returned', 'approved', 'adjusting', 'closed')),
  baseline_version  INT  NOT NULL DEFAULT 0 CHECK (baseline_version >= 0),
  approval_doc_no   TEXT,
  approval_doc_date DATE,
  approval_doc_urls TEXT[] NOT NULL DEFAULT '{}',
  legal_basis       TEXT,
  notes             TEXT,
  submitted_at      TIMESTAMPTZ,
  submitted_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_comment    TEXT,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auction_plans IS
  'Kế hoạch đấu giá của MỘT đơn vị lập kế hoạch = (workspace_id, branch_id NULL|id, admin_unit_code). Trạng thái chỉ đổi qua RPC auction_plan_*.';
COMMENT ON COLUMN public.auction_plans.baseline_version IS
  'Tăng 1 ở MỖI lần ghi nhận phê duyệt. 0 = chưa từng duyệt (chưa có mốc so sánh).';
COMMENT ON COLUMN public.auction_plans.approval_doc_no IS
  'Số quyết định phê duyệt ký NGOÀI ứng dụng (quyết định D5): app chỉ GHI NHẬN, không thay chữ ký.';

-- Mỗi đơn vị chỉ MỘT kế hoạch năm chưa đóng (A4.2). NULLS NOT DISTINCT để kế
-- hoạch toàn đơn vị (branch_id NULL) cũng là duy nhất.
CREATE UNIQUE INDEX IF NOT EXISTS apl_one_open_annual
  ON public.auction_plans (workspace_id, branch_id, plan_year) NULLS NOT DISTINCT
  WHERE kind = 'annual' AND status <> 'closed';

CREATE INDEX IF NOT EXISTS idx_apl_workspace ON public.auction_plans (workspace_id, plan_year DESC);
CREATE INDEX IF NOT EXISTS idx_apl_branch    ON public.auction_plans (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apl_cycle     ON public.auction_plans (cycle_id) WHERE cycle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apl_unit      ON public.auction_plans (admin_unit_code);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. DANH MỤC TÀI SẢN TRONG KẾ HOẠCH — A4.3
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.auction_plan_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              UUID NOT NULL REFERENCES public.auction_plans(id) ON DELETE CASCADE,
  -- Ép từ kế hoạch cha (RLS khỏi join).
  workspace_id         UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  admin_unit_code      TEXT NOT NULL REFERENCES public.admin_units(code) ON DELETE RESTRICT,

  -- ── Trường MỐC (baseline): khoá khi kế hoạch không ở draft / adjusting ──
  seq                  INT  NOT NULL,
  item_code            TEXT NOT NULL,
  asset_type           TEXT NOT NULL DEFAULT 'land_use_right'
                            CHECK (asset_type IN ('land_use_right', 'public_asset', 'other')),
  title                TEXT NOT NULL CHECK (char_length(btrim(title)) >= 2),
  lot_labels           TEXT,
  lot_count            INT           CHECK (lot_count IS NULL OR lot_count BETWEEN 1 AND 99999),
  map_sheet            TEXT,
  parcel_no            TEXT,
  location             TEXT,
  area_m2              NUMERIC(14,1) CHECK (area_m2 IS NULL OR area_m2 >= 0),
  land_use_code        TEXT,
  allocation_form      TEXT CHECK (allocation_form IS NULL OR allocation_form IN
                            ('giao_co_thu_tien', 'thue_tra_mot_lan', 'thue_tra_hang_nam', 'khac')),
  unit_start_price     NUMERIC(18,0) CHECK (unit_start_price IS NULL OR unit_start_price >= 0),
  expected_start_value NUMERIC(18,0) CHECK (expected_start_value IS NULL OR expected_start_value >= 0),
  planned_month        DATE,
  planned_method       TEXT NOT NULL DEFAULT 'chua_xac_dinh' CHECK (planned_method IN
                            ('truc_tiep_loi_noi', 'bo_phieu_gian_tiep', 'bo_phieu_truc_tiep',
                             'truc_tuyen', 'chua_xac_dinh')),
  executing_unit       TEXT,

  -- ── Trường THỰC HIỆN: sửa tự do khi có ke-hoach:update + đúng chi nhánh ──
  forecast_month       DATE,
  forecast_reason      TEXT,
  responsible_user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  asset_posting_id     UUID REFERENCES public.asset_postings(id) ON DELETE SET NULL,
  listing_id           UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  exec_status          TEXT NOT NULL DEFAULT 'active' CHECK (exec_status IN ('active', 'dropped')),
  exec_note            TEXT,

  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_code_per_plan UNIQUE (plan_id, item_code),
  CONSTRAINT api_seq_per_plan  UNIQUE (plan_id, seq),
  -- Tháng luôn là ngày 01 (so sánh theo kỳ khỏi phải truncate).
  CONSTRAINT api_month_first   CHECK (planned_month  IS NULL OR date_trunc('month', planned_month)  = planned_month),
  CONSTRAINT api_forecast_first CHECK (forecast_month IS NULL OR date_trunc('month', forecast_month) = forecast_month)
);

COMMENT ON TABLE public.auction_plan_items IS
  'Một dòng = một lô đất / tài sản công trong kế hoạch. Trường mốc khoá khi kế hoạch đã trình hoặc đã duyệt; trường thực hiện sửa được mọi lúc.';
COMMENT ON COLUMN public.auction_plan_items.exec_status IS
  'dropped = bỏ khỏi kế hoạch. Đây là THAY ĐỔI MỐC ⇒ chỉ đổi được khi kế hoạch ở draft / adjusting (A4.6).';

CREATE INDEX IF NOT EXISTS idx_api_plan      ON public.auction_plan_items (plan_id, seq);
CREATE INDEX IF NOT EXISTS idx_api_workspace ON public.auction_plan_items (workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_branch    ON public.auction_plan_items (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_month     ON public.auction_plan_items (workspace_id, planned_month);
CREATE INDEX IF NOT EXISTS idx_api_posting   ON public.auction_plan_items (asset_posting_id) WHERE asset_posting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_listing   ON public.auction_plan_items (listing_id) WHERE listing_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. MỐC CÔNG VIỆC — A4.4
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.auction_plan_item_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES public.auction_plan_items(id) ON DELETE CASCADE,
  -- Ép từ tài sản cha (RLS khỏi join).
  plan_id       UUID NOT NULL REFERENCES public.auction_plans(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  branch_id     UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  step          TEXT NOT NULL CHECK (step IN
                     ('legal_ready', 'start_price', 'plan_approved', 'org_selected', 'contract_signed',
                      'announced', 'auction_held', 'result_approved', 'paid', 'handed_over')),
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  planned_date  DATE,
  done_on       DATE,
  doc_no        TEXT,
  doc_date      DATE,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'platform')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT apis_one_per_step UNIQUE (item_id, step)
);

COMMENT ON TABLE public.auction_plan_item_steps IS
  'Mốc công việc của một tài sản trong kế hoạch, dựng từ mẫu theo asset_type. source=platform ⇒ nhãn "Sàn xác nhận"; ngày của sàn THẮNG tick tay (ngày tay giữ ở note).';

CREATE INDEX IF NOT EXISTS idx_apis_item      ON public.auction_plan_item_steps (item_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_apis_plan      ON public.auction_plan_item_steps (plan_id);
CREATE INDEX IF NOT EXISTS idx_apis_workspace ON public.auction_plan_item_steps (workspace_id);
CREATE INDEX IF NOT EXISTS idx_apis_due       ON public.auction_plan_item_steps (workspace_id, planned_date) WHERE done_on IS NULL;

-- Mẫu mốc theo loại tài sản (A4.4). QSDĐ = 10 mốc; tài sản công / khác = 8 mốc
-- (bỏ "hoàn thiện hồ sơ pháp lý thửa đất" và "giao đất / cấp giấy").
CREATE OR REPLACE FUNCTION public.auction_plan_step_template(p_asset_type TEXT)
RETURNS TABLE(step TEXT, sort_order SMALLINT)
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT s.step, s.ord::SMALLINT
    FROM (VALUES
            ('legal_ready',     1),
            ('start_price',     2),
            ('plan_approved',   3),
            ('org_selected',    4),
            ('contract_signed', 5),
            ('announced',       6),
            ('auction_held',    7),
            ('result_approved', 8),
            ('paid',            9),
            ('handed_over',    10)
         ) AS s(step, ord)
   WHERE p_asset_type = 'land_use_right'
      OR s.step NOT IN ('legal_ready', 'handed_over')
$$;

REVOKE ALL ON FUNCTION public.auction_plan_step_template(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_step_template(TEXT) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. MỐC ĐÃ ĐÓNG BĂNG — A4.5
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.auction_plan_baselines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES public.auction_plans(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  branch_id         UUID REFERENCES public.workspace_branches(id) ON DELETE SET NULL,
  version           INT  NOT NULL CHECK (version >= 1),
  approved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_doc_no   TEXT,
  approval_doc_date DATE,
  approval_doc_urls TEXT[] NOT NULL DEFAULT '{}',
  payload           JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT apb_one_per_version UNIQUE (plan_id, version)
);

COMMENT ON TABLE public.auction_plan_baselines IS
  'Bản đóng băng trường mốc + tổng theo tháng/quý tại MỖI lần phê duyệt. BẤT BIẾN (cùng luật với báo cáo định kỳ đã chốt): chỉ RPC auction_plan_record_approval ghi, không ai sửa.';

CREATE INDEX IF NOT EXISTS idx_apb_plan ON public.auction_plan_baselines (plan_id, version DESC);

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. TRIGGER ÉP DỮ LIỆU & CHẶN THAY ĐỔI
-- ═════════════════════════════════════════════════════════════════════════════

-- Cờ giao dịch: chỉ các RPC luồng duyệt được đổi status / baseline_version /
-- cột quyết định. Ngoài ra còn chặn bằng quyền CỘT (mục 11) — hai lớp, vì một
-- lần GRANT rộng tay sau này sẽ vô hiệu hoá lớp kia.
CREATE OR REPLACE FUNCTION public.auction_plan_in_rpc()
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT COALESCE(current_setting('auction_plan.rpc', true), '') = 'on' $$;

REVOKE ALL ON FUNCTION public.auction_plan_in_rpc() FROM PUBLIC, anon, authenticated;

-- ── 8.1 Đơn vị trong đợt: ép workspace_id, kiểm hình A / hình B ──────────────
CREATE OR REPLACE FUNCTION public.auction_plan_cycle_units_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cycle_id IS DISTINCT FROM OLD.cycle_id THEN
    RAISE EXCEPTION 'Không thể chuyển đơn vị sang đợt khác';
  END IF;

  SELECT c.workspace_id INTO v_ws FROM public.auction_plan_cycles c WHERE c.id = NEW.cycle_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đợt lập kế hoạch';
  END IF;
  NEW.workspace_id := v_ws;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.workspace_branches b
        WHERE b.id = NEW.branch_id AND b.workspace_id = v_ws) THEN
    RAISE EXCEPTION 'Chi nhánh không thuộc đơn vị này';
  END IF;

  IF NEW.child_workspace_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.asset_owner_workspaces w
        WHERE w.id = NEW.child_workspace_id AND w.parent_workspace_id = v_ws) THEN
    RAISE EXCEPTION 'Trạm con chưa liên kết với đơn vị này';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_cycle_units_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_cycle_units_guard ON public.auction_plan_cycle_units;
CREATE TRIGGER auction_plan_cycle_units_guard
  BEFORE INSERT OR UPDATE ON public.auction_plan_cycle_units
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_cycle_units_guard();

-- ── 8.2 Kế hoạch: người lập, ĐVHC mặc định, bất biến, cổng chuyển trạng thái ──
CREATE OR REPLACE FUNCTION public.auction_plans_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      -- Kế hoạch luôn sinh ra ở dạng nháp, chưa có mốc, chưa có quyết định.
      IF NEW.status <> 'draft' OR NEW.baseline_version <> 0
         OR NEW.approval_doc_no IS NOT NULL OR NEW.approval_doc_date IS NOT NULL
         OR NEW.submitted_at IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Kế hoạch mới phải ở dạng nháp';
      END IF;
    END IF;
    -- ĐVHC mặc định: của chi nhánh, nếu không thì của Trạm (Phase 1).
    IF NEW.admin_unit_code IS NULL THEN
      SELECT COALESCE(b.admin_unit_code, w.admin_unit_code) INTO v_code
        FROM public.asset_owner_workspaces w
        LEFT JOIN public.workspace_branches b ON b.id = NEW.branch_id
       WHERE w.id = NEW.workspace_id;
      IF v_code IS NULL THEN
        RAISE EXCEPTION 'Chưa gán đơn vị hành chính cho đơn vị lập kế hoạch';
      END IF;
      NEW.admin_unit_code := v_code;
    END IF;
  ELSE
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'Không thể chuyển kế hoạch sang đơn vị khác';
    END IF;
    IF NEW.plan_year IS DISTINCT FROM OLD.plan_year AND OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Không thể đổi năm của kế hoạch đã trình';
    END IF;
    -- Trạng thái + cột quyết định chỉ đổi trong RPC luồng duyệt.
    IF NOT public.auction_plan_in_rpc()
       AND (NEW.status            IS DISTINCT FROM OLD.status
         OR NEW.baseline_version  IS DISTINCT FROM OLD.baseline_version
         OR NEW.approval_doc_no   IS DISTINCT FROM OLD.approval_doc_no
         OR NEW.approval_doc_date IS DISTINCT FROM OLD.approval_doc_date
         OR NEW.approval_doc_urls IS DISTINCT FROM OLD.approval_doc_urls
         OR NEW.submitted_at      IS DISTINCT FROM OLD.submitted_at
         OR NEW.reviewed_at       IS DISTINCT FROM OLD.reviewed_at
         OR NEW.review_comment    IS DISTINCT FROM OLD.review_comment) THEN
      RAISE EXCEPTION 'Trạng thái kế hoạch chỉ đổi qua thao tác Trình / Trả lại / Ghi nhận phê duyệt';
    END IF;
    -- Nội dung mô tả chỉ sửa khi còn mở (draft / returned / adjusting).
    IF OLD.status IN ('submitted', 'approved', 'closed')
       AND NOT public.auction_plan_in_rpc()
       AND (NEW.title IS DISTINCT FROM OLD.title
         OR NEW.legal_basis IS DISTINCT FROM OLD.legal_basis
         OR NEW.cycle_id IS DISTINCT FROM OLD.cycle_id
         OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
         OR NEW.admin_unit_code IS DISTINCT FROM OLD.admin_unit_code
         OR NEW.kind IS DISTINCT FROM OLD.kind
         OR NEW.level IS DISTINCT FROM OLD.level) THEN
      RAISE EXCEPTION 'Kế hoạch đã trình / đã duyệt không sửa được phần đầu';
    END IF;
    -- Người lập không đổi — trừ khi tài khoản bị xoá (ON DELETE SET NULL).
    IF NEW.created_by IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_id IS DISTINCT FROM OLD.branch_id)
     AND NOT EXISTS (SELECT 1 FROM public.workspace_branches b
                      WHERE b.id = NEW.branch_id AND b.workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'Chi nhánh không thuộc đơn vị này';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plans_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plans_guard ON public.auction_plans;
CREATE TRIGGER auction_plans_guard
  BEFORE INSERT OR UPDATE ON public.auction_plans
  FOR EACH ROW EXECUTE FUNCTION public.auction_plans_guard();

-- Xoá: chỉ bản nháp chưa từng duyệt.
CREATE OR REPLACE FUNCTION public.auction_plans_delete_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'draft' OR OLD.baseline_version > 0 THEN
    RAISE EXCEPTION 'Chỉ xoá được kế hoạch nháp chưa từng được phê duyệt — hãy dùng Đóng kế hoạch';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plans_delete_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plans_delete_guard ON public.auction_plans;
CREATE TRIGGER auction_plans_delete_guard
  BEFORE DELETE ON public.auction_plans
  FOR EACH ROW EXECUTE FUNCTION public.auction_plans_delete_guard();

-- ── 8.3 Tài sản trong kế hoạch: ép khoá cha, tự cấp mã, khoá trường mốc ──────
CREATE OR REPLACE FUNCTION public.auction_plan_items_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Mọi trường MỐC của A4.3. Thêm cột mốc mới ⇒ thêm vào đây.
  c_baseline CONSTANT TEXT[] := ARRAY[
    'item_code', 'asset_type', 'title', 'lot_labels', 'lot_count', 'map_sheet', 'parcel_no',
    'location', 'area_m2', 'land_use_code', 'allocation_form', 'unit_start_price',
    'expected_start_value', 'planned_month', 'planned_method', 'executing_unit'];
  v_plan public.auction_plans%ROWTYPE;
  v_open BOOLEAN;
  _k TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Không thể chuyển tài sản sang kế hoạch khác';
  END IF;

  SELECT * INTO v_plan FROM public.auction_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy kế hoạch';
  END IF;
  v_open := v_plan.status IN ('draft', 'adjusting');

  -- Khoá cha, ép xuống dòng con (RLS khỏi join).
  NEW.workspace_id    := v_plan.workspace_id;
  NEW.branch_id       := v_plan.branch_id;
  NEW.admin_unit_code := v_plan.admin_unit_code;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_open THEN
      RAISE EXCEPTION 'Kế hoạch đã trình / đã duyệt: thêm tài sản phải mở Điều chỉnh';
    END IF;
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    -- Mã tự tăng theo kế hoạch: KH{yy}-{seq:03}. Khoá kế hoạch để hai người
    -- thêm cùng lúc không nhận cùng số thứ tự.
    PERFORM 1 FROM public.auction_plans WHERE id = NEW.plan_id FOR UPDATE;
    IF NEW.seq IS NULL OR NEW.seq <= 0 THEN
      SELECT COALESCE(MAX(i.seq), 0) + 1 INTO NEW.seq
        FROM public.auction_plan_items i WHERE i.plan_id = NEW.plan_id;
    END IF;
    IF NEW.item_code IS NULL OR btrim(NEW.item_code) = '' THEN
      NEW.item_code := 'KH' || to_char(make_date(v_plan.plan_year, 1, 1), 'YY')
                            || '-' || lpad(NEW.seq::TEXT, 3, '0');
    END IF;
  ELSE
    -- Trường mốc KHOÁ khi kế hoạch không ở draft / adjusting (A4.3).
    IF NOT v_open THEN
      FOREACH _k IN ARRAY c_baseline LOOP
        IF (to_jsonb(NEW) -> _k) IS DISTINCT FROM (to_jsonb(OLD) -> _k) THEN
          RAISE EXCEPTION 'Kế hoạch đã trình / đã duyệt: "%" chỉ sửa được khi mở Điều chỉnh', _k;
        END IF;
      END LOOP;
      -- Bỏ / bật lại một tài sản cũng là thay đổi MỐC (A4.6).
      IF NEW.exec_status IS DISTINCT FROM OLD.exec_status THEN
        RAISE EXCEPTION 'Bỏ tài sản khỏi kế hoạch là thay đổi mốc — phải mở Điều chỉnh';
      END IF;
    END IF;
    IF NEW.created_by IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;

  -- Giá trị khởi điểm dự kiến mặc định = diện tích × đơn giá (sửa được).
  IF NEW.expected_start_value IS NULL AND NEW.area_m2 IS NOT NULL AND NEW.unit_start_price IS NOT NULL THEN
    NEW.expected_start_value := round(NEW.area_m2 * NEW.unit_start_price);
  END IF;

  -- Tháng dự kiến phải nằm trong năm kế hoạch (dự kiến MỚI thì không — trễ sang
  -- năm sau là chuyện bình thường, và đó là trường thực hiện).
  IF NEW.planned_month IS NOT NULL
     AND EXTRACT(YEAR FROM NEW.planned_month)::INT <> v_plan.plan_year THEN
    RAISE EXCEPTION 'Tháng dự kiến phải nằm trong năm % của kế hoạch', v_plan.plan_year;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_items_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_items_guard ON public.auction_plan_items;
CREATE TRIGGER auction_plan_items_guard
  BEFORE INSERT OR UPDATE ON public.auction_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_items_guard();

-- Xoá một dòng cũng là thay đổi mốc. Xoá dây chuyền từ kế hoạch thì bỏ qua
-- (dòng kế hoạch lúc đó đã không còn, hoặc đang ở nháp).
CREATE OR REPLACE FUNCTION public.auction_plan_items_delete_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT p.status INTO v_status FROM public.auction_plans p WHERE p.id = OLD.plan_id;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft', 'adjusting') THEN
    RAISE EXCEPTION 'Kế hoạch đã trình / đã duyệt: bỏ tài sản phải mở Điều chỉnh';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_items_delete_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_items_delete_guard ON public.auction_plan_items;
CREATE TRIGGER auction_plan_items_delete_guard
  BEFORE DELETE ON public.auction_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_items_delete_guard();

-- Dựng mốc công việc từ mẫu ngay khi thêm tài sản (A4.4).
CREATE OR REPLACE FUNCTION public.auction_plan_items_seed_steps()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auction_plan_item_steps (item_id, plan_id, workspace_id, branch_id, step, sort_order)
  SELECT NEW.id, NEW.plan_id, NEW.workspace_id, NEW.branch_id, t.step, t.sort_order
    FROM public.auction_plan_step_template(NEW.asset_type) t
  ON CONFLICT (item_id, step) DO NOTHING;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_items_seed_steps() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_items_seed_steps ON public.auction_plan_items;
CREATE TRIGGER auction_plan_items_seed_steps
  AFTER INSERT ON public.auction_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_items_seed_steps();

-- ── 8.4 Mốc công việc: ép khoá cha ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_plan_item_steps_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item public.auction_plan_items%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.item_id IS DISTINCT FROM OLD.item_id THEN
    RAISE EXCEPTION 'Không thể chuyển mốc sang tài sản khác';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.step IS DISTINCT FROM OLD.step THEN
    RAISE EXCEPTION 'Không thể đổi loại mốc';
  END IF;

  SELECT * INTO v_item FROM public.auction_plan_items WHERE id = NEW.item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy tài sản trong kế hoạch';
  END IF;

  NEW.plan_id      := v_item.plan_id;
  NEW.workspace_id := v_item.workspace_id;
  NEW.branch_id    := v_item.branch_id;

  IF NEW.done_on IS NOT NULL AND NEW.done_on > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE THEN
    RAISE EXCEPTION 'Ngày hoàn thành không được ở tương lai';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_item_steps_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_item_steps_guard ON public.auction_plan_item_steps;
CREATE TRIGGER auction_plan_item_steps_guard
  BEFORE INSERT OR UPDATE ON public.auction_plan_item_steps
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_item_steps_guard();

-- ── 8.5 Mốc đã đóng băng: BẤT BIẾN ──────────────────────────────────────────
-- Cùng luật với báo cáo định kỳ đã chốt. Cột FK được về NULL (ON DELETE SET
-- NULL của profiles / workspace_branches) — guard chặn mọi thay đổi khác; nếu
-- chặn cả NULL thì xoá tài khoản sẽ bị khoá (bẫy 2026-09-26 P11).
CREATE OR REPLACE FUNCTION public.auction_plan_baselines_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c_fk CONSTANT TEXT[] := ARRAY['approved_by', 'branch_id'];
BEGIN
  IF (to_jsonb(NEW) - c_fk) IS DISTINCT FROM (to_jsonb(OLD) - c_fk)
     OR (NEW.approved_by IS NOT NULL AND NEW.approved_by IS DISTINCT FROM OLD.approved_by)
     OR (NEW.branch_id   IS NOT NULL AND NEW.branch_id   IS DISTINCT FROM OLD.branch_id) THEN
    RAISE EXCEPTION 'Mốc kế hoạch đã đóng băng không thể sửa';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_baselines_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plan_baselines_guard ON public.auction_plan_baselines;
CREATE TRIGGER auction_plan_baselines_guard
  BEFORE UPDATE ON public.auction_plan_baselines
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_baselines_guard();

-- ── 8.6 updated_at ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS auction_plan_cycles_updated_at ON public.auction_plan_cycles;
CREATE TRIGGER auction_plan_cycles_updated_at
  BEFORE UPDATE ON public.auction_plan_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS auction_plan_cycle_units_updated_at ON public.auction_plan_cycle_units;
CREATE TRIGGER auction_plan_cycle_units_updated_at
  BEFORE UPDATE ON public.auction_plan_cycle_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS auction_plans_updated_at ON public.auction_plans;
CREATE TRIGGER auction_plans_updated_at
  BEFORE UPDATE ON public.auction_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS auction_plan_items_updated_at ON public.auction_plan_items;
CREATE TRIGGER auction_plan_items_updated_at
  BEFORE UPDATE ON public.auction_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS auction_plan_item_steps_updated_at ON public.auction_plan_item_steps;
CREATE TRIGGER auction_plan_item_steps_updated_at
  BEFORE UPDATE ON public.auction_plan_item_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 8.7 Nhật ký hoạt động (module 'ke-hoach') ───────────────────────────────
-- Trigger RIÊNG, không sửa `owner_audit_row` dùng chung: hàm đó dài ~200 dòng
-- và việc dựng lại nó từ một bản chép là đúng cái bẫy đã làm rơi `so-hoa:share`
-- (common-pitfalls.md 2026-10-01). Hành vi giống hệt vì vẫn gọi
-- owner_audit_diff / owner_audit_enrich / owner_audit_write (gộp 10 phút, lọc
-- khoá rác). Mỗi lần chuyển trạng thái, các RPC còn tự ghi thêm một dòng.
CREATE OR REPLACE FUNCTION public.auction_plan_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new     JSONB;
  _old     JSONB;
  _r       JSONB;
  _action  TEXT := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  _changes JSONB;
  _label   TEXT;
  _meta    JSONB := '{}'::JSONB;
  _plan    public.auction_plans%ROWTYPE;
BEGIN
  IF TG_OP <> 'DELETE' THEN _new := to_jsonb(NEW); END IF;
  IF TG_OP <> 'INSERT' THEN _old := to_jsonb(OLD); END IF;
  _r := COALESCE(_new, _old);

  _changes := public.owner_audit_diff(_old, _new);
  IF TG_OP = 'UPDATE' AND _changes = '{}'::JSONB THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'auction_plans' THEN
    _label := COALESCE(NULLIF(_r ->> 'title', ''),
                       'Kế hoạch đấu giá năm ' || (_r ->> 'plan_year'));
    _meta := jsonb_build_object('plan_id', _r ->> 'id');
  ELSE
    SELECT * INTO _plan FROM public.auction_plans WHERE id = (_r ->> 'plan_id')::UUID;
    IF NOT FOUND THEN RETURN NULL; END IF;   -- xoá dây chuyền: dòng của kế hoạch đã đủ
    _label := concat_ws(' · ',
                        COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch ' || _plan.plan_year::TEXT),
                        COALESCE(_r ->> 'item_code', _r ->> 'step'));
    _meta := jsonb_strip_nulls(jsonb_build_object(
               'plan_id', _r ->> 'plan_id',
               'item_id', CASE WHEN TG_TABLE_NAME = 'auction_plan_item_steps' THEN _r ->> 'item_id' END,
               'posting_id', _r ->> 'asset_posting_id',
               'listing_id', _r ->> 'listing_id'));
  END IF;

  PERFORM public.owner_audit_write((_r ->> 'workspace_id')::UUID, NULL, (_r ->> 'branch_id')::UUID,
                                   'ke-hoach', _action, TG_TABLE_NAME, _r ->> 'id', _label,
                                   public.owner_audit_enrich(_changes), _meta, NULL);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Nhật ký KHÔNG BAO GIỜ được chặn một lần ghi nghiệp vụ.
  RAISE WARNING 'auction_plan_audit_row(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_audit_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auction_plans_audit ON public.auction_plans;
CREATE TRIGGER auction_plans_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.auction_plans
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_audit_row();

DROP TRIGGER IF EXISTS auction_plan_items_audit ON public.auction_plan_items;
CREATE TRIGGER auction_plan_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.auction_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_audit_row();

DROP TRIGGER IF EXISTS auction_plan_item_steps_audit ON public.auction_plan_item_steps;
CREATE TRIGGER auction_plan_item_steps_audit
  AFTER UPDATE ON public.auction_plan_item_steps
  FOR EACH ROW EXECUTE FUNCTION public.auction_plan_audit_row();

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. "AI Ở TRÊN TÔI" + CỔNG ĐỌC
-- ═════════════════════════════════════════════════════════════════════════════

-- Bản thật của `auction_plan_reviewer_ok` (A2). CHỈ hàm này và các RPC duyệt
-- biết tới ngoại lệ hình B — `owner_ws_has` vẫn trả false cho người của Trạm cha.
CREATE OR REPLACE FUNCTION public.auction_plan_reviewer_ok(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.auction_plans p
      LEFT JOIN public.asset_owner_workspaces w ON w.id = p.workspace_id
     WHERE p.id = p_plan_id
       AND (
         -- hình A: cùng Trạm, có approve, KHÔNG bị giới hạn chi nhánh
         public.auction_plan_can_approve(p.workspace_id)
         -- hình B: thành viên đang hoạt động của Trạm CHA, có approve
         OR (w.parent_workspace_id IS NOT NULL
             AND public.auction_plan_can_approve(w.parent_workspace_id))
       )
  )
$$;

COMMENT ON FUNCTION public.auction_plan_reviewer_ok(UUID) IS
  'Người đang đăng nhập có quyền TRẢ LẠI / GHI NHẬN PHÊ DUYỆT kế hoạch này (A2). Hình A = cùng Trạm + ke-hoach:approve + không giới hạn chi nhánh; hình B = thành viên Trạm CHA có approve. Ngoại lệ hẹp với luật Phase 14 "trụ sở chỉ đọc" — chỉ dùng trong RPC duyệt, KHÔNG đưa vào owner_ws_has.';

REVOKE ALL ON FUNCTION public.auction_plan_reviewer_ok(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_reviewer_ok(UUID) TO authenticated;

-- Cổng ĐỌC của mọi bảng kế hoạch. Khác `owner_ws_can(ws,'read')` một điểm có
-- chủ đích: thành viên bị GIỚI HẠN CHI NHÁNH chỉ đọc kế hoạch của chi nhánh
-- mình. Dữ liệu kế hoạch của một xã không phải việc của xã bên cạnh (tiêu chí
-- nghiệm thu của Phase 2). Trưởng đơn vị, thành viên không giới hạn và trụ sở
-- liên kết (không phải thành viên trực tiếp) không bị ảnh hưởng.
CREATE OR REPLACE FUNCTION public.auction_plan_read_ok(p_workspace_id UUID, p_branch_id UUID, p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (public.owner_ws_can(p_workspace_id, 'read')
          AND (public.owner_ws_role(p_workspace_id) IS NULL
               OR public.owner_ws_branch_ok(p_workspace_id, p_branch_id)))
      OR public.auction_plan_reviewer_ok(p_plan_id)
$$;

COMMENT ON FUNCTION public.auction_plan_read_ok(UUID, UUID, UUID) IS
  'Đọc kế hoạch / tài sản / mốc: thành viên Trạm (bị giới hạn chi nhánh thì chỉ chi nhánh mình), trụ sở đã liên kết, hoặc người duyệt.';

REVOKE ALL ON FUNCTION public.auction_plan_read_ok(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_read_ok(UUID, UUID, UUID) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. RLS
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.auction_plan_cycles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_plan_cycle_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_plan_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_plan_item_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_plan_baselines   ENABLE ROW LEVEL SECURITY;

-- ── Đợt: đọc cho thành viên Trạm tỉnh VÀ cho các xã có tên trong đợt. Không có
-- policy GHI — chỉ RPC (DEFINER) tạo / sửa.
DROP POLICY IF EXISTS auction_plan_cycles_read ON public.auction_plan_cycles;
CREATE POLICY auction_plan_cycles_read ON public.auction_plan_cycles
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read')
         OR EXISTS (SELECT 1 FROM public.auction_plan_cycle_units u
                     WHERE u.cycle_id = auction_plan_cycles.id
                       AND u.child_workspace_id IS NOT NULL
                       AND public.owner_ws_can(u.child_workspace_id, 'read')));

DROP POLICY IF EXISTS auction_plan_cycle_units_read ON public.auction_plan_cycle_units;
CREATE POLICY auction_plan_cycle_units_read ON public.auction_plan_cycle_units
  FOR SELECT TO authenticated
  USING ((public.owner_ws_can(workspace_id, 'read')
          AND (public.owner_ws_role(workspace_id) IS NULL
               OR public.owner_ws_branch_ok(workspace_id, branch_id)))
         OR (child_workspace_id IS NOT NULL AND public.owner_ws_can(child_workspace_id, 'read')));

-- ── Kế hoạch
DROP POLICY IF EXISTS auction_plans_read ON public.auction_plans;
CREATE POLICY auction_plans_read ON public.auction_plans
  FOR SELECT TO authenticated
  USING (public.auction_plan_read_ok(workspace_id, branch_id, id));

DROP POLICY IF EXISTS auction_plans_insert ON public.auction_plans;
CREATE POLICY auction_plans_insert ON public.auction_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'create', branch_id));

DROP POLICY IF EXISTS auction_plans_update ON public.auction_plans;
CREATE POLICY auction_plans_update ON public.auction_plans
  FOR UPDATE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id))
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id));

DROP POLICY IF EXISTS auction_plans_delete ON public.auction_plans;
CREATE POLICY auction_plans_delete ON public.auction_plans
  FOR DELETE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'delete', branch_id));

-- ── Tài sản trong kế hoạch (workspace_id / branch_id do trigger ép ⇒ RLS khỏi join)
DROP POLICY IF EXISTS auction_plan_items_read ON public.auction_plan_items;
CREATE POLICY auction_plan_items_read ON public.auction_plan_items
  FOR SELECT TO authenticated
  USING (public.auction_plan_read_ok(workspace_id, branch_id, plan_id));

DROP POLICY IF EXISTS auction_plan_items_insert ON public.auction_plan_items;
CREATE POLICY auction_plan_items_insert ON public.auction_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'create', branch_id)
              OR public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id));

DROP POLICY IF EXISTS auction_plan_items_update ON public.auction_plan_items;
CREATE POLICY auction_plan_items_update ON public.auction_plan_items
  FOR UPDATE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id))
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id));

DROP POLICY IF EXISTS auction_plan_items_delete ON public.auction_plan_items;
CREATE POLICY auction_plan_items_delete ON public.auction_plan_items
  FOR DELETE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'delete', branch_id));

-- ── Mốc công việc
DROP POLICY IF EXISTS auction_plan_item_steps_read ON public.auction_plan_item_steps;
CREATE POLICY auction_plan_item_steps_read ON public.auction_plan_item_steps
  FOR SELECT TO authenticated
  USING (public.auction_plan_read_ok(workspace_id, branch_id, plan_id));

DROP POLICY IF EXISTS auction_plan_item_steps_insert ON public.auction_plan_item_steps;
CREATE POLICY auction_plan_item_steps_insert ON public.auction_plan_item_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id));

DROP POLICY IF EXISTS auction_plan_item_steps_update ON public.auction_plan_item_steps;
CREATE POLICY auction_plan_item_steps_update ON public.auction_plan_item_steps
  FOR UPDATE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id))
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'update', branch_id));

DROP POLICY IF EXISTS auction_plan_item_steps_delete ON public.auction_plan_item_steps;
CREATE POLICY auction_plan_item_steps_delete ON public.auction_plan_item_steps
  FOR DELETE TO authenticated
  USING (public.owner_ws_has_in(workspace_id, 'ke-hoach', 'delete', branch_id));

-- ── Mốc đã đóng băng: chỉ ĐỌC. Ghi chỉ qua RPC ghi nhận phê duyệt.
DROP POLICY IF EXISTS auction_plan_baselines_read ON public.auction_plan_baselines;
CREATE POLICY auction_plan_baselines_read ON public.auction_plan_baselines
  FOR SELECT TO authenticated
  USING (public.auction_plan_read_ok(workspace_id, branch_id, plan_id));

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. QUYỀN BẢNG / CỘT
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚠️ Supabase có ALTER DEFAULT PRIVILEGES cấp ALL cho anon + authenticated trên
-- MỌI bảng mới trong schema public. Phải thu hồi SẠCH trước rồi cấp lại đúng
-- cột — nếu không, quyền cột ở dưới là vô nghĩa (đã bắt được ở bước tự kiểm).
REVOKE ALL ON public.auction_plan_cycles,
              public.auction_plan_cycle_units,
              public.auction_plans,
              public.auction_plan_items,
              public.auction_plan_item_steps,
              public.auction_plan_baselines
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.auction_plan_cycles,
                public.auction_plan_cycle_units,
                public.auction_plans,
                public.auction_plan_items,
                public.auction_plan_item_steps,
                public.auction_plan_baselines
  TO authenticated;

-- Đợt + mốc đóng băng: KHÔNG có quyền ghi cho client (RPC làm hết).

-- Kế hoạch: quyền GHI theo CỘT. Trạng thái, số bản mốc, cột quyết định và dấu
-- thời gian chuyển bước chỉ RPC đặt. ⚠️ Client gửi THÊM bất kỳ cột nào ngoài
-- danh sách này sẽ nhận "permission denied for table auction_plans" — lỗi nhắc
-- BẢNG chứ không nhắc cột (bẫy 2026-09-26 P10).
GRANT INSERT (workspace_id, branch_id, admin_unit_code, cycle_id, plan_year, kind, title, level,
              legal_basis, notes)
  ON public.auction_plans TO authenticated;
GRANT UPDATE (branch_id, admin_unit_code, cycle_id, plan_year, kind, title, level,
              legal_basis, notes)
  ON public.auction_plans TO authenticated;
GRANT DELETE ON public.auction_plans TO authenticated;

-- Tài sản: mọi cột nghiệp vụ ghi được; workspace_id / branch_id / admin_unit_code
-- do trigger ép nên KHÔNG cấp (client gửi kèm là lỗi quyền — đúng ý: cha quyết định).
GRANT INSERT (plan_id, asset_type, title, lot_labels, lot_count, map_sheet, parcel_no, location,
              area_m2, land_use_code, allocation_form, unit_start_price, expected_start_value,
              planned_month, planned_method, executing_unit,
              forecast_month, forecast_reason, responsible_user_id, asset_posting_id, listing_id,
              exec_status, exec_note)
  ON public.auction_plan_items TO authenticated;
GRANT UPDATE (asset_type, title, lot_labels, lot_count, map_sheet, parcel_no, location,
              area_m2, land_use_code, allocation_form, unit_start_price, expected_start_value,
              planned_month, planned_method, executing_unit,
              forecast_month, forecast_reason, responsible_user_id, asset_posting_id, listing_id,
              exec_status, exec_note)
  ON public.auction_plan_items TO authenticated;
GRANT DELETE ON public.auction_plan_items TO authenticated;

-- `source` KHÔNG cấp cho client: nhãn "Sàn xác nhận" là lời của SÀN, chỉ hàm
-- dò mốc tự động (Phase 5) được đặt. Client ghi tay luôn là source='manual'.
GRANT INSERT (item_id, step, sort_order, planned_date, done_on, doc_no, doc_date, evidence_urls, note)
  ON public.auction_plan_item_steps TO authenticated;
GRANT UPDATE (sort_order, planned_date, done_on, doc_no, doc_date, evidence_urls, note)
  ON public.auction_plan_item_steps TO authenticated;
GRANT DELETE ON public.auction_plan_item_steps TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. RPC LUỒNG DUYỆT
-- ═════════════════════════════════════════════════════════════════════════════
-- Mọi RPC trả `{ok:false, reason:…}` cho thất bại DỰ KIẾN (sai trạng thái, thiếu
-- quyền, chưa có tài sản) thay vì RAISE — đúng hợp đồng của `assertRpcOk`
-- (src/lib/consignment/errors.ts): Supabase coi đó là thành công, client PHẢI
-- gọi assert. Thành công trả `{ok:true, …}`.

-- Trợ thủ nội bộ: tổng theo tháng / quý của các tài sản còn hiệu lực.
CREATE OR REPLACE FUNCTION public.auction_plan_baseline_payload(p_plan_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan', (SELECT jsonb_build_object(
                      'id', p.id, 'plan_year', p.plan_year, 'kind', p.kind, 'level', p.level,
                      'title', p.title, 'admin_unit_code', p.admin_unit_code,
                      'branch_id', p.branch_id, 'cycle_id', p.cycle_id,
                      'legal_basis', p.legal_basis)
               FROM public.auction_plans p WHERE p.id = p_plan_id),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'id', i.id, 'seq', i.seq, 'item_code', i.item_code,
                         'asset_type', i.asset_type, 'title', i.title,
                         'lot_labels', i.lot_labels, 'lot_count', i.lot_count,
                         'map_sheet', i.map_sheet, 'parcel_no', i.parcel_no,
                         'location', i.location, 'area_m2', i.area_m2,
                         'land_use_code', i.land_use_code, 'allocation_form', i.allocation_form,
                         'unit_start_price', i.unit_start_price,
                         'expected_start_value', i.expected_start_value,
                         'planned_month', i.planned_month, 'planned_method', i.planned_method,
                         'executing_unit', i.executing_unit) ORDER BY i.seq)
                       FROM public.auction_plan_items i
                      WHERE i.plan_id = p_plan_id AND i.exec_status = 'active'), '[]'::JSONB),
    'totals', (SELECT jsonb_build_object(
                        'item_count', COUNT(*),
                        'area_total', COALESCE(SUM(i.area_m2), 0),
                        'expected_total', COALESCE(SUM(i.expected_start_value), 0),
                        'by_month', COALESCE((SELECT jsonb_object_agg(to_char(m.planned_month, 'YYYY-MM'), m.agg)
                                                FROM (SELECT x.planned_month,
                                                             jsonb_build_object('count', COUNT(*),
                                                                                'expected', COALESCE(SUM(x.expected_start_value), 0)) AS agg
                                                        FROM public.auction_plan_items x
                                                       WHERE x.plan_id = p_plan_id AND x.exec_status = 'active'
                                                         AND x.planned_month IS NOT NULL
                                                       GROUP BY x.planned_month) m), '{}'::JSONB),
                        'by_quarter', COALESCE((SELECT jsonb_object_agg(q.k, q.agg)
                                                  FROM (SELECT to_char(x.planned_month, 'YYYY') || '-Q'
                                                               || EXTRACT(QUARTER FROM x.planned_month)::TEXT AS k,
                                                               jsonb_build_object('count', COUNT(*),
                                                                                  'expected', COALESCE(SUM(x.expected_start_value), 0)) AS agg
                                                          FROM public.auction_plan_items x
                                                         WHERE x.plan_id = p_plan_id AND x.exec_status = 'active'
                                                           AND x.planned_month IS NOT NULL
                                                         GROUP BY 1) q), '{}'::JSONB))
                 FROM public.auction_plan_items i
                WHERE i.plan_id = p_plan_id AND i.exec_status = 'active'),
    'frozen_at', to_jsonb(now())
  )
$$;

REVOKE ALL ON FUNCTION public.auction_plan_baseline_payload(UUID) FROM PUBLIC, anon, authenticated;

-- So sánh hiện trạng với bản mốc mới nhất — luật D4 / A4.6.
CREATE OR REPLACE FUNCTION public.auction_plan_baseline_diff(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base JSONB;
  v_out  JSONB;
BEGIN
  SELECT b.payload -> 'items' INTO v_base
    FROM public.auction_plan_baselines b
   WHERE b.plan_id = p_plan_id
   ORDER BY b.version DESC
   LIMIT 1;
  IF v_base IS NULL THEN
    RETURN jsonb_build_object('baseline', false);
  END IF;

  WITH base AS (
    SELECT e ->> 'item_code' AS code,
           (e ->> 'planned_month')::DATE AS planned_month,
           NULLIF(e ->> 'expected_start_value', '')::NUMERIC AS expected
      FROM jsonb_array_elements(v_base) e
  ), cur AS (
    SELECT i.item_code AS code, i.planned_month, i.expected_start_value AS expected
      FROM public.auction_plan_items i
     WHERE i.plan_id = p_plan_id AND i.exec_status = 'active'
  )
  SELECT jsonb_build_object(
           'baseline', true,
           'added',   COALESCE((SELECT jsonb_agg(c.code ORDER BY c.code) FROM cur c
                                 WHERE NOT EXISTS (SELECT 1 FROM base b WHERE b.code = c.code)), '[]'::JSONB),
           'dropped', COALESCE((SELECT jsonb_agg(b.code ORDER BY b.code) FROM base b
                                 WHERE NOT EXISTS (SELECT 1 FROM cur c WHERE c.code = b.code)), '[]'::JSONB),
           'moved_quarter', COALESCE((SELECT jsonb_agg(c.code ORDER BY c.code)
                                        FROM cur c JOIN base b ON b.code = c.code
                                       WHERE date_trunc('quarter', c.planned_month)
                                             IS DISTINCT FROM date_trunc('quarter', b.planned_month)), '[]'::JSONB),
           'value_shift', COALESCE((SELECT jsonb_agg(c.code ORDER BY c.code)
                                      FROM cur c JOIN base b ON b.code = c.code
                                     WHERE b.expected IS NOT NULL AND b.expected > 0
                                       AND abs(COALESCE(c.expected, 0) - b.expected) > b.expected * 0.1), '[]'::JSONB))
    INTO v_out;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_baseline_diff(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_baseline_diff(UUID) TO authenticated;

-- ── 12.1 Trình kế hoạch / trình điều chỉnh ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_plan_submit(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _plan   public.auction_plans%ROWTYPE;
  _n      INT;
  _missing TEXT[];
  _diff   JSONB := NULL;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.owner_ws_has_in(_plan.workspace_id, 'ke-hoach', 'finalize', _plan.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _plan.status NOT IN ('draft', 'adjusting') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;

  SELECT COUNT(*) INTO _n FROM public.auction_plan_items i
   WHERE i.plan_id = p_plan_id AND i.exec_status = 'active';
  IF _n = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_items'); END IF;

  SELECT COALESCE(array_agg(i.item_code ORDER BY i.seq), '{}') INTO _missing
    FROM public.auction_plan_items i
   WHERE i.plan_id = p_plan_id AND i.exec_status = 'active' AND i.planned_month IS NULL;
  IF array_length(_missing, 1) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'items_without_month', 'items', to_jsonb(_missing));
  END IF;

  -- Trình ĐIỀU CHỈNH: báo rõ tài sản nào đổi mốc so với bản đã duyệt (luật D4).
  IF _plan.status = 'adjusting' THEN
    _diff := public.auction_plan_baseline_diff(p_plan_id);
  END IF;

  PERFORM set_config('auction_plan.rpc', 'on', true);
  UPDATE public.auction_plans
     SET status = 'submitted', submitted_at = now(), submitted_by = _uid, review_comment = NULL
   WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.rpc', 'off', true);

  PERFORM public.owner_audit_write(_plan.workspace_id, NULL, _plan.branch_id, 'ke-hoach', 'update',
            'auction_plans', p_plan_id::TEXT,
            COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch đấu giá năm ' || _plan.plan_year::TEXT),
            jsonb_build_object('status', jsonb_build_array(_plan.status, 'submitted')),
            jsonb_strip_nulls(jsonb_build_object('plan_id', p_plan_id, 'item_count', _n, 'changes', _diff)),
            NULL);

  RETURN jsonb_strip_nulls(jsonb_build_object('ok', true, 'status', 'submitted', 'item_count', _n,
                                              'adjustment', _plan.status = 'adjusting', 'changes', _diff));
END;
$$;

-- ── 12.2 Trả lại ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_plan_return(p_plan_id UUID, p_comment TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _plan public.auction_plans%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.auction_plan_reviewer_ok(p_plan_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_reviewer');
  END IF;
  IF _plan.status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;
  IF p_comment IS NULL OR char_length(btrim(p_comment)) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  PERFORM set_config('auction_plan.rpc', 'on', true);
  UPDATE public.auction_plans
     SET status = 'returned', reviewed_at = now(), reviewed_by = _uid,
         review_comment = left(btrim(p_comment), 2000)
   WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.rpc', 'off', true);

  PERFORM public.owner_audit_write(_plan.workspace_id, NULL, _plan.branch_id, 'ke-hoach', 'update',
            'auction_plans', p_plan_id::TEXT,
            COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch đấu giá năm ' || _plan.plan_year::TEXT),
            jsonb_build_object('status', jsonb_build_array('submitted', 'returned'),
                               'review_comment', jsonb_build_array(NULL, left(btrim(p_comment), 300))),
            jsonb_build_object('plan_id', p_plan_id), NULL);

  RETURN jsonb_build_object('ok', true, 'status', 'returned');
END;
$$;

-- ── 12.3 Ghi nhận phê duyệt (đóng băng mốc) ─────────────────────────────────
-- D5: app chỉ GHI NHẬN quyết định đã ký ngoài ứng dụng (số, ngày, tệp).
CREATE OR REPLACE FUNCTION public.auction_plan_record_approval(
  p_plan_id UUID, p_doc_no TEXT, p_doc_date DATE, p_doc_urls TEXT[] DEFAULT '{}')
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid     UUID := auth.uid();
  _plan    public.auction_plans%ROWTYPE;
  _urls    TEXT[] := COALESCE(p_doc_urls, '{}');
  _prefix  TEXT;
  _path    TEXT;
  _payload JSONB;
  _version INT;
  _diff    JSONB;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.auction_plan_reviewer_ok(p_plan_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_reviewer');
  END IF;
  IF _plan.status <> 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;
  IF p_doc_no IS NULL OR btrim(p_doc_no) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'doc_no_required');
  END IF;
  IF p_doc_date IS NULL OR p_doc_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_doc_date');
  END IF;

  -- Tệp quyết định phải nằm đúng thư mục của kế hoạch VÀ tồn tại thật.
  _prefix := _plan.workspace_id::TEXT || '/' || p_plan_id::TEXT || '/';
  FOREACH _path IN ARRAY _urls LOOP
    IF left(_path, length(_prefix)) <> _prefix
       OR NOT EXISTS (SELECT 1 FROM storage.objects o
                       WHERE o.bucket_id = 'auction-plan-docs' AND o.name = _path) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path', 'path', _path);
    END IF;
  END LOOP;

  _diff    := public.auction_plan_baseline_diff(p_plan_id);
  _payload := public.auction_plan_baseline_payload(p_plan_id);
  _version := _plan.baseline_version + 1;

  INSERT INTO public.auction_plan_baselines (
    plan_id, workspace_id, branch_id, version, approved_at, approved_by,
    approval_doc_no, approval_doc_date, approval_doc_urls, payload)
  VALUES (p_plan_id, _plan.workspace_id, _plan.branch_id, _version, now(), _uid,
          btrim(p_doc_no), p_doc_date, _urls, _payload);

  PERFORM set_config('auction_plan.rpc', 'on', true);
  UPDATE public.auction_plans
     SET status = 'approved', baseline_version = _version,
         approval_doc_no = btrim(p_doc_no), approval_doc_date = p_doc_date, approval_doc_urls = _urls,
         reviewed_at = now(), reviewed_by = _uid, review_comment = NULL
   WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.rpc', 'off', true);

  PERFORM public.owner_audit_write(_plan.workspace_id, NULL, _plan.branch_id, 'ke-hoach', 'update',
            'auction_plans', p_plan_id::TEXT,
            COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch đấu giá năm ' || _plan.plan_year::TEXT),
            jsonb_build_object('status', jsonb_build_array('submitted', 'approved'),
                               'baseline_version', jsonb_build_array(_plan.baseline_version, _version),
                               'approval_doc_no', jsonb_build_array(_plan.approval_doc_no, btrim(p_doc_no))),
            jsonb_strip_nulls(jsonb_build_object('plan_id', p_plan_id, 'version', _version, 'changes', _diff)),
            NULL);

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'version', _version,
                            'item_count', _payload #> '{totals,item_count}',
                            'expected_total', _payload #> '{totals,expected_total}');
END;
$$;

-- ── 12.4 Mở điều chỉnh ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_plan_start_adjustment(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _plan public.auction_plans%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.owner_ws_has_in(_plan.workspace_id, 'ke-hoach', 'finalize', _plan.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _plan.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;

  PERFORM set_config('auction_plan.rpc', 'on', true);
  UPDATE public.auction_plans SET status = 'adjusting' WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.rpc', 'off', true);

  PERFORM public.owner_audit_write(_plan.workspace_id, NULL, _plan.branch_id, 'ke-hoach', 'update',
            'auction_plans', p_plan_id::TEXT,
            COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch đấu giá năm ' || _plan.plan_year::TEXT),
            jsonb_build_object('status', jsonb_build_array('approved', 'adjusting')),
            jsonb_build_object('plan_id', p_plan_id, 'baseline_version', _plan.baseline_version), NULL);

  RETURN jsonb_build_object('ok', true, 'status', 'adjusting', 'baseline_version', _plan.baseline_version);
END;
$$;

-- ── 12.5 Đóng kế hoạch ──────────────────────────────────────────────────────
-- Cùng cổng với phê duyệt: đóng một kế hoạch đã duyệt là việc của cấp duyệt.
CREATE OR REPLACE FUNCTION public.auction_plan_close(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _plan public.auction_plans%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO _plan FROM public.auction_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.auction_plan_reviewer_ok(p_plan_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_reviewer');
  END IF;
  IF _plan.status NOT IN ('approved', 'adjusting') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _plan.status);
  END IF;

  PERFORM set_config('auction_plan.rpc', 'on', true);
  UPDATE public.auction_plans SET status = 'closed' WHERE id = p_plan_id;
  PERFORM set_config('auction_plan.rpc', 'off', true);

  PERFORM public.owner_audit_write(_plan.workspace_id, NULL, _plan.branch_id, 'ke-hoach', 'update',
            'auction_plans', p_plan_id::TEXT,
            COALESCE(NULLIF(_plan.title, ''), 'Kế hoạch đấu giá năm ' || _plan.plan_year::TEXT),
            jsonb_build_object('status', jsonb_build_array(_plan.status, 'closed')),
            jsonb_build_object('plan_id', p_plan_id), NULL);

  RETURN jsonb_build_object('ok', true, 'status', 'closed');
END;
$$;

-- ── 12.6 Đợt lập kế hoạch ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auction_plan_cycle_open(
  p_workspace_id UUID, p_plan_year INT, p_kind TEXT DEFAULT 'annual',
  p_submit_deadline DATE DEFAULT NULL, p_instructions TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _id    UUID;
  _stat  TEXT;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.auction_plan_can_approve(p_workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('annual', 'supplement') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  IF p_plan_year IS NULL OR p_plan_year < 2020 OR p_plan_year > 2100 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_year');
  END IF;

  SELECT c.id, c.status INTO _id, _stat
    FROM public.auction_plan_cycles c
   WHERE c.workspace_id = p_workspace_id AND c.plan_year = p_plan_year AND c.kind = p_kind;

  IF _id IS NOT NULL AND _stat = 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_open', 'cycle_id', _id);
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.auction_plan_cycles (workspace_id, plan_year, kind, status,
                                            submit_deadline, instructions, created_by)
    VALUES (p_workspace_id, p_plan_year, p_kind, 'open', p_submit_deadline, p_instructions, _uid)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.auction_plan_cycles
       SET status = 'open', closed_at = NULL,
           submit_deadline = COALESCE(p_submit_deadline, submit_deadline),
           instructions = COALESCE(p_instructions, instructions)
     WHERE id = _id;
  END IF;

  PERFORM public.owner_audit_write(p_workspace_id, NULL, NULL, 'ke-hoach',
            CASE WHEN _stat IS NULL THEN 'create' ELSE 'update' END,
            'auction_plan_cycles', _id::TEXT,
            'Đợt lập kế hoạch năm ' || p_plan_year::TEXT,
            jsonb_build_object('status', jsonb_build_array(_stat, 'open')),
            jsonb_build_object('cycle_id', _id), NULL);

  RETURN jsonb_build_object('ok', true, 'cycle_id', _id, 'status', 'open');
END;
$$;

CREATE OR REPLACE FUNCTION public.auction_plan_cycle_close(p_cycle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _cycle public.auction_plan_cycles%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO _cycle FROM public.auction_plan_cycles WHERE id = p_cycle_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.auction_plan_can_approve(_cycle.workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _cycle.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', _cycle.status);
  END IF;

  UPDATE public.auction_plan_cycles SET status = 'closed', closed_at = now() WHERE id = p_cycle_id;

  PERFORM public.owner_audit_write(_cycle.workspace_id, NULL, NULL, 'ke-hoach', 'update',
            'auction_plan_cycles', p_cycle_id::TEXT,
            'Đợt lập kế hoạch năm ' || _cycle.plan_year::TEXT,
            jsonb_build_object('status', jsonb_build_array('open', 'closed')),
            jsonb_build_object('cycle_id', p_cycle_id), NULL);

  RETURN jsonb_build_object('ok', true, 'status', 'closed');
END;
$$;

-- Giao danh sách xã + chỉ tiêu cho đợt. THAY TOÀN BỘ danh sách trong một giao
-- dịch (giống owner_save_target với các tiêu chí).
CREATE OR REPLACE FUNCTION public.auction_plan_cycle_set_units(p_cycle_id UUID, p_units JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _cycle public.auction_plan_cycles%ROWTYPE;
  _n     INT;
  _bad   TEXT;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO _cycle FROM public.auction_plan_cycles WHERE id = p_cycle_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.auction_plan_can_approve(_cycle.workspace_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _cycle.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cycle_closed');
  END IF;
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_units) e WHERE jsonb_typeof(e) <> 'object') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_unit');
  END IF;

  -- Mã ĐVHC phải có trong danh mục và không trùng trong cùng một lần gửi.
  SELECT q.admin_unit_code INTO _bad
    FROM jsonb_to_recordset(p_units) AS q(admin_unit_code TEXT)
   WHERE q.admin_unit_code IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.admin_units a WHERE a.code = q.admin_unit_code)
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_unit', 'admin_unit_code', _bad);
  END IF;
  IF (SELECT COUNT(DISTINCT q.admin_unit_code) FROM jsonb_to_recordset(p_units) AS q(admin_unit_code TEXT))
     <> jsonb_array_length(p_units) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_unit');
  END IF;

  DELETE FROM public.auction_plan_cycle_units WHERE cycle_id = p_cycle_id;
  INSERT INTO public.auction_plan_cycle_units
    (cycle_id, workspace_id, admin_unit_code, branch_id, child_workspace_id, assigned_revenue, assigned_count)
  SELECT p_cycle_id, _cycle.workspace_id, q.admin_unit_code, q.branch_id, q.child_workspace_id,
         q.assigned_revenue, q.assigned_count
    FROM jsonb_to_recordset(p_units)
         AS q(admin_unit_code TEXT, branch_id UUID, child_workspace_id UUID,
              assigned_revenue NUMERIC, assigned_count INT);
  GET DIAGNOSTICS _n = ROW_COUNT;

  UPDATE public.auction_plan_cycles SET updated_at = now() WHERE id = p_cycle_id;

  PERFORM public.owner_audit_write(_cycle.workspace_id, NULL, NULL, 'ke-hoach', 'update',
            'auction_plan_cycles', p_cycle_id::TEXT,
            'Đợt lập kế hoạch năm ' || _cycle.plan_year::TEXT,
            jsonb_build_object('units', jsonb_build_array(NULL, _n)),
            jsonb_build_object('cycle_id', p_cycle_id), NULL);

  RETURN jsonb_build_object('ok', true, 'count', _n);
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_unit');
  WHEN raise_exception THEN
    -- guard của bảng con: chi nhánh / Trạm con không thuộc đợt này
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope', 'detail', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_submit(UUID)                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_return(UUID, TEXT)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_record_approval(UUID, TEXT, DATE, TEXT[])  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_start_adjustment(UUID)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_close(UUID)                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_cycle_open(UUID, INT, TEXT, DATE, TEXT)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_cycle_close(UUID)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auction_plan_cycle_set_units(UUID, JSONB)               FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.auction_plan_submit(UUID)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_return(UUID, TEXT)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_record_approval(UUID, TEXT, DATE, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_start_adjustment(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_close(UUID)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_cycle_open(UUID, INT, TEXT, DATE, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_cycle_close(UUID)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_plan_cycle_set_units(UUID, JSONB)              TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 13. BUCKET TỆP KẾ HOẠCH (private)
-- ═════════════════════════════════════════════════════════════════════════════
-- Đường dẫn:
--   {workspace_id}/{plan_id}/…        tệp của một kế hoạch (quyết định phê duyệt, phụ lục)
--   {workspace_id}/dot/{cycle_id}/…   tệp hướng dẫn của một ĐỢT lập kế hoạch
-- Kiểm CẢ hai segment đầu: nếu chỉ kiểm segment 1 thì thành viên Trạm A ghi được
-- vào thư mục của kế hoạch khác trong cùng Trạm mà họ không được đụng.
-- Thứ tự ghi: tạo kế hoạch → tải tệp → gọi RPC ghi nhận phê duyệt với đường dẫn.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('auction-plan-docs', 'auction-plan-docs', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- _action: 'read' | 'write'. Đường dẫn rác ⇒ false, không ném lỗi.
CREATE OR REPLACE FUNCTION public.auction_plan_doc_ok(_name TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws     UUID;
  v_seg2   TEXT := split_part(_name, '/', 2);
  v_plan   public.auction_plans%ROWTYPE;
  v_cycle  public.auction_plan_cycles%ROWTYPE;
BEGIN
  BEGIN
    v_ws := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  -- Thư mục của một ĐỢT: {ws}/dot/{cycle_id}/…
  IF v_seg2 = 'dot' THEN
    BEGIN
      SELECT * INTO v_cycle FROM public.auction_plan_cycles
       WHERE id = split_part(_name, '/', 3)::uuid AND workspace_id = v_ws;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;
    IF v_cycle.id IS NULL THEN RETURN false; END IF;
    IF _action = 'read'  THEN RETURN public.owner_ws_can(v_ws, 'read'); END IF;
    IF _action = 'write' THEN RETURN public.auction_plan_can_approve(v_ws); END IF;
    RETURN false;
  END IF;

  -- Thư mục của một KẾ HOẠCH: {ws}/{plan_id}/…
  BEGIN
    SELECT * INTO v_plan FROM public.auction_plans
     WHERE id = v_seg2::uuid AND workspace_id = v_ws;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  IF v_plan.id IS NULL THEN RETURN false; END IF;

  IF _action = 'read' THEN
    RETURN public.auction_plan_read_ok(v_ws, v_plan.branch_id, v_plan.id);
  ELSIF _action = 'write' THEN
    -- Người lập (đúng chi nhánh) HOẶC người duyệt — quyết định phê duyệt do cấp
    -- trên tải lên, nên người duyệt cũng phải ghi được.
    RETURN public.owner_ws_has_in(v_ws, 'ke-hoach', 'update', v_plan.branch_id)
        OR public.auction_plan_reviewer_ok(v_plan.id);
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_plan_doc_ok(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auction_plan_doc_ok(TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS auction_plan_docs_select ON storage.objects;
CREATE POLICY auction_plan_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'auction-plan-docs' AND public.auction_plan_doc_ok(name, 'read'));

DROP POLICY IF EXISTS auction_plan_docs_insert ON storage.objects;
CREATE POLICY auction_plan_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auction-plan-docs' AND public.auction_plan_doc_ok(name, 'write'));

-- Không có policy UPDATE: tệp chỉ thêm hoặc xoá, không ghi đè.
DROP POLICY IF EXISTS auction_plan_docs_delete ON storage.objects;
CREATE POLICY auction_plan_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'auction-plan-docs' AND public.auction_plan_doc_ok(name, 'write'));

-- ═════════════════════════════════════════════════════════════════════════════
-- 14. TỰ KIỂM
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  _total INT;
  _staff INT;
  _viewer INT;
  _t TEXT;
BEGIN
  SELECT COUNT(*) INTO _total  FROM public.owner_ws_permission_catalog();
  SELECT COUNT(*) INTO _staff  FROM public.owner_ws_default_role_permissions('STAFF');
  SELECT COUNT(*) INTO _viewer FROM public.owner_ws_default_role_permissions('VIEWER');
  -- 50 + 6 = 56 cặp / 32 + 5 = 37 (Cán bộ) / 15 + 1 = 16 (Người xem)
  IF _total <> 56 OR _staff <> 37 OR _viewer <> 16 THEN
    RAISE EXCEPTION 'Danh mục quyền sai: % / % / % (chờ 56 / 37 / 16)', _total, _staff, _viewer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_ws_permission_catalog()
                  WHERE module = 'ke-hoach' AND action = 'approve') THEN
    RAISE EXCEPTION 'Thiếu ke-hoach:approve trong danh mục';
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_ws_default_role_permissions('STAFF')
              WHERE module = 'ke-hoach' AND action = 'approve') THEN
    RAISE EXCEPTION 'Cán bộ KHÔNG được có ke-hoach:approve';
  END IF;

  -- Mọi vai trò STAFF / VIEWER đang có đều đã được cấp module mới.
  IF EXISTS (SELECT 1 FROM public.owner_ws_roles r
              WHERE NOT r.is_system AND r.code IN ('STAFF', 'VIEWER')
                AND NOT EXISTS (SELECT 1 FROM public.owner_ws_role_permissions p
                                 WHERE p.role_id = r.id AND p.module = 'ke-hoach' AND p.action = 'view')) THEN
    RAISE EXCEPTION 'Còn vai trò mặc định chưa được cấp ke-hoach:view';
  END IF;

  -- anon không có bất kỳ quyền bảng nào
  FOREACH _t IN ARRAY ARRAY['auction_plan_cycles', 'auction_plan_cycle_units', 'auction_plans',
                            'auction_plan_items', 'auction_plan_item_steps', 'auction_plan_baselines'] LOOP
    IF has_table_privilege('anon', 'public.' || _t, 'SELECT')
       OR has_table_privilege('anon', 'public.' || _t, 'INSERT')
       OR has_table_privilege('anon', 'public.' || _t, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || _t, 'DELETE') THEN
      RAISE EXCEPTION '%: anon phải KHÔNG có quyền nào', _t;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || _t, 'SELECT') THEN
      RAISE EXCEPTION '%: authenticated phải SELECT được', _t;
    END IF;
  END LOOP;

  -- Trạng thái / số bản mốc không nằm trong quyền ghi của client
  IF has_column_privilege('authenticated', 'public.auction_plans', 'status', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.auction_plans', 'baseline_version', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.auction_plans', 'approval_doc_no', 'UPDATE') THEN
    RAISE EXCEPTION 'auction_plans: client KHÔNG được ghi status / baseline_version / approval_doc_*';
  END IF;
  IF has_column_privilege('authenticated', 'public.auction_plan_items', 'workspace_id', 'INSERT') THEN
    RAISE EXCEPTION 'auction_plan_items: workspace_id do trigger ép, không cấp cho client';
  END IF;
  -- Mốc đóng băng + đợt: không có quyền ghi cho client
  IF has_table_privilege('authenticated', 'public.auction_plan_baselines', 'INSERT')
     OR has_table_privilege('authenticated', 'public.auction_plan_baselines', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.auction_plan_baselines', 'DELETE')
     OR has_table_privilege('authenticated', 'public.auction_plan_cycles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.auction_plan_cycle_units', 'INSERT') THEN
    RAISE EXCEPTION 'Mốc đóng băng và đợt chỉ ghi qua RPC';
  END IF;

  -- RPC không phơi cho anon
  FOREACH _t IN ARRAY ARRAY['public.auction_plan_submit(uuid)',
                            'public.auction_plan_return(uuid,text)',
                            'public.auction_plan_record_approval(uuid,text,date,text[])',
                            'public.auction_plan_start_adjustment(uuid)',
                            'public.auction_plan_close(uuid)',
                            'public.auction_plan_cycle_open(uuid,int,text,date,text)',
                            'public.auction_plan_cycle_close(uuid)',
                            'public.auction_plan_cycle_set_units(uuid,jsonb)',
                            'public.auction_plan_reviewer_ok(uuid)',
                            'public.auction_plan_can_approve(uuid)'] LOOP
    IF has_function_privilege('anon', _t, 'EXECUTE') THEN
      RAISE EXCEPTION '%: phải REVOKE khỏi anon', _t;
    END IF;
  END LOOP;

  -- Mẫu mốc: QSDĐ 10 bước, tài sản công 8 bước
  IF (SELECT COUNT(*) FROM public.auction_plan_step_template('land_use_right')) <> 10
     OR (SELECT COUNT(*) FROM public.auction_plan_step_template('public_asset')) <> 8 THEN
    RAISE EXCEPTION 'Mẫu mốc công việc sai số bước';
  END IF;
END $$;

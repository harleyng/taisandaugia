-- Chỉ tiêu của Trạm Điều Hành — Phase 9 của docs/owner-control-tower-plan.md (§A5).
--
-- Trưởng đơn vị đặt chỉ tiêu thu hồi (số tiền và/hoặc số tài sản đấu thành) cho
-- một tháng / quý / năm, cho cả đơn vị (branch_id NULL) hoặc một chi nhánh.
-- Bảng CHỈ lưu chỉ tiêu. Số "đã thu" được TÍNH, không lưu: luật nằm ở
-- src/lib/ownerTargets.ts (Phase 10 dựng payload báo cáo ở SQL phải chép đúng luật đó).
--
-- Quyền: đọc = mọi thành viên ('read'); ghi = 'manage_members' đúng như plan
-- (hiện chỉ Trưởng đơn vị — cùng nghĩa với 'manage_workspace').

-- ─── 1. Bảng ────────────────────────────────────────────────────────────────

CREATE TABLE public.owner_workspace_targets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  -- NULL = cả đơn vị. Xoá chi nhánh ⇒ xoá luôn chỉ tiêu của nó (SET NULL sẽ biến
  -- nó thành chỉ tiêu cả đơn vị và đụng ràng buộc duy nhất).
  branch_id      UUID REFERENCES public.workspace_branches(id) ON DELETE CASCADE,
  period_type    TEXT NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  -- Ngày đầu kỳ: 01/tháng · 01/01|04|07|10 · 01/01.
  period_start   DATE NOT NULL,
  target_amount  NUMERIC(18,0) CHECK (target_amount IS NULL OR target_amount > 0),
  target_count   INT           CHECK (target_count IS NULL OR target_count > 0),
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owt_has_goal CHECK (target_amount IS NOT NULL OR target_count IS NOT NULL),
  CONSTRAINT owt_period_aligned CHECK (
    extract(day FROM period_start) = 1
    AND CASE period_type
          WHEN 'month'   THEN true
          WHEN 'quarter' THEN extract(month FROM period_start) IN (1, 4, 7, 10)
          WHEN 'year'    THEN extract(month FROM period_start) = 1
        END
  ),
  -- NULLS NOT DISTINCT: chỉ tiêu cả đơn vị (branch_id NULL) cũng chỉ có một mỗi kỳ.
  CONSTRAINT owt_unique_period UNIQUE NULLS NOT DISTINCT (workspace_id, branch_id, period_type, period_start)
);

CREATE INDEX idx_owt_ws_period ON public.owner_workspace_targets (workspace_id, period_start);
CREATE INDEX idx_owt_branch    ON public.owner_workspace_targets (branch_id);
CREATE INDEX idx_owt_created_by ON public.owner_workspace_targets (created_by);

CREATE TRIGGER owner_workspace_targets_updated_at
  BEFORE UPDATE ON public.owner_workspace_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. Trigger bảo vệ ──────────────────────────────────────────────────────
-- SECURITY DEFINER: kiểm chi nhánh không phụ thuộc RLS của người gọi.

CREATE OR REPLACE FUNCTION public.owner_workspace_targets_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'Không thể chuyển chỉ tiêu sang không gian khác';
    END IF;
    NEW.created_by := OLD.created_by;
  ELSIF auth.uid() IS NOT NULL THEN
    -- Người tạo là người đang đăng nhập, không phải giá trị client gửi lên.
    NEW.created_by := auth.uid();
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_id IS DISTINCT FROM OLD.branch_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.workspace_branches wb
        WHERE wb.id = NEW.branch_id AND wb.workspace_id = NEW.workspace_id
     ) THEN
    RAISE EXCEPTION 'Chi nhánh không thuộc đơn vị này';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_workspace_targets_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_workspace_targets_guard
  BEFORE INSERT OR UPDATE ON public.owner_workspace_targets
  FOR EACH ROW EXECUTE FUNCTION public.owner_workspace_targets_guard();

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.owner_workspace_targets ENABLE ROW LEVEL SECURITY;
-- Chỉ tiêu nợ xấu là dữ liệu nhạy cảm: anon không có quyền bảng (như bảng lời mời Phase 3).
REVOKE ALL ON public.owner_workspace_targets FROM anon;

CREATE POLICY "owner_workspace_targets_read" ON public.owner_workspace_targets
  FOR SELECT TO authenticated
  USING (public.owner_ws_can(workspace_id, 'read'));

CREATE POLICY "owner_workspace_targets_insert" ON public.owner_workspace_targets
  FOR INSERT TO authenticated
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_members'));

CREATE POLICY "owner_workspace_targets_update" ON public.owner_workspace_targets
  FOR UPDATE TO authenticated
  USING      (public.owner_ws_can(workspace_id, 'manage_members'))
  WITH CHECK (public.owner_ws_can(workspace_id, 'manage_members'));

CREATE POLICY "owner_workspace_targets_delete" ON public.owner_workspace_targets
  FOR DELETE TO authenticated
  USING (public.owner_ws_can(workspace_id, 'manage_members'));

-- ─── 4. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
           WHERE c.oid = 'public.owner_workspace_targets'::regclass) THEN
    RAISE EXCEPTION 'owner_workspace_targets self-check: chưa bật RLS';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'owt_unique_period'
                    AND conrelid = 'public.owner_workspace_targets'::regclass) THEN
    RAISE EXCEPTION 'owner_workspace_targets self-check: thiếu ràng buộc duy nhất theo kỳ';
  END IF;

  IF has_table_privilege('anon', 'public.owner_workspace_targets', 'SELECT') THEN
    RAISE EXCEPTION 'owner_workspace_targets self-check: anon còn quyền đọc bảng';
  END IF;

  IF has_function_privilege('authenticated', 'public.owner_workspace_targets_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_workspace_targets self-check: trigger guard đang mở cho authenticated';
  END IF;
END;
$$;

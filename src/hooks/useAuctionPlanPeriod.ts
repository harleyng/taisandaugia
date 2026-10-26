/* eslint-disable @typescript-eslint/no-explicit-any */
// Vận hành kế hoạch đấu giá theo kỳ (Phase 6): tab "Theo kỳ", trang "Vận hành
// tháng", và "Tạo chỉ tiêu từ kế hoạch".
//
// ⚠️ `(supabase as any)` ở mọi truy vấn / RPC `auction_plan_*` — xem đầu
// `useAuctionPlans.ts`: `src/integrations/supabase/types.ts` chưa sinh lại được
// trên máy hiện tại nên các bảng và hàm này không có trong kiểu tự sinh.
//
// ⚠️ Số của tab "Theo kỳ" tính Ở CLIENT bằng `planVsActual` (A5) — cùng luật với
// bản sao SQL `auction_plan_period_metrics` (có test đối chiếu 68 cặp trên mẫu
// demo). Hai nơi KHÔNG được tính khác nhau: tab đọc TS, còn báo cáo định kỳ
// (Phase 8) và roll-up tỉnh (Phase 7) đọc SQL.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { usePlanBaselines } from "@/hooks/useAuctionPlanApproval";
import { usePlanItemOutcomes } from "@/hooks/useAuctionPlanProgress";
import { auctionPlanWriteMessage } from "@/lib/auctionPlan/rpc";
import { addDaysIso, monthEndIso, monthStartIso, planHealthToday, type PlanItemHealth } from "@/lib/auctionPlan/health";
import {
  planPeriodRows,
  planQuarterGoals,
  planVsActual,
  planVsActualByMonth,
  type PlanPeriod,
  type PlanPeriodOutcome,
  type PlanPeriodRow,
} from "@/lib/auctionPlan/period";
import type { AuctionPlan, AuctionPlanItem, AuctionPlanStep } from "@/lib/auctionPlan/types";
import { targetErrorMessage, type OwnerTarget } from "@/lib/ownerTargets";

/* ─── Tab "Theo kỳ" ───────────────────────────────────────────────────────── */

/**
 * Dòng "Theo kỳ" của mọi tài sản + chỉ số của kỳ đang chọn + chuỗi 12 tháng.
 *
 * Dùng LẠI `usePlanItemOutcomes` / `usePlanBaselines` của Phase 4-5 (cùng query
 * key) nên mở tab không tải thêm gì khi vừa xem tab "Tiến độ".
 */
export function usePlanPeriod(plan: AuctionPlan | null, items: readonly AuctionPlanItem[], period: PlanPeriod) {
  const outcomesQuery = usePlanItemOutcomes(plan?.id);
  const baselinesQuery = usePlanBaselines(plan?.id);

  const rows = useMemo<PlanPeriodRow[]>(() => {
    const map = new Map<string, PlanPeriodOutcome | null>(
      (outcomesQuery.data ?? []).map((o) => [o.item_id, o as PlanPeriodOutcome]),
    );
    return planPeriodRows(items, map, (baselinesQuery.data ?? [])[0] ?? null);
  }, [items, outcomesQuery.data, baselinesQuery.data]);

  const metrics = useMemo(() => planVsActual(rows, period), [rows, period]);
  const series = useMemo(() => planVsActualByMonth(rows, plan?.plan_year ?? 0), [rows, plan?.plan_year]);
  const quarterGoals = useMemo(() => planQuarterGoals(rows, plan?.plan_year ?? 0), [rows, plan?.plan_year]);

  return {
    rows,
    metrics,
    series,
    quarterGoals,
    /** Kế hoạch đã từng được duyệt ⇒ cột kế hoạch là bản mốc, không phải danh mục. */
    hasBaseline: (baselinesQuery.data ?? []).length > 0,
    isLoading: outcomesQuery.isLoading || baselinesQuery.isLoading,
    isError: outcomesQuery.isError,
  };
}

/* ─── Trang "Vận hành tháng" ──────────────────────────────────────────────── */

export interface PlanDueStep {
  step_id: string;
  plan_id: string;
  plan_title: string;
  plan_status: string;
  plan_year: number;
  branch_id: string | null;
  admin_unit_code: string | null;
  item_id: string;
  item_code: string | null;
  item_title: string | null;
  planned_month: string | null;
  forecast_month: string | null;
  step: AuctionPlanStep;
  sort_order: number;
  planned_date: string;
}

/**
 * Mốc chưa xong có ngày dự kiến ≤ `through`, MỌI kế hoạch chưa đóng của Trạm.
 *
 * RPC là SECURITY INVOKER ⇒ RLS theo chi nhánh là cổng: cán bộ xã chỉ thấy mốc
 * của xã mình, không cần truyền chi nhánh.
 */
export function usePlanDueSteps(workspaceId: string | null | undefined, through: string | null) {
  return useQuery<PlanDueStep[]>({
    queryKey: qk.auctionPlanDueSteps(workspaceId, through),
    enabled: !!workspaceId && !!through,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_due_steps", {
        p_workspace_id: workspaceId!,
        p_through: through!,
      });
      if (error) throw error;
      return (data ?? []) as PlanDueStep[];
    },
  });
}

/**
 * Số mốc ĐÃ QUÁ HẠN của Trạm — số đếm nav `auction-plan-due`.
 *
 * Quá hạn = ngày dự kiến < hôm nay (đến hạn ĐÚNG hôm nay thì chưa quá hạn, cùng
 * biên với `planStepProgress` và A5). Đọc cùng RPC với trang "Vận hành tháng"
 * nên số trên nav và số trên trang không thể lệch.
 */
export function useOverduePlanStepCount(workspaceId: string | null | undefined, enabled = true) {
  const today = useMemo(() => planHealthToday(), []);
  const query = usePlanDueSteps(enabled ? workspaceId : null, enabled ? addDaysIso(today, -1) : null);
  return query.data?.length ?? 0;
}

export interface PlanMonthItem {
  plan_id: string;
  plan_title: string;
  plan_status: string;
  plan_year: number;
  branch_id: string | null;
  admin_unit_code: string | null;
  item_id: string;
  item_code: string | null;
  item_title: string | null;
  planned_month: string | null;
  baseline_month: string | null;
  forecast_month: string | null;
  health: PlanItemHealth;
  steps_done: number;
  steps_total: number;
  next_step: AuctionPlanStep | null;
  next_step_date: string | null;
  outcome: string | null;
  payment_status: string | null;
}

/** Tài sản có tháng bản mốc HOẶC tháng dự kiến mới nằm trong [from, to]. */
export function usePlanMonthItems(
  workspaceId: string | null | undefined,
  from: string | null,
  to: string | null,
  asOf: string,
) {
  return useQuery<PlanMonthItem[]>({
    queryKey: qk.auctionPlanMonthItems(workspaceId, from, to),
    enabled: !!workspaceId && !!from && !!to,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_month_items", {
        p_workspace_id: workspaceId!,
        p_from: from!,
        p_to: to!,
        p_as_of: asOf,
      });
      if (error) throw error;
      return (data ?? []) as PlanMonthItem[];
    },
  });
}

/** Mọi dữ liệu của một tháng vận hành: mốc quá hạn, mốc đến hạn, tài sản, tháng sau. */
export function usePlanMonthBoard(workspaceId: string | null | undefined, month: string) {
  const asOf = useMemo(() => planHealthToday(), []);
  const start = monthStartIso(month) ?? month;
  const end = monthEndIso(start);
  const nextStart = monthStartIso(addDaysIso(end ?? start, 1));
  const nextEnd = monthEndIso(nextStart);

  const stepsQuery = usePlanDueSteps(workspaceId, end);
  const itemsQuery = usePlanMonthItems(workspaceId, start, end, asOf);
  const nextQuery = usePlanMonthItems(workspaceId, nextStart, nextEnd, asOf);

  // Chia mốc thành "đã quá hạn" / "đến hạn trong kỳ": biên GIỐNG
  // `planStepProgress` và A5 — đến hạn ĐÚNG hôm nay thì CHƯA quá hạn.
  const { overdue, dueSoon } = useMemo(() => {
    const steps = stepsQuery.data ?? [];
    return {
      overdue: steps.filter((s) => s.planned_date < asOf),
      dueSoon: steps.filter((s) => s.planned_date >= asOf),
    };
  }, [stepsQuery.data, asOf]);

  return {
    asOf,
    start,
    end,
    nextStart,
    overdue,
    dueSoon,
    items: itemsQuery.data ?? [],
    nextItems: nextQuery.data ?? [],
    isLoading: stepsQuery.isLoading || itemsQuery.isLoading,
    isError: stepsQuery.isError || itemsQuery.isError,
  };
}

/* ─── Ghi từ trang "Vận hành tháng" (nhiều kế hoạch trên một trang) ───────── */

/**
 * Làm mới mọi thứ của một Trạm sau khi ghi từ trang vận hành.
 *
 * `["auction-plans", workspaceId]` là tiền tố của cả `due-steps` và
 * `month-items`, nên một lần invalidate làm mới trang VÀ số đếm nav.
 */
function useWorkspacePlanInvalidate(workspaceId: string | null | undefined) {
  const qc = useQueryClient();
  return (planId?: string | null) => {
    void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId ?? null) });
    if (planId) void qc.invalidateQueries({ queryKey: qk.auctionPlan(planId) });
  };
}

/**
 * "Đánh dấu xong" ngay trên thẻ việc — ghi `done_on` = hôm nay (giờ VN).
 *
 * Payload dựng TƯỜNG MINH: `auction_plan_item_steps` chỉ GRANT một số cột cho
 * client, gửi thêm một cột (ví dụ `source`) trả 42501 nêu tên BẢNG chứ không nêu
 * cột. Ngày tương lai bị guard của bảng RAISE ⇒ luôn dùng hôm nay.
 */
export function useMarkDueStepDone(workspaceId: string | null | undefined) {
  const invalidate = useWorkspacePlanInvalidate(workspaceId);
  const today = useMemo(() => planHealthToday(), []);
  return useMutation({
    mutationFn: async (step: PlanDueStep) => {
      const { error } = await (supabase as any)
        .from("auction_plan_item_steps")
        .update({ done_on: today })
        .eq("id", step.step_id);
      if (error) throw new Error(auctionPlanWriteMessage(error));
      return step;
    },
    onSuccess: (step) => {
      invalidate(step.plan_id);
      toast.success("Đã đánh dấu mốc hoàn thành");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** "Dời dự kiến" ngay trên thẻ việc — trường THỰC HIỆN, sửa được kể cả khi đã duyệt. */
export function useMovePlanItemForecast(workspaceId: string | null | undefined) {
  const invalidate = useWorkspacePlanInvalidate(workspaceId);
  return useMutation({
    mutationFn: async (v: { planId: string; itemId: string; month: string | null; reason: string | null }) => {
      const { error } = await (supabase as any)
        .from("auction_plan_items")
        .update({ forecast_month: v.month, forecast_reason: v.reason })
        .eq("id", v.itemId);
      if (error) throw new Error(auctionPlanWriteMessage(error));
      return v;
    },
    onSuccess: (v) => {
      invalidate(v.planId);
      toast.success(v.month ? "Đã dời tháng dự kiến" : "Đã bỏ tháng dự kiến mới");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ─── "Tạo chỉ tiêu từ kế hoạch" ──────────────────────────────────────────── */

export interface PlanTargetQuarter {
  periodStart: string;
  label: string;
  offeredCount: number;
  winningTotal: number;
}

/**
 * Tạo / cập nhật chỉ tiêu QUÝ từ bản mốc của kế hoạch — qua `owner_save_target`
 * (SECURITY INVOKER ⇒ RLS và quyền `chi-tieu` là cổng, không nới gì ở đây).
 *
 * ⚠️ `owner_save_target` THAY TOÀN BỘ tiêu chí của chỉ tiêu đó. Vì thế quý đã có
 * chỉ tiêu chỉ được ghi khi người dùng tích chọn tường minh — hộp thoại hiển thị
 * cái đang có và không bao giờ tự ghi đè.
 */
export function useGeneratePlanTargets(plan: AuctionPlan | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quarters, existing }: { quarters: PlanTargetQuarter[]; existing: Map<string, OwnerTarget> }) => {
      if (!plan) throw new Error("no_plan");
      let created = 0;
      let updated = 0;
      for (const q of quarters) {
        const current = existing.get(q.periodStart) ?? null;
        const { error } = await supabase.rpc("owner_save_target", {
          p_workspace_id: plan.workspace_id,
          p_target_id: current?.id ?? null,
          p_branch_id: plan.branch_id,
          p_period_type: "quarter",
          p_period_start: q.periodStart,
          p_name: null,
          p_criteria: [
            { metric: "offered_count", goal: q.offeredCount },
            { metric: "winning_total", goal: q.winningTotal },
          ],
          // Kiểu sinh tự động coi mọi tham số là bắt buộc & khác null; server nhận NULL.
        } as never);
        if (error) throw error;
        if (current) updated += 1;
        else created += 1;
      }
      return { created, updated };
    },
    onSuccess: ({ created, updated }) => {
      void qc.invalidateQueries({ queryKey: qk.ownerTargets(plan?.workspace_id ?? null) });
      const parts = [created ? `tạo ${created} chỉ tiêu quý` : null, updated ? `cập nhật ${updated} chỉ tiêu quý` : null]
        .filter(Boolean)
        .join(" · ");
      toast.success(parts ? `Đã ${parts}` : "Không có quý nào được chọn");
    },
    onError: (err) => toast.error(targetErrorMessage(err)),
  });
}

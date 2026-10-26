/* eslint-disable @typescript-eslint/no-explicit-any */
// Màn CẤP TỈNH của Kế hoạch đấu giá (Phase 7): "Toàn tỉnh", đợt lập kế hoạch,
// danh mục hợp nhất.
//
// ⚠️ `(supabase as any)` ở mọi truy vấn / RPC `auction_plan_*` — xem đầu
// `useAuctionPlans.ts`: `src/integrations/supabase/types.ts` chưa sinh lại được
// trên máy hiện tại (token CLI thuộc tài khoản Supabase khác, `--db-url` cần
// Docker) nên các bảng và hàm này không có trong kiểu tự sinh. Kiểu thật nằm ở
// `src/lib/auctionPlan/*`.
//
// ⚠️ Số liệu của màn tỉnh đọc SQL (`auction_plan_rollup`), không tính lại ở
// client: roll-up cộng chính các dòng `auction_plan_period_metrics` của từng kế
// hoạch, nên tổng của tỉnh luôn bằng tổng các số "Theo kỳ" của từng xã.
//
// ⚠️ `auction_plan_cycles` / `auction_plan_cycle_units` KHÔNG có policy ghi —
// mọi thay đổi đi qua ba RPC `auction_plan_cycle_open / _close / _set_units`, và
// `set_units` THAY TOÀN BỘ danh sách đơn vị trong một giao dịch.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertAuctionPlanRpcOk } from "@/lib/auctionPlan/rpc";
import { auctionPlanReasonMessage } from "@/lib/auctionPlan/types";
import {
  provinceAttention,
  provinceSummary,
  type ProvinceRollupRow,
} from "@/lib/auctionPlan/province";
import { consolidatedByUnit, type ConsolidatedItemRow } from "@/lib/auctionPlan/consolidated";
import { planPeriodKey, type PlanPeriod } from "@/lib/auctionPlan/period";
import { planHealthToday } from "@/lib/auctionPlan/health";
import type { AuctionPlanCycle, AuctionPlanCycleKind, AuctionPlanCycleUnit } from "@/lib/auctionPlan/types";

const CYCLE_COLUMNS =
  "id, workspace_id, plan_year, kind, status, submit_deadline, instructions, attachment_urls, closed_at, created_by, created_at, updated_at";
const CYCLE_UNIT_COLUMNS =
  "id, cycle_id, workspace_id, admin_unit_code, branch_id, child_workspace_id, assigned_revenue, assigned_count, created_at, updated_at";

/* ─── Cổng của màn cấp tỉnh ───────────────────────────────────────────────── */

/**
 * Người xem mở được màn cấp tỉnh hay không — SERVER quyết (`auction_plan_province_ok`).
 *
 * Cán bộ bị giới hạn chi nhánh trả false, nên trang hiện thông báo "không thuộc
 * phạm vi" thay vì một bảng rỗng. Mọi RPC cấp tỉnh cũng tự kiểm lại cổng này.
 */
export function useAuctionPlanProvinceOk(workspaceId: string | null | undefined) {
  return useQuery<boolean>({
    queryKey: qk.auctionPlanProvinceOk(workspaceId ?? null),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_province_ok", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return data === true;
    },
  });
}

/* ─── "Toàn tỉnh" ─────────────────────────────────────────────────────────── */

export function useProvinceRollup(
  workspaceId: string | null | undefined,
  planYear: number,
  period: PlanPeriod,
  enabled = true,
) {
  return useQuery<ProvinceRollupRow[]>({
    queryKey: qk.auctionPlanRollup(workspaceId ?? null, planYear, planPeriodKey(period)),
    enabled: !!workspaceId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_rollup", {
        p_workspace_id: workspaceId!,
        p_year: planYear,
        p_period_type: period.type,
        p_period_start: period.start,
      });
      if (error) throw error;
      return (data ?? []) as ProvinceRollupRow[];
    },
  });
}

/** Mọi thứ trang "Toàn tỉnh" cần: dòng, câu trả lời L1, ba nhóm việc L2. */
export function useProvinceBoard(
  workspaceId: string | null | undefined,
  planYear: number,
  period: PlanPeriod,
  enabled = true,
) {
  const query = useProvinceRollup(workspaceId, planYear, period, enabled);
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const summary = useMemo(() => provinceSummary(rows), [rows]);
  const attention = useMemo(() => provinceAttention(rows), [rows]);
  const today = useMemo(() => planHealthToday(), []);
  return { rows, summary, attention, today, isLoading: query.isLoading, isError: query.isError };
}

/* ─── Danh mục hợp nhất (in + Excel) ─────────────────────────────────────── */

export function useConsolidatedPlanItems(
  workspaceId: string | null | undefined,
  planYear: number,
  enabled = true,
) {
  const query = useQuery<ConsolidatedItemRow[]>({
    queryKey: qk.auctionPlanConsolidated(workspaceId ?? null, planYear),
    enabled: !!workspaceId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_consolidated", {
        p_workspace_id: workspaceId!,
        p_year: planYear,
      });
      if (error) throw error;
      return (data ?? []) as ConsolidatedItemRow[];
    },
  });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const units = useMemo(() => consolidatedByUnit(rows), [rows]);
  return { rows, units, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

/* ─── Đợt lập kế hoạch ───────────────────────────────────────────────────── */

/** MỌI đợt của Trạm tỉnh (gồm đợt đã đóng) + đơn vị trong đợt. */
export function useAllPlanCycles(workspaceId: string | null | undefined, enabled = true) {
  const query = useQuery<{ cycles: AuctionPlanCycle[]; units: AuctionPlanCycleUnit[] }>({
    queryKey: qk.auctionPlanAllCycles(workspaceId ?? null),
    enabled: !!workspaceId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_cycles")
        .select(CYCLE_COLUMNS)
        .eq("workspace_id", workspaceId!)
        .order("plan_year", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const cycles = (data ?? []) as AuctionPlanCycle[];
      if (cycles.length === 0) return { cycles, units: [] };
      const { data: unitRows, error: unitError } = await (supabase as any)
        .from("auction_plan_cycle_units")
        .select(CYCLE_UNIT_COLUMNS)
        .in(
          "cycle_id",
          cycles.map((c) => c.id),
        );
      if (unitError) throw unitError;
      return { cycles, units: (unitRows ?? []) as AuctionPlanCycleUnit[] };
    },
  });
  return {
    cycles: query.data?.cycles ?? [],
    units: query.data?.units ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface PlanCycleCandidate {
  admin_unit_code: string;
  unit_name: string;
  unit_type: string;
  shape: "branch" | "child";
  branch_id: string | null;
  child_workspace_id: string | null;
  display_name: string;
}

/** Các xã chọn được khi mở đợt — hình A (chi nhánh) và hình B (Trạm con) trong MỘT danh sách. */
export function usePlanCycleCandidates(workspaceId: string | null | undefined, enabled = true) {
  return useQuery<PlanCycleCandidate[]>({
    queryKey: qk.auctionPlanCycleCandidates(workspaceId ?? null),
    enabled: !!workspaceId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_cycle_candidates", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data ?? []) as PlanCycleCandidate[];
    },
  });
}

export interface PlanCycleBoardRow {
  admin_unit_code: string;
  unit_name: string;
  shape: "branch" | "child" | "none";
  branch_id: string | null;
  child_workspace_id: string | null;
  assigned_revenue: number | null;
  assigned_count: number | null;
  plan_id: string | null;
  plan_status: string | null;
  linked_to_cycle: boolean;
  item_count: number;
  expected_total: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
}

/** Bảng theo dõi MỘT đợt — đúng đợt đang xem, kể cả đợt đã đóng. */
export function usePlanCycleBoard(cycleId: string | undefined) {
  return useQuery<PlanCycleBoardRow[]>({
    queryKey: qk.auctionPlanCycleBoard(cycleId ?? null),
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_cycle_board", {
        p_cycle_id: cycleId!,
      });
      if (error) throw error;
      return (data ?? []) as PlanCycleBoardRow[];
    },
  });
}

/* ─── Ghi: mở / đóng đợt, giao chỉ tiêu ──────────────────────────────────── */

export interface CycleUnitInput {
  admin_unit_code: string;
  branch_id?: string | null;
  child_workspace_id?: string | null;
  assigned_revenue?: number | null;
  assigned_count?: number | null;
}

export interface OpenCycleInput {
  planYear: number;
  kind: AuctionPlanCycleKind;
  submitDeadline: string | null;
  instructions: string | null;
  units: CycleUnitInput[];
}

const rpcError = (err: unknown): string =>
  err instanceof Error ? err.message : auctionPlanReasonMessage(null);

function useCycleInvalidate(workspaceId: string | null | undefined) {
  const qc = useQueryClient();
  return (cycleId?: string | null) => {
    void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId ?? null) });
    void qc.invalidateQueries({ queryKey: qk.auctionPlanCycles(workspaceId ?? null) });
    if (cycleId) void qc.invalidateQueries({ queryKey: qk.auctionPlanCycleBoard(cycleId) });
  };
}

/**
 * "Mở đợt lập kế hoạch": mở đợt rồi GIAO danh sách xã trong hai bước.
 *
 * `auction_plan_cycle_set_units` thay toàn bộ danh sách, nên gọi nó ngay sau khi
 * mở là đúng cả khi đợt đã tồn tại và đang được mở lại.
 */
export function useOpenPlanCycle(workspaceId: string | null | undefined) {
  const invalidate = useCycleInvalidate(workspaceId);
  return useMutation({
    mutationFn: async (input: OpenCycleInput): Promise<string> => {
      const { data, error } = await (supabase as any).rpc("auction_plan_cycle_open", {
        p_workspace_id: workspaceId!,
        p_plan_year: input.planYear,
        p_kind: input.kind,
        p_submit_deadline: input.submitDeadline,
        p_instructions: input.instructions,
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      const cycleId = (data as { cycle_id?: string })?.cycle_id;
      if (!cycleId) throw new Error(auctionPlanReasonMessage("not_found"));
      if (input.units.length > 0) {
        const { data: setData, error: setError } = await (supabase as any).rpc(
          "auction_plan_cycle_set_units",
          { p_cycle_id: cycleId, p_units: input.units },
        );
        if (setError) throw setError;
        assertAuctionPlanRpcOk(setData);
      }
      return cycleId;
    },
    onSuccess: (cycleId) => {
      invalidate(cycleId);
      toast.success("Đã mở đợt lập kế hoạch");
    },
    onError: (e) => toast.error(rpcError(e)),
  });
}

/** Giao lại danh sách xã + chỉ tiêu cho một đợt đang mở (THAY toàn bộ danh sách). */
export function useSetPlanCycleUnits(workspaceId: string | null | undefined) {
  const invalidate = useCycleInvalidate(workspaceId);
  return useMutation({
    mutationFn: async (v: { cycleId: string; units: CycleUnitInput[] }) => {
      const { data, error } = await (supabase as any).rpc("auction_plan_cycle_set_units", {
        p_cycle_id: v.cycleId,
        p_units: v.units,
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      return v.cycleId;
    },
    onSuccess: (cycleId) => {
      invalidate(cycleId);
      toast.success("Đã lưu chỉ tiêu giao cho các đơn vị");
    },
    onError: (e) => toast.error(rpcError(e)),
  });
}

export function useClosePlanCycle(workspaceId: string | null | undefined) {
  const invalidate = useCycleInvalidate(workspaceId);
  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { data, error } = await (supabase as any).rpc("auction_plan_cycle_close", {
        p_cycle_id: cycleId,
      });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      return cycleId;
    },
    onSuccess: (cycleId) => {
      invalidate(cycleId);
      toast.success("Đã đóng đợt lập kế hoạch");
    },
    onError: (e) => toast.error(rpcError(e)),
  });
}

/**
 * "Đóng kế hoạch" (`approved | adjusting → closed`) — RPC có từ Phase 4 nhưng
 * chưa có mặt UI nào. Nhà của nó là màn cấp tỉnh: đóng một kế hoạch đã duyệt là
 * việc của cấp duyệt (`auction_plan_reviewer_ok`).
 */
export function useClosePlan(workspaceId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await (supabase as any).rpc("auction_plan_close", { p_plan_id: planId });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      return planId;
    },
    onSuccess: (planId) => {
      void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId ?? null) });
      void qc.invalidateQueries({ queryKey: qk.auctionPlan(planId) });
      toast.success("Đã đóng kế hoạch");
    },
    onError: (e) => toast.error(rpcError(e)),
  });
}

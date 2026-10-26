/* eslint-disable @typescript-eslint/no-explicit-any */
// Dữ liệu trang danh sách "Kế hoạch đấu giá" (/chu-tai-san/ke-hoach).
//
// ⚠️ Mọi truy vấn `auction_plan_*` phải ép `(supabase as any)`:
// `src/integrations/supabase/types.ts` chưa sinh lại được trên máy này (token
// CLI thuộc tài khoản Supabase khác, `--db-url` cần Docker) nên các bảng của
// Phase 2 không có trong kiểu tự sinh. Kiểu thật nằm ở
// `src/lib/auctionPlan/types.ts` — cast rồi gán về đó, đúng cách
// `useWorkspaceBranches` / `useAdminUnits` đang làm với `admin_units`.
//
// ⚠️ GHI: chỉ gửi đúng các cột có GRANT INSERT
// (`workspace_id, branch_id, admin_unit_code, cycle_id, plan_year, kind, title,
// level, legal_basis, notes`). KHÔNG BAO GIỜ spread lại một dòng đã đọc vào
// payload: gửi thêm `status` / `baseline_version` / `approval_doc_*` là
// "permission denied for table auction_plans", mà lỗi chỉ nêu tên BẢNG chứ
// không nêu cột.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranches } from "@/hooks/useWorkspaceBranches";
import { adminUnitLevelOfCode } from "@/lib/adminUnits";
import { cycleForUnit, type PlanCycleContext } from "@/lib/auctionPlan/cycles";
import { auctionPlanWriteMessage } from "@/lib/auctionPlan/rpc";
import { planYears } from "@/lib/auctionPlan/totals";
import type {
  AuctionPlan,
  AuctionPlanCycle,
  AuctionPlanCycleUnit,
  AuctionPlanItem,
  AuctionPlanKind,
  AuctionPlanLevel,
} from "@/lib/auctionPlan/types";

/** Liệt kê cột thay vì `select("*")`: một cột thiếu GRANT SELECT làm `*` chết cả câu. */
export const PLAN_COLUMNS =
  "id, workspace_id, branch_id, admin_unit_code, cycle_id, plan_year, kind, title, level, status, baseline_version, approval_doc_no, approval_doc_date, approval_doc_urls, legal_basis, notes, submitted_at, submitted_by, reviewed_at, reviewed_by, review_comment, created_by, created_at, updated_at";

export const PLAN_ITEM_COLUMNS =
  "id, plan_id, workspace_id, branch_id, admin_unit_code, seq, item_code, asset_type, title, lot_labels, lot_count, map_sheet, parcel_no, location, area_m2, land_use_code, allocation_form, unit_start_price, expected_start_value, planned_month, planned_method, executing_unit, forecast_month, forecast_reason, responsible_user_id, asset_posting_id, listing_id, exec_status, exec_note, created_by, created_at, updated_at";

export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

/* ─── Đọc ─────────────────────────────────────────────────────────────────── */

export function useAuctionPlanList(workspaceId: string | null) {
  return useQuery<AuctionPlan[]>({
    queryKey: qk.auctionPlans(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plans")
        .select(PLAN_COLUMNS)
        .eq("workspace_id", workspaceId!)
        .order("plan_year", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuctionPlan[];
    },
  });
}

/** Chỉ các cột cần cho ô theo quý — không tải cả danh mục của mọi kế hoạch. */
type YearItem = Pick<AuctionPlanItem, "id" | "plan_id" | "planned_month" | "area_m2" | "expected_start_value" | "exec_status">;

function useAuctionPlanYearItems(workspaceId: string | null, planYear: number, planIds: string[]) {
  return useQuery<YearItem[]>({
    queryKey: qk.auctionPlanYearItems(workspaceId, planYear),
    enabled: !!workspaceId && planIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_items")
        .select("id, plan_id, planned_month, area_m2, expected_start_value, exec_status")
        .in("plan_id", planIds);
      if (error) throw error;
      return (data ?? []) as YearItem[];
    },
  });
}

/**
 * Đợt lập kế hoạch nhìn thấy được + danh sách đơn vị trong đợt. Hình B (xã có
 * Trạm riêng) thì đợt thuộc Trạm CHA, nên không lọc theo `workspace_id` — policy
 * đọc của bảng đã giới hạn đúng những đợt liên quan tới mình.
 */
function useAuctionPlanCycles(workspaceId: string | null) {
  return useQuery<{ cycles: AuctionPlanCycle[]; units: AuctionPlanCycleUnit[] }>({
    queryKey: qk.auctionPlanCycles(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_cycles")
        .select(
          "id, workspace_id, plan_year, kind, status, submit_deadline, instructions, attachment_urls, closed_at, created_by, created_at, updated_at",
        )
        .eq("status", "open")
        .order("plan_year", { ascending: false });
      if (error) throw error;
      const cycles = (data ?? []) as AuctionPlanCycle[];
      if (cycles.length === 0) return { cycles, units: [] };
      const { data: unitRows, error: unitError } = await (supabase as any)
        .from("auction_plan_cycle_units")
        .select(
          "id, cycle_id, workspace_id, admin_unit_code, branch_id, child_workspace_id, assigned_revenue, assigned_count, created_at, updated_at",
        )
        .in("cycle_id", cycles.map((c) => c.id));
      if (unitError) throw unitError;
      return { cycles, units: (unitRows ?? []) as AuctionPlanCycleUnit[] };
    },
  });
}

/** Mã ĐVHC của chính Trạm (gắn ở Phase 1) — chưa có trong types tự sinh. */
export function useWorkspaceAdminUnitCode(workspaceId: string | null) {
  return useQuery<string | null>({
    queryKey: ["asset-owner-workspaces", workspaceId, "admin-unit-code"],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("asset_owner_workspaces")
        .select("admin_unit_code")
        .eq("id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.admin_unit_code ?? null) as string | null;
    },
  });
}

/** Một lựa chọn "đơn vị lập kế hoạch" trong hộp thoại Tạo kế hoạch. */
export interface PlanUnitOption {
  /** null = toàn đơn vị (chính Trạm). */
  branchId: string | null;
  label: string;
  /** Chưa gắn ⇒ trigger của DB sẽ chặn, nên hộp thoại báo trước. */
  adminUnitCode: string | null;
  level: AuctionPlanLevel;
}

/** Toàn bộ dữ liệu trang danh sách, cho MỘT năm đang chọn. */
export function useAuctionPlansBoard(planYear: number) {
  const { workspaceId, isScoped, branchScope, can, canIn, isLoading: wsLoading } = useOwnerWorkspace();
  const plansQuery = useAuctionPlanList(workspaceId);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const plansOfYear = useMemo(() => plans.filter((p) => p.plan_year === planYear), [plans, planYear]);
  const itemsQuery = useAuctionPlanYearItems(workspaceId, planYear, plansOfYear.map((p) => p.id));
  const cyclesQuery = useAuctionPlanCycles(workspaceId);
  const { branches, branchesLoading } = useWorkspaceBranches(workspaceId);
  const wsUnitCode = useWorkspaceAdminUnitCode(workspaceId);

  const unitOptions = useMemo<PlanUnitOption[]>(() => {
    const inScope = (id: string) => !isScoped || (branchScope ?? []).includes(id);
    const branchOptions = branches
      .filter((b) => b.is_active && inScope(b.id))
      .map<PlanUnitOption>((b) => ({
        branchId: b.id,
        label: b.display_name || b.asset_owner_name || "Chi nhánh",
        adminUnitCode: b.admin_unit_code,
        level: adminUnitLevelOfCode(b.admin_unit_code) === "province" ? "province" : "commune",
      }));
    // Người bị giới hạn chi nhánh không lập kế hoạch cho toàn đơn vị được.
    if (isScoped) return branchOptions;
    const code = wsUnitCode.data ?? null;
    return [
      {
        branchId: null,
        label: "Toàn đơn vị",
        adminUnitCode: code,
        level: adminUnitLevelOfCode(code) === "province" ? "province" : "commune",
      },
      ...branchOptions,
    ];
  }, [branches, isScoped, branchScope, wsUnitCode.data]);

  /** Đợt của đơn vị đang xem — toàn đơn vị khi không bị giới hạn, chi nhánh đầu phạm vi khi có. */
  const cycle = useMemo<PlanCycleContext | null>(() => {
    if (!workspaceId || !cyclesQuery.data) return null;
    const refs = unitOptions.map((u) => ({ workspaceId, branchId: u.branchId }));
    for (const ref of refs.length ? refs : [{ workspaceId, branchId: null }]) {
      const hit = cycleForUnit(cyclesQuery.data.cycles, cyclesQuery.data.units, ref, planYear);
      if (hit?.unit) return hit;
    }
    return cycleForUnit(cyclesQuery.data.cycles, cyclesQuery.data.units, { workspaceId, branchId: null }, planYear);
  }, [workspaceId, cyclesQuery.data, unitOptions, planYear]);

  const branchLabel = useMemo(() => {
    const map = new Map<string, string>(branches.map((b) => [b.id, b.display_name || b.asset_owner_name || "Chi nhánh"]));
    return (branchId: string | null) => (branchId ? map.get(branchId) ?? "Chi nhánh đã xoá" : "Toàn đơn vị");
  }, [branches]);

  return {
    workspaceId,
    plans,
    plansOfYear,
    years: planYears(plans, Number(todayIso().slice(0, 4))),
    yearItems: itemsQuery.data ?? [],
    cycle,
    unitOptions,
    branchLabel,
    canCreate: can("ke-hoach", "create"),
    canUpdateIn: (branchId: string | null) => canIn("ke-hoach", "update", branchId),
    today: todayIso(),
    isLoading: wsLoading || (!!workspaceId && (plansQuery.isLoading || branchesLoading)),
    itemsLoading: itemsQuery.isLoading,
    isError: plansQuery.isError,
    refetch: (): void => {
      void plansQuery.refetch();
    },
  };
}

/* ─── Tạo kế hoạch ────────────────────────────────────────────────────────── */

export interface CreatePlanInput {
  branchId: string | null;
  planYear: number;
  kind: AuctionPlanKind;
  level: AuctionPlanLevel;
  /** Rỗng ⇒ DB / UI tự đặt tên theo `auctionPlanAutoTitle`. */
  title: string | null;
  legalBasis: string | null;
  notes: string | null;
  cycleId: string | null;
}

export function useCreateAuctionPlan(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput): Promise<AuctionPlan> => {
      // `admin_unit_code` CỐ TÌNH bỏ trống: trigger suy ra từ chi nhánh, rồi tới
      // Trạm, và báo "Chưa gán đơn vị hành chính…" nếu cả hai đều chưa gắn.
      const payload = {
        workspace_id: workspaceId,
        branch_id: input.branchId,
        cycle_id: input.cycleId,
        plan_year: input.planYear,
        kind: input.kind,
        title: input.title,
        level: input.level,
        legal_basis: input.legalBasis,
        notes: input.notes,
      };
      const { data, error } = await (supabase as any)
        .from("auction_plans")
        .insert(payload)
        .select(PLAN_COLUMNS)
        .single();
      if (error) throw new Error(auctionPlanWriteMessage(error));
      return data as AuctionPlan;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId) });
      toast.success("Đã tạo kế hoạch");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

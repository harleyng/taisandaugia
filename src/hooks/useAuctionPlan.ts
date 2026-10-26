/* eslint-disable @typescript-eslint/no-explicit-any */
// Dữ liệu + thao tác của MỘT kế hoạch đấu giá (/chu-tai-san/ke-hoach/:id).
//
// ⚠️ `(supabase as any)` ở mọi truy vấn `auction_plan_*` — xem đầu
// `useAuctionPlans.ts` để biết vì sao (types.ts chưa sinh lại được).
//
// ⚠️ Quyền CỘT là cái dễ vỡ nhất ở đây. `auction_plan_items` chỉ cho client gửi
// các cột trong `ITEM_INSERT_KEYS`; `workspace_id` / `branch_id` /
// `admin_unit_code` / `seq` / `item_code` do trigger ép hoặc tự sinh. Vì thế
// payload luôn được DỰNG TƯỜNG MINH từ form — không bao giờ spread một dòng đã
// đọc vào `update`, dù nó trông tiện.
//
// ⚠️ `auction_plan_item_steps` TỰ SINH khi thêm tài sản (template theo
// `asset_type`). Không insert mốc ở đây; sửa mốc là việc của Phase 5.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { PLAN_COLUMNS, PLAN_ITEM_COLUMNS } from "@/hooks/useAuctionPlans";
import { assertAuctionPlanRpcOk, auctionPlanWriteMessage } from "@/lib/auctionPlan/rpc";
import { isAuctionPlanBaselineOpen } from "@/lib/auctionPlan/types";
import type {
  AuctionPlan,
  AuctionPlanAllocationForm,
  AuctionPlanAssetType,
  AuctionPlanItem,
  AuctionPlanMethod,
} from "@/lib/auctionPlan/types";
import type { PlanItemImportPayload } from "@/lib/auctionPlan/itemsImport";

/* ─── Đọc ─────────────────────────────────────────────────────────────────── */

export function useAuctionPlan(planId: string | undefined) {
  return useQuery<AuctionPlan | null>({
    queryKey: qk.auctionPlan(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plans")
        .select(PLAN_COLUMNS)
        .eq("id", planId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AuctionPlan | null;
    },
  });
}

export function useAuctionPlanItems(planId: string | undefined) {
  return useQuery<AuctionPlanItem[]>({
    queryKey: qk.auctionPlanItems(planId),
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_items")
        .select(PLAN_ITEM_COLUMNS)
        .eq("plan_id", planId!)
        .order("seq", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuctionPlanItem[];
    },
  });
}

/**
 * Trang chi tiết: kế hoạch + danh mục + quyền. Quyền xét theo chi nhánh CỦA KẾ
 * HOẠCH (`canIn`), không theo không gian đang chọn — trang mở được từ link.
 */
export function useAuctionPlanDetail(planId: string | undefined) {
  const { workspaceId, canIn, isLoading: wsLoading } = useOwnerWorkspace();
  const planQuery = useAuctionPlan(planId);
  const itemsQuery = useAuctionPlanItems(planId);
  const plan = planQuery.data ?? null;
  const branchId = plan?.branch_id ?? null;
  const baselineOpen = !!plan && isAuctionPlanBaselineOpen(plan.status);

  return {
    workspaceId,
    plan,
    items: itemsQuery.data ?? [],
    /** Sửa được trường MỐC: quyền + kế hoạch đang ở draft / adjusting (trigger của DB là cổng thật). */
    canEditBaseline: baselineOpen && canIn("ke-hoach", "update", branchId),
    canDelete: baselineOpen && canIn("ke-hoach", "delete", branchId),
    canCreateItem: baselineOpen && canIn("ke-hoach", "create", branchId),
    canFinalize: canIn("ke-hoach", "finalize", branchId),
    canReopen: canIn("ke-hoach", "update", branchId),
    /** Sửa MỐC CÔNG VIỆC + trường THỰC HIỆN: không phụ thuộc trạng thái kế hoạch (A4.3). */
    canUpdateExec: canIn("ke-hoach", "update", branchId),
    /** "Tạo chỉ tiêu từ kế hoạch" (Phase 6) — quyền của module CHỈ TIÊU, đúng chi nhánh của kế hoạch. */
    canCreateTarget: canIn("chi-tieu", "create", branchId),
    baselineOpen,
    isLoading: wsLoading || planQuery.isLoading,
    itemsLoading: itemsQuery.isLoading,
    isError: planQuery.isError,
    refetch: () => {
      void planQuery.refetch();
      void itemsQuery.refetch();
    },
  };
}

/* ─── Ghi: tài sản trong kế hoạch ─────────────────────────────────────────── */

/** Trường MỐC của một tài sản — khớp 1:1 với các cột client được gửi. */
export interface PlanItemFormValues {
  asset_type: AuctionPlanAssetType;
  title: string;
  lot_labels: string | null;
  lot_count: number | null;
  map_sheet: string | null;
  parcel_no: string | null;
  location: string | null;
  area_m2: number | null;
  land_use_code: string | null;
  allocation_form: AuctionPlanAllocationForm | null;
  unit_start_price: number | null;
  expected_start_value: number | null;
  planned_month: string | null;
  planned_method: AuctionPlanMethod;
  executing_unit: string | null;
}

/** Dựng tường minh — thứ tự này là bản sao danh sách GRANT, đừng thay bằng spread. */
const itemWritePayload = (v: PlanItemFormValues) => ({
  asset_type: v.asset_type,
  title: v.title,
  lot_labels: v.lot_labels,
  lot_count: v.lot_count,
  map_sheet: v.map_sheet,
  parcel_no: v.parcel_no,
  location: v.location,
  area_m2: v.area_m2,
  land_use_code: v.land_use_code,
  allocation_form: v.allocation_form,
  unit_start_price: v.unit_start_price,
  expected_start_value: v.expected_start_value,
  planned_month: v.planned_month,
  planned_method: v.planned_method,
  executing_unit: v.executing_unit,
});

/** Làm mới kế hoạch (phủ cả danh mục + mốc) và danh sách kế hoạch của Trạm. */
function usePlanInvalidate(planId: string | undefined, workspaceId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.auctionPlan(planId) });
    void qc.invalidateQueries({ queryKey: qk.auctionPlans(workspaceId) });
  };
}

export function useSavePlanItem(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async ({ itemId, values }: { itemId: string | null; values: PlanItemFormValues }) => {
      const payload = itemWritePayload(values);
      const q = itemId
        ? (supabase as any).from("auction_plan_items").update(payload).eq("id", itemId)
        : (supabase as any).from("auction_plan_items").insert({ plan_id: plan!.id, ...payload });
      const { error } = await q;
      if (error) throw new Error(auctionPlanWriteMessage(error));
    },
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.itemId ? "Đã lưu tài sản" : "Đã thêm tài sản vào kế hoạch");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlanItem(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase as any).from("auction_plan_items").delete().eq("id", itemId);
      if (error) throw new Error(auctionPlanWriteMessage(error));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá tài sản khỏi kế hoạch");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Nhập nhiều tài sản một lần (từ Excel hoặc chuyển tiếp năm trước). MỘT câu
 * insert: trigger cấp `item_code` khoá dòng kế hoạch, nên cả lô vào trong một
 * giao dịch — hoặc ghi hết, hoặc không dòng nào, không có nửa vời.
 */
export function useImportPlanItems(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async (rows: readonly PlanItemImportPayload[]): Promise<number> => {
      if (rows.length === 0) return 0;
      const payload = rows.map((r) => ({
        plan_id: plan!.id,
        asset_type: r.asset_type,
        title: r.title,
        lot_labels: r.lot_labels,
        location: r.location,
        area_m2: r.area_m2,
        unit_start_price: r.unit_start_price,
        expected_start_value: r.expected_start_value,
        planned_month: r.planned_month,
      }));
      const { error } = await (supabase as any).from("auction_plan_items").insert(payload);
      if (error) throw new Error(auctionPlanWriteMessage(error));
      return payload.length;
    },
    onSuccess: (written) => {
      invalidate();
      if (written > 0) toast.success(`Đã ghi ${written} tài sản vào kế hoạch`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ─── Ghi: chuyển trạng thái (chỉ qua RPC) ────────────────────────────────── */

export function useSubmitPlan(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_submit", { p_plan_id: plan!.id });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
      return data as { item_count?: number; adjustment?: boolean };
    },
    onSuccess: (data) => {
      invalidate();
      toast.success(
        data?.adjustment
          ? "Đã trình bản điều chỉnh lên cấp trên"
          : `Đã trình kế hoạch${data?.item_count ? ` · ${data.item_count} tài sản` : ""}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * `returned → draft`. Tồn tại vì `returned` KHÔNG mở khoá trường mốc: kế hoạch
 * bị trả lại phải mở lại trước khi sửa được một dòng nào.
 */
export function useReopenPlan(plan: AuctionPlan | null) {
  const invalidate = usePlanInvalidate(plan?.id, plan?.workspace_id ?? null);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("auction_plan_reopen", { p_plan_id: plan!.id });
      if (error) throw error;
      assertAuctionPlanRpcOk(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã mở lại kế hoạch để sửa");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

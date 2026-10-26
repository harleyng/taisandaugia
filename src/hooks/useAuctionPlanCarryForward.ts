/* eslint-disable @typescript-eslint/no-explicit-any */
// "Chuyển tiếp từ năm trước": mang tài sản dở dang của kế hoạch năm trước sang
// kế hoạch đang lập.
//
// ⚠️ `(supabase as any)` — xem đầu `useAuctionPlans.ts`.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { PLAN_ITEM_COLUMNS, useAuctionPlanList } from "@/hooks/useAuctionPlans";
import type { AuctionPlan, AuctionPlanAssetType, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { planHealthToday, planItemHealth } from "@/lib/auctionPlan/health";
import { groupStepsByItem } from "@/lib/auctionPlan/steps";
import type { PlanItemImportPayload } from "@/lib/auctionPlan/itemsImport";

export interface CarryForwardCandidate {
  id: string;
  itemCode: string;
  title: string;
  lotLabels: string | null;
  areaM2: number | null;
  location: string | null;
  unitStartPrice: number | null;
  expectedStartValue: number | null;
  assetType: AuctionPlanAssetType;
}

const toCandidate = (it: AuctionPlanItem): CarryForwardCandidate => ({
  id: it.id,
  itemCode: it.item_code,
  title: it.title,
  lotLabels: it.lot_labels,
  areaM2: it.area_m2,
  location: it.location,
  unitStartPrice: it.unit_start_price,
  expectedStartValue: it.expected_start_value,
  assetType: it.asset_type,
});

export const carryForwardPayload = (c: CarryForwardCandidate): PlanItemImportPayload => ({
  asset_type: c.assetType,
  title: c.title,
  lot_labels: c.lotLabels,
  location: c.location,
  area_m2: c.areaM2,
  unit_start_price: c.unitStartPrice,
  expected_start_value: c.expectedStartValue,
  // Tháng dự kiến XOÁ TRẮNG: năm mới phải chọn lại kỳ, không kéo tháng cũ sang.
  planned_month: null,
});

/**
 * Tài sản của kế hoạch năm TRƯỚC (cùng đơn vị) còn DỞ = sức khoẻ A5 không thuộc
 * {`done`, `dropped`}.
 *
 * Phase 3 tạm suy "chưa xong" từ mốc `paid`; từ Phase 5 dùng `planItemHealth`
 * thật, nên tài sản "không thành · chờ đấu lại" cũng được chuyển tiếp (trước đây
 * bị bỏ sót nếu đã khai xong mốc `paid` của lượt trước).
 *
 * Tháng đối chiếu: `planned_month` hiện tại của tài sản. Kế hoạch năm trước ở
 * `approved` / `closed` nên trigger của DB đã khoá trường mốc ⇒ nó bằng tháng
 * của bản mốc; không cần tải `auction_plan_baselines` chỉ để lọc danh sách này.
 */
export function usePlanCarryForward(plan: AuctionPlan | null) {
  const plansQuery = useAuctionPlanList(plan?.workspace_id ?? null);
  const previousPlans = useMemo(
    () =>
      (plansQuery.data ?? []).filter(
        (p) => p.plan_year === (plan?.plan_year ?? 0) - 1 && (p.branch_id ?? null) === (plan?.branch_id ?? null),
      ),
    [plansQuery.data, plan?.plan_year, plan?.branch_id],
  );
  const planIds = previousPlans.map((p) => p.id);

  const query = useQuery<CarryForwardCandidate[]>({
    queryKey: [...qk.auctionPlan(plan?.id), "carry-forward", planIds.join(",")],
    enabled: !!plan && planIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auction_plan_items")
        .select(PLAN_ITEM_COLUMNS)
        .in("plan_id", planIds)
        .eq("exec_status", "active")
        .order("seq", { ascending: true });
      if (error) throw error;
      const items = (data ?? []) as AuctionPlanItem[];
      if (items.length === 0) return [];

      const { data: steps, error: stepError } = await (supabase as any)
        .from("auction_plan_item_steps")
        .select("item_id, sort_order, planned_date, done_on")
        .in("plan_id", planIds);
      if (stepError) throw stepError;
      const byItem = groupStepsByItem((steps ?? []) as Array<{ item_id: string; sort_order: number; planned_date: string | null; done_on: string | null }>);

      const outcomes = new Map<string, { outcome: string | null; payment_status: string | null }>();
      for (const planId of planIds) {
        const { data: rows, error: outcomeError } = await (supabase as any).rpc("auction_plan_item_outcomes", {
          p_plan_id: planId,
        });
        if (outcomeError) throw outcomeError;
        for (const r of (rows ?? []) as Array<{ item_id: string; outcome: string | null; payment_status: string | null }>) {
          outcomes.set(r.item_id, { outcome: r.outcome, payment_status: r.payment_status });
        }
      }

      const asOf = planHealthToday();
      return items
        .filter((it) => {
          const health = planItemHealth(it, byItem.get(it.id) ?? [], outcomes.get(it.id) ?? null, asOf);
          return health !== "done" && health !== "dropped";
        })
        .map(toCandidate);
    },
  });

  return {
    previousYear: (plan?.plan_year ?? 0) - 1,
    hasPreviousPlan: planIds.length > 0,
    candidates: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { unwrapSubRpc } from "@/lib/ownerSubscription/errors";
import type {
  OwnerSubPlan,
  OwnerSubPlanQuote,
  OwnerSubTermOption,
  PayOwnerSubPlanResult,
  PlanBenefitLine,
  SubBenefitDef,
} from "@/lib/ownerSubscription/types";

export interface OwnerSubCatalog {
  plans: OwnerSubPlan[];
  terms: OwnerSubTermOption[];
}

/** Dòng quyền lợi của gói kèm định nghĩa trong danh mục cố định owner_sub_benefits. */
export const BENEFITS_SELECT =
  "benefits:owner_subscription_plan_entitlements(benefit_key, quota, cycle, sort_order, benefit:owner_sub_benefits(*))";

type PlanRow = Record<string, unknown> & { monthly_price_vnd: number | string; benefits: PlanBenefitLine[] | null };

/** Chuẩn hoá một dòng gói (giá NUMERIC về number, quyền lợi theo thứ tự hiển thị). */
export const normalizePlan = (p: PlanRow, featured: boolean): OwnerSubPlan =>
  ({
    ...p,
    monthly_price_vnd: Number(p.monthly_price_vnd),
    is_featured: featured,
    benefits: [...(p.benefits ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }) as unknown as OwnerSubPlan;

/**
 * Danh mục Trạm thấy: gói đang bán của BỘ GÓI của Trạm (bộ được gán, chưa gán thì bộ mặc
 * định) + các kỳ của bộ. Bộ ngừng bán ⇒ rỗng. Server lọc (owner_sub_catalog).
 */
export async function fetchOwnerSubCatalog(workspaceId: string): Promise<OwnerSubCatalog> {
  const { data, error } = await supabase.rpc("owner_sub_catalog", { p_workspace_id: workspaceId });
  if (error) throw error;
  const res = (data ?? {}) as unknown as { plans?: (PlanRow & { is_featured: boolean })[]; terms?: OwnerSubTermOption[] };
  return {
    plans: (res.plans ?? []).map((p) => normalizePlan(p, !!p.is_featured)),
    terms: (res.terms ?? []).map((t) => ({ months: t.months, discount_pct: Number(t.discount_pct), is_active: true })),
  };
}

/** Danh mục quyền lợi cố định (form gói admin chọn từ đây) — không có màn sửa. */
export function useOwnerSubBenefitCatalog() {
  return useQuery({
    queryKey: qk.ownerSubscription.benefitCatalog,
    queryFn: async () => {
      const { data, error } = await supabase.from("owner_sub_benefits").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as SubBenefitDef[];
    },
    staleTime: Infinity,
  });
}

/** Danh mục gói đang bán của bộ gói của Trạm (cổng chủ tài sản). */
export function useOwnerSubPlans(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.ownerSubscription.plansFor(workspaceId),
    enabled: !!workspaceId,
    queryFn: () => fetchOwnerSubCatalog(workspaceId!),
    staleTime: 5 * 60 * 1000,
  });
}

/** Báo giá một lượt mua gói danh mục cho Trạm (trang VNPay mô phỏng). */
export function useOwnerSubPlanQuote(
  workspaceId: string | null | undefined,
  planId: string | null | undefined,
  months: number | null | undefined,
) {
  return useQuery({
    queryKey: qk.ownerSubscription.planQuote(workspaceId, planId, months),
    enabled: !!workspaceId && !!planId && !!months,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_sub_plan_quote", {
        p_workspace_id: workspaceId!,
        p_plan_id: planId!,
        p_months: months!,
      });
      if (error) throw error;
      const q = (data ?? {}) as unknown as OwnerSubPlanQuote;
      return q.ok ? q : null;
    },
  });
}

/**
 * Ghi nhận thanh toán gói danh mục (⚠️ MÔ PHỎNG — IPN thật sẽ gọi _settle_owner_sub_plan).
 * Idempotent ở server theo mã giao dịch.
 */
export function usePayOwnerSubPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      workspaceId: string;
      planId: string;
      months: number;
      txnRef: string;
      expectedAmount: number;
    }) => {
      const { data, error } = await supabase.rpc("pay_owner_sub_plan", {
        p_workspace_id: args.workspaceId,
        p_plan_id: args.planId,
        p_months: args.months,
        p_txn_ref: args.txnRef,
        p_expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapSubRpc(data) as unknown as PayOwnerSubPlanResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.all }),
  });
}

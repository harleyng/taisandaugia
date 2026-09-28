import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { unwrapSubRpc } from "@/lib/ownerSubscription/errors";
import type {
  OwnerSubPlan,
  OwnerSubPlanQuote,
  OwnerSubTermOption,
  PayOwnerSubPlanResult,
  PlanBenefit,
  PlanEntitlement,
} from "@/lib/ownerSubscription/types";

export interface OwnerSubCatalog {
  plans: OwnerSubPlan[];
  terms: OwnerSubTermOption[];
}

/**
 * Đọc danh mục gói + các kỳ. RLS: người dùng thường chỉ thấy gói đang bán; admin
 * (goi-thue-bao:view) thấy cả gói đã ngừng — `activeOnly` lọc lại cho cổng chủ tài sản.
 */
export async function fetchOwnerSubCatalog(activeOnly: boolean): Promise<OwnerSubCatalog> {
  let plansQuery = supabase
    .from("owner_subscription_plans")
    .select("*, entitlements:owner_subscription_plan_entitlements(variant_key, monthly_quota)")
    .order("sort_order")
    .order("created_at");
  if (activeOnly) plansQuery = plansQuery.eq("is_active", true);
  let termsQuery = supabase.from("owner_subscription_term_options").select("*").order("months");
  if (activeOnly) termsQuery = termsQuery.eq("is_active", true);

  const [plansRes, termsRes] = await Promise.all([plansQuery, termsQuery]);
  if (plansRes.error) throw plansRes.error;
  if (termsRes.error) throw termsRes.error;

  const plans = (plansRes.data ?? []).map((p) => ({
    ...p,
    monthly_price_vnd: Number(p.monthly_price_vnd),
    benefits: (p.benefits ?? []) as unknown as PlanBenefit[],
    entitlements: (p.entitlements ?? []) as unknown as PlanEntitlement[],
  })) as OwnerSubPlan[];
  const terms = (termsRes.data ?? []).map((t) => ({
    months: t.months,
    discount_pct: Number(t.discount_pct),
    is_active: t.is_active,
  }));
  return { plans, terms };
}

/** Danh mục gói đang bán (cổng chủ tài sản). */
export function useOwnerSubPlans() {
  return useQuery({
    queryKey: qk.ownerSubscription.plans,
    queryFn: () => fetchOwnerSubCatalog(true),
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

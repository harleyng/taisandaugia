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
const BENEFITS_SELECT =
  "benefits:owner_subscription_plan_entitlements(benefit_key, quota, cycle, sort_order, benefit:owner_sub_benefits(*))";

type CatalogScope = { admin: true } | { workspaceId: string };

/**
 * Đọc danh mục gói + các kỳ.
 *   • `{ admin: true }` — mọi gói (kể cả đã ngừng bán) kèm danh sách Trạm được dùng.
 *   • `{ workspaceId }` — chỉ gói đang bán mà admin đã MỞ cho Trạm đó (gói không có
 *     Trạm nào là gói ẩn). RLS còn cho đọc gói hiện tại của Trạm, nhưng join `!inner`
 *     loại nó khỏi danh mục nếu Trạm đã bị gỡ khỏi gói.
 */
export async function fetchOwnerSubCatalog(scope: CatalogScope): Promise<OwnerSubCatalog> {
  const admin = "admin" in scope;
  const select = admin
    ? `*, ${BENEFITS_SELECT}, workspaces:owner_subscription_plan_workspaces(workspace_id)`
    : `*, ${BENEFITS_SELECT}, access:owner_subscription_plan_workspaces!inner(workspace_id)`;
  let plansQuery = supabase.from("owner_subscription_plans").select(select).order("sort_order").order("created_at");
  if (!admin) plansQuery = plansQuery.eq("is_active", true).eq("access.workspace_id", scope.workspaceId);
  let termsQuery = supabase.from("owner_subscription_term_options").select("*").order("months");
  if (!admin) termsQuery = termsQuery.eq("is_active", true);

  const [plansRes, termsRes] = await Promise.all([plansQuery, termsQuery]);
  if (plansRes.error) throw plansRes.error;
  if (termsRes.error) throw termsRes.error;

  type PlanRow = Record<string, unknown> & {
    monthly_price_vnd: number;
    benefits: PlanBenefitLine[] | null;
    workspaces?: { workspace_id: string }[];
    access?: unknown;
  };
  const plans = ((plansRes.data ?? []) as unknown as PlanRow[]).map(({ access: _access, workspaces, ...p }) => ({
    ...p,
    monthly_price_vnd: Number(p.monthly_price_vnd),
    benefits: [...(p.benefits ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    ...(admin ? { workspace_ids: (workspaces ?? []).map((w) => w.workspace_id) } : {}),
  })) as unknown as OwnerSubPlan[];
  const terms = (termsRes.data ?? []).map((t) => ({
    months: t.months,
    discount_pct: Number(t.discount_pct),
    is_active: t.is_active,
  }));
  return { plans, terms };
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

/** Danh mục gói đang bán mà admin đã mở cho Trạm (cổng chủ tài sản). */
export function useOwnerSubPlans(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.ownerSubscription.plansFor(workspaceId),
    enabled: !!workspaceId,
    queryFn: () => fetchOwnerSubCatalog({ workspaceId: workspaceId! }),
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

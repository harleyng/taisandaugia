import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { subErrorMessage, unwrapSubRpc } from "@/lib/ownerSubscription/errors";
import { fetchOwnerSubCatalog } from "@/hooks/useOwnerSubscriptionPlans";
import type {
  ActivationMethod,
  AdminOwnerSubRow,
  EntitlementInput,
  OverageMode,
  OwnerSubscriptionStatus,
  OwnerSubTermOption,
  PlanBenefit,
  PlanTier,
} from "@/lib/ownerSubscription/types";

/** Mọi Trạm tổ chức kèm gói (nếu có). Admin không đọc được bảng Trạm ⇒ đi qua RPC. */
export function useAdminOwnerSubscriptionList() {
  return useQuery({
    queryKey: qk.adminOwnerSubscriptions.all,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_owner_subscription_list");
      if (error) throw error;
      return (data ?? []) as unknown as AdminOwnerSubRow[];
    },
  });
}

export interface AdminSubTerm {
  id: string;
  starts_on: string;
  ends_on: string;
  months: number;
  amount_vnd: number;
  source: "vnpay" | "manual";
  method: ActivationMethod | null;
  paid_on: string | null;
  note: string | null;
  created_at: string;
  order: { code: string | null } | null;
}

export interface AdminSubEvent {
  id: string;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AdminSubUsage {
  id: string;
  variant_key: string;
  period_month: string;
  qty: number;
  ref_type: string;
  ref_id: string | null;
  reverses_id: string | null;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export interface AdminSubDetail {
  sub: {
    id: string;
    code: string | null;
    plan_name: string;
    price_vnd: number;
    term_months: number;
    overage_mode: OverageMode;
    status: string;
    starts_on: string | null;
    ends_on: string | null;
    note: string | null;
    cancel_reason: string | null;
  } | null;
  entitlements: EntitlementInput[];
  /** Trạng thái hiệu lực + số đã dùng tháng này (cùng RPC với cổng chủ tài sản). */
  status: OwnerSubscriptionStatus | null;
  terms: AdminSubTerm[];
  events: AdminSubEvent[];
  usage: AdminSubUsage[];
  /** id → tên hiển thị của người thao tác (usage + events). */
  actors: Record<string, string>;
}

/** Chi tiết gói của một Trạm cho màn admin. */
export function useAdminOwnerSubscriptionDetail(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.adminOwnerSubscriptions.detail(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<AdminSubDetail> => {
      const { data: sub, error } = await supabase
        .from("owner_subscriptions")
        .select("id, code, plan_name, price_vnd, term_months, overage_mode, status, starts_on, ends_on, note, cancel_reason")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      if (!sub) {
        return { sub: null, entitlements: [], status: null, terms: [], events: [], usage: [], actors: {} };
      }

      const [ents, terms, events, usage, status] = await Promise.all([
        supabase.from("owner_subscription_entitlements").select("variant_key, monthly_quota").eq("subscription_id", sub.id),
        supabase
          .from("owner_subscription_terms")
          .select("id, starts_on, ends_on, months, amount_vnd, source, method, paid_on, note, created_at, order:orders(code)")
          .eq("subscription_id", sub.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("owner_subscription_events")
          .select("id, event_type, actor_id, payload, created_at")
          .eq("subscription_id", sub.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("owner_subscription_usage")
          .select("id, variant_key, period_month, qty, ref_type, ref_id, reverses_id, actor_id, note, created_at")
          .eq("subscription_id", sub.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.rpc("owner_subscription_status", { p_workspace_id: workspaceId! }),
      ]);
      for (const r of [ents, terms, events, usage, status]) if (r.error) throw r.error;

      const actorIds = [
        ...new Set(
          [...(usage.data ?? []), ...(events.data ?? [])].map((r) => r.actor_id).filter((x): x is string => !!x),
        ),
      ];
      const actors: Record<string, string> = {};
      if (actorIds.length) {
        const { data: people } = await supabase.from("profiles").select("id, name, email").in("id", actorIds);
        for (const p of people ?? []) actors[p.id] = p.name || p.email || p.id.slice(0, 8);
      }

      return {
        sub: sub as AdminSubDetail["sub"],
        entitlements: (ents.data ?? []) as EntitlementInput[],
        status: (status.data ?? null) as unknown as OwnerSubscriptionStatus | null,
        terms: (terms.data ?? []) as unknown as AdminSubTerm[],
        events: (events.data ?? []) as unknown as AdminSubEvent[],
        usage: (usage.data ?? []) as AdminSubUsage[],
        actors,
      };
    },
  });
}

function useInvalidateSubs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.adminOwnerSubscriptions.all });
    queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.all });
  };
}

export interface UpsertSubInput {
  workspaceId: string;
  planName: string;
  priceVnd: number;
  termMonths: number;
  overageMode: OverageMode;
  entitlements: EntitlementInput[];
  note: string;
}

export function useUpsertOwnerSubscription() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: async (input: UpsertSubInput) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_upsert", {
        p_workspace_id: input.workspaceId,
        p_plan_name: input.planName,
        p_price_vnd: input.priceVnd,
        p_term_months: input.termMonths,
        p_overage_mode: input.overageMode,
        p_entitlements: input.entitlements as unknown as Json,
        p_note: input.note,
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu cấu hình gói");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

const STATUS_TOASTS: Record<string, string> = {
  offered: "Đã gửi chào gói cho tổ chức",
  draft: "Đã thu hồi gói về nháp",
  cancelled: "Đã huỷ gói",
};

export function useSetOwnerSubscriptionStatus() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: async (args: { subId: string; status: "offered" | "draft" | "cancelled"; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_set_status", {
        p_sub_id: args.subId,
        p_status: args.status,
        p_reason: args.reason ?? "",
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: (_d, args) => {
      invalidate();
      toast.success(STATUS_TOASTS[args.status] ?? "Đã cập nhật");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

export interface ActivateSubInput {
  subId: string;
  months: number;
  startsOn: string | null;
  amountVnd: number;
  method: ActivationMethod;
  paidOn: string | null;
  note: string;
}

export function useActivateOwnerSubscription() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: async (input: ActivateSubInput) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_activate", {
        p_sub_id: input.subId,
        p_months: input.months,
        p_starts_on: input.startsOn as string,
        p_amount_vnd: input.amountVnd,
        p_method: input.method,
        p_paid_on: input.paidOn as string,
        p_note: input.note,
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã kích hoạt / gia hạn gói");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

// ─── Danh mục gói dịch vụ ────────────────────────────────────────────────────

/** Mọi gói (kể cả đã ngừng bán) + mọi kỳ — trang /admin/goi-thue-bao/danh-muc. */
export function useAdminOwnerSubPlans() {
  return useQuery({
    queryKey: qk.adminOwnerSubscriptions.plans,
    queryFn: () => fetchOwnerSubCatalog(false),
  });
}

function useInvalidatePlans() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.adminOwnerSubscriptions.plans });
    queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.plans });
  };
}

export interface UpsertPlanInput {
  planId: string | null;
  name: string;
  fitLine: string;
  highlightLine: string;
  tier: PlanTier;
  monthlyPriceVnd: number;
  overageMode: OverageMode;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  entitlements: EntitlementInput[];
  benefits: PlanBenefit[];
}

export function useUpsertOwnerSubPlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: async (input: UpsertPlanInput) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_plan_upsert", {
        p_plan_id: input.planId as string,
        p_name: input.name,
        p_fit_line: input.fitLine,
        p_highlight_line: input.highlightLine,
        p_tier: input.tier,
        p_monthly_price_vnd: input.monthlyPriceVnd,
        p_overage_mode: input.overageMode,
        p_is_featured: input.isFeatured,
        p_is_active: input.isActive,
        p_sort_order: input.sortOrder,
        p_entitlements: input.entitlements as unknown as Json,
        p_benefits: input.benefits as unknown as Json,
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: (_d, input) => {
      invalidate();
      toast.success(input.planId ? "Đã lưu gói" : "Đã thêm gói vào danh mục");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

export function useSetOwnerSubTermOptions() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: async (options: OwnerSubTermOption[]) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_term_options_set", {
        p_options: options as unknown as Json,
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu thời hạn & chiết khấu");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

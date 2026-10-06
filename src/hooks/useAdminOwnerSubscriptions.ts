import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { subErrorMessage, unwrapSubRpc } from "@/lib/ownerSubscription/errors";
import { BENEFITS_SELECT, normalizePlan } from "@/hooks/useOwnerSubscriptionPlans";
import { type PackageDraft, type PlanDraft, packagePlansPayload, planPayload } from "@/lib/ownerSubscription/packages";
import type {
  ActivationMethod,
  AdminOwnerSubRow,
  AdminSubPackage,
  OverageMode,
  OwnerSubscriptionStatus,
  SubTerm,
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
  benefit_key: string;
  used_on: string;
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
        return { sub: null, status: null, terms: [], events: [], usage: [], actors: {} };
      }

      const [terms, events, usage, status] = await Promise.all([
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
          .select("id, benefit_key, used_on, qty, ref_type, ref_id, reverses_id, actor_id, note, created_at")
          .eq("subscription_id", sub.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.rpc("owner_subscription_status", { p_workspace_id: workspaceId! }),
      ]);
      for (const r of [terms, events, usage, status]) if (r.error) throw r.error;

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

/** Huỷ gói của một Trạm (bắt buộc lý do). Cấu hình gói chỉ còn sửa ở danh mục. */
export function useCancelOwnerSubscription() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: async (args: { subId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_set_status", {
        p_sub_id: args.subId,
        p_status: "cancelled",
        p_reason: args.reason,
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã huỷ gói");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

export interface ActivatePlanInput {
  workspaceId: string;
  planId: string;
  months: number;
  /** Chỉ dùng khi gói hiệu lực ngay (Trạm chưa có gói / hết hạn / đã huỷ). */
  startsOn: string | null;
  amountVnd: number;
  method: ActivationMethod;
  paidOn: string | null;
  note: string;
}

/** Kích hoạt / gia hạn TAY theo một gói danh mục đã mở cho Trạm. */
export function useActivateOwnerSubPlan() {
  const invalidate = useInvalidateSubs();
  return useMutation({
    mutationFn: async (input: ActivatePlanInput) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_plan_activate", {
        p_workspace_id: input.workspaceId,
        p_plan_id: input.planId,
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
    onSuccess: (data) => {
      invalidate();
      toast.success(data.effect === "next_term" ? "Đã ghi kỳ mới — gói mới áp dụng từ kỳ sau" : "Đã kích hoạt / gia hạn gói");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

// ─── Bộ gói + thư viện kỳ mua ────────────────────────────────────────────────

export interface AdminSubCatalog {
  /** Bộ mặc định đứng đầu, còn lại theo tên. */
  packages: AdminSubPackage[];
  /** Thư viện kỳ mua dùng chung. */
  terms: SubTerm[];
}

/** Mọi bộ gói (kể cả ngừng bán) + gói + kỳ + Trạm được gán — màn Danh mục gói. */
export function useAdminSubCatalog() {
  return useQuery({
    queryKey: qk.adminOwnerSubscriptions.packages,
    queryFn: async (): Promise<AdminSubCatalog> => {
      const [pkgRes, planRes, ptRes, pwRes, termRes] = await Promise.all([
        supabase.from("owner_sub_packages").select("*"),
        supabase.from("owner_subscription_plans").select(`*, ${BENEFITS_SELECT}`).order("sort_order").order("created_at"),
        supabase.from("owner_sub_package_terms").select("package_id, term_id"),
        supabase.from("owner_sub_package_workspaces").select("package_id, workspace_id"),
        supabase.from("owner_sub_term_library").select("id, months, discount_pct, note").order("months").order("discount_pct"),
      ]);
      for (const r of [pkgRes, planRes, ptRes, pwRes, termRes]) if (r.error) throw r.error;

      const packages = (pkgRes.data ?? [])
        .map((k) => ({
          id: k.id,
          name: k.name,
          description: k.description,
          is_default: k.is_default,
          is_active: k.is_active,
          featured_plan_id: k.featured_plan_id,
          updated_at: k.updated_at,
          plans: (planRes.data ?? [])
            .filter((p) => p.package_id === k.id)
            .map((p) => normalizePlan(p as unknown as Parameters<typeof normalizePlan>[0], p.id === k.featured_plan_id)),
          term_ids: (ptRes.data ?? []).filter((t) => t.package_id === k.id).map((t) => t.term_id),
          workspace_ids: (pwRes.data ?? []).filter((w) => w.package_id === k.id).map((w) => w.workspace_id),
        }))
        .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, "vi"));
      const terms = (termRes.data ?? []).map((t) => ({ ...t, discount_pct: Number(t.discount_pct) }));
      return { packages, terms };
    },
  });
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.adminOwnerSubscriptions.all });
    queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.plans });
  };
}

/** Tạo / lưu bộ gói (thông tin, gói mới + thứ tự, "Phổ biến", kỳ, Trạm) — một giao dịch. */
export function useSavePackage() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async (d: PackageDraft) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_package_save", {
        p_package_id: d.id as string,
        p_name: d.name.trim(),
        p_description: d.description.trim(),
        p_is_active: d.is_active,
        p_term_ids: d.term_ids,
        p_workspace_ids: d.is_default ? [] : d.workspace_ids,
        p_plans: packagePlansPayload(d) as unknown as Json,
      });
      if (error) throw error;
      return unwrapSubRpc(data) as { package_id: string; created: boolean };
    },
    onSuccess: (_d, draft) => {
      invalidate();
      toast.success(draft.id ? `Đã lưu bộ “${draft.name.trim()}”` : `Đã tạo bộ “${draft.name.trim()}”`);
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

/** Lưu một gói của bộ ĐÃ CÓ (trang Sửa gói) — có hiệu lực ngay, không chờ lưu bộ. */
export function useSavePlan() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async ({ packageId, plan }: { packageId: string; plan: PlanDraft }) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_plan_save", {
        p_package_id: packageId,
        p_plan_id: plan.id as string,
        p_plan: planPayload(plan) as unknown as Json,
      });
      if (error) throw error;
      return unwrapSubRpc(data) as { plan_id: string; created: boolean };
    },
    onSuccess: (_d, { plan }) => {
      invalidate();
      toast.success(`Đã lưu gói “${plan.name.trim()}”`);
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

export function useSaveTerm() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async (t: { id: string | null; months: number; discountPct: number; note: string }) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_term_save", {
        p_term_id: t.id as string,
        p_months: t.months,
        p_discount_pct: t.discountPct,
        p_note: t.note,
      });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: (_d, t) => {
      invalidate();
      toast.success(t.id ? "Đã lưu kỳ mua" : "Đã thêm kỳ mua");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

export function useDeleteTerm() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async (termId: string) => {
      const { data, error } = await supabase.rpc("admin_owner_sub_term_delete", { p_term_id: termId });
      if (error) throw error;
      return unwrapSubRpc(data);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá kỳ mua");
    },
    onError: (err) => toast.error(subErrorMessage(err)),
  });
}

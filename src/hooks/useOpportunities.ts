import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Opportunity,
  OpportunityStage,
  OpportunityUpsert,
  WinOpportunityResult,
} from "@/types/opportunities";
import { qk } from "@/lib/queryKeys";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const oppTable = () => (supabase as any).from("opportunities");

const OPP_SELECT =
  "*, lead:leads(id,code,name), customer:customers(id,code,name), " +
  "service:services(id,name,kind), assignee:profiles(id,name,email)";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useOpportunities() {
  return useQuery<Opportunity[]>({
    queryKey: qk.opportunities.all,
    queryFn: async () => {
      const { data, error } = await oppTable()
        .select(OPP_SELECT)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Opportunity[];
    },
  });
}

export function useOpportunity(id?: string) {
  return useQuery<Opportunity>({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      const { data, error } = await oppTable().select(OPP_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as Opportunity;
    },
    enabled: !!id,
  });
}

export function useLeadOpportunities(leadId?: string) {
  return useQuery<Opportunity[]>({
    queryKey: qk.opportunities.byLead(leadId),
    queryFn: async () => {
      const { data, error } = await oppTable().select(OPP_SELECT).eq("lead_id", leadId);
      if (error) throw error;
      return (data ?? []) as Opportunity[];
    },
    enabled: !!leadId,
  });
}

export function useCustomerOpportunities(customerId?: string) {
  return useQuery<Opportunity[]>({
    queryKey: qk.opportunities.byCustomer(customerId),
    queryFn: async () => {
      const { data, error } = await oppTable().select(OPP_SELECT).eq("customer_id", customerId);
      if (error) throw error;
      return (data ?? []) as Opportunity[];
    },
    enabled: !!customerId,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.opportunities.all });
  qc.invalidateQueries({ queryKey: qk.leads.all });
  qc.invalidateQueries({ queryKey: qk.customers.all });
  qc.invalidateQueries({ queryKey: qk.orders.all });
  qc.invalidateQueries({ queryKey: ["admin", "revenue-report"] });
}

export function useUpsertOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: OpportunityUpsert) => {
      if (id) {
        const { data, error } = await oppTable()
          .update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as Opportunity;
      }
      const { data, error } = await oppTable().insert(payload).select().single();
      if (error) throw error;
      return data as Opportunity;
    },
    onSuccess: (data: Opportunity) => {
      qc.invalidateQueries({ queryKey: qk.opportunities.all });
      qc.invalidateQueries({ queryKey: ["opportunity", data.id] });
    },
  });
}

export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await oppTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.opportunities.all }),
  });
}

/**
 * Đổi giai đoạn (kéo-thả trên bảng). Cập nhật LẠC QUAN rồi rollback nếu lỗi.
 *
 * KHÔNG dùng cho 'won' — chốt thắng đụng 4 bảng và phải đi qua
 * admin_win_opportunity (trigger opportunities_guard_won chặn UPDATE trần).
 */
export function useMoveOpportunityStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, stage, lostReason,
    }: { id: string; stage: Exclude<OpportunityStage, "won">; lostReason?: string | null }) => {
      const payload: Record<string, unknown> = { stage };
      // Chỉ ghi lý do khi CÓ giá trị — set null sẽ xoá mất lý do cũ.
      if (lostReason) payload.lost_reason = lostReason;
      const { error } = await oppTable().update(payload).eq("id", id);
      if (error) throw error;
    },
    // setQueriesData (số nhiều) để phủ cả key scoped by-lead / by-customer.
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: qk.opportunities.all });
      const snapshot = qc.getQueriesData<Opportunity[]>({ queryKey: qk.opportunities.all });
      qc.setQueriesData<Opportunity[]>({ queryKey: qk.opportunities.all }, (old) =>
        (old ?? []).map((o) => (o.id === id ? { ...o, stage } : o)),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.opportunities.all }),
  });
}

/** Chốt thắng — KHÔNG lạc quan (đụng 4 bảng, phải chờ kết quả thật). */
export function useWinOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      amount?: number | null;
      gross?: number | null;
      orderedAt?: string | null;
      customerId?: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_win_opportunity", {
        _opportunity_id: args.id,
        _amount: args.amount ?? null,
        _gross: args.gross ?? null,
        _ordered_at: args.orderedAt ?? new Date().toISOString(),
        _customer_id: args.customerId ?? null,
      });
      if (error) throw error;
      // RETURNS JSONB sinh kiểu Json — cast để dùng được các trường.
      return data as unknown as WinOpportunityResult;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Bỏ chốt — huỷ đơn đã sinh (giữ dấu vết) và đưa cơ hội về 'selling'. */
export function useUnwinOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_unwin_opportunity", {
        _opportunity_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Thông điệp tiếng Việt do RPC/trigger phát ra. */
const MESSAGES = [
  "Không có quyền chốt cơ hội",
  "Không có quyền bỏ chốt cơ hội",
  "Không có quyền chuyển đổi khách hàng tiềm năng",
  "Cơ hội đã được chốt thắng",
  "Cơ hội chưa gắn khách hàng",
  "Cơ hội chưa ở trạng thái Thành công",
  "Chốt/bỏ chốt cơ hội phải qua chức năng Chốt thắng",
  "Đã có khách hàng trùng số điện thoại hoặc email",
];

export function opportunityErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string })?.message ?? "";
  return MESSAGES.find((m) => msg.includes(m)) ?? null;
}

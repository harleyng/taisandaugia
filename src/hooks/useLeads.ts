import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, LeadUpsert } from "@/types/leads";

// Truy cập qua untyped cast — cùng convention với useOrders.ts / useCustomers.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const leadsTable = () => (supabase as any).from("leads");

const LEAD_SELECT =
  "*, assignee:profiles(id,name,email), converted_customer:customers(id,name,code)";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await leadsTable()
        .select(LEAD_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });
}

export function useLead(id?: string) {
  return useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await leadsTable().select(LEAD_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!id,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export function useUpsertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: LeadUpsert) => {
      if (id) {
        const { data, error } = await leadsTable()
          .update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as Lead;
      }
      const { data, error } = await leadsTable().insert(payload).select().single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: (data: Lead) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", data.id] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await leadsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

/** Chuyển đổi lead → khách hàng qua RPC (atomic, có chống trùng bên trong
 *  transaction). Truyền customerId để GỘP vào khách đã có thay vì tạo mới. */
export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, customerId }: { leadId: string; customerId?: string | null }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_convert_lead", {
        _lead_id: leadId,
        _customer_id: customerId ?? null,
      });
      if (error) throw error;
      return data as string; // customer id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}

/** Trùng số điện thoại/email — RPC ném unique_violation kèm câu tiếng Việt. */
export function leadErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string })?.message ?? "";
  if (msg.includes("Đã có khách hàng trùng")) return "Đã có khách hàng trùng SĐT/email — hãy chọn gộp vào khách hàng đó";
  if (msg.includes("Không có quyền")) return "Bạn không có quyền thực hiện thao tác này";
  return null;
}

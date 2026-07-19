import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RELATION_SELECT, type CrmRelation } from "@/lib/crm/relation";
import type { Ticket, TicketUpsert } from "@/types/tickets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ticketsTable = () => (supabase as any).from("tickets");

const TICKET_SELECT = `*, assignee:profiles(id,name,email), ${RELATION_SELECT}`;

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useTickets() {
  return useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await ticketsTable()
        .select(TICKET_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });
}

export function useRelatedTickets(relation: Partial<CrmRelation>) {
  const [column, value] = Object.entries(relation).find(([, v]) => !!v) ?? [];
  return useQuery<Ticket[]>({
    queryKey: ["tickets", "by-relation", column, value],
    queryFn: async () => {
      const { data, error } = await ticketsTable()
        .select(TICKET_SELECT)
        .eq(column as string, value)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
    enabled: !!column && !!value,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tickets"] });
  // KPI "Việc cần làm" ở Tổng quan đếm theo ticket chưa xong.
  qc.invalidateQueries({ queryKey: ["admin-job-stats"] });
}

export function useUpsertTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: TicketUpsert) => {
      if (id) {
        const { data, error } = await ticketsTable().update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as Ticket;
      }
      const { data, error } = await ticketsTable().insert(payload).select().single();
      if (error) throw error;
      return data as Ticket;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await ticketsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Đổi trạng thái nhanh từ danh sách. Cập nhật lạc quan. */
export function useSetTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Ticket["status"] }) => {
      const { error } = await ticketsTable().update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tickets"] });
      const snapshot = qc.getQueriesData<Ticket[]>({ queryKey: ["tickets"] });
      qc.setQueriesData<Ticket[]>({ queryKey: ["tickets"] }, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => invalidate(qc),
  });
}

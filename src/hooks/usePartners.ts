import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Partner, PartnerUpsert } from "@/types/partner";
import { qk } from "@/lib/queryKeys";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const partnersTable = () => (supabase as any).from("partners");

/** Admin: tất cả đối tác, theo thứ tự hiển thị. */
export function usePartners() {
  return useQuery<Partner[]>({
    queryKey: qk.partners.all,
    queryFn: async () => {
      const { data, error } = await partnersTable()
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Partner[];
    },
  });
}

/** Homepage: chỉ đối tác active (RLS cũng chặn, nhưng lọc rõ để chắc chắn). */
export function usePublicPartners() {
  return useQuery<Partner[]>({
    queryKey: qk.partners.public,
    queryFn: async () => {
      const { data, error } = await partnersTable()
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Partner[];
    },
  });
}

function invalidatePartners(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.partners.all });
}

export function useUpsertPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PartnerUpsert) => {
      if (id) {
        const { data, error } = await partnersTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Partner;
      }
      const { data, error } = await partnersTable().insert(payload).select().single();
      if (error) throw error;
      return data as Partner;
    },
    onSuccess: () => invalidatePartners(qc),
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await partnersTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePartners(qc),
  });
}

/**
 * Ghi lại thứ tự hiển thị: nhận danh sách đối tác theo thứ tự mong muốn và
 * gán sort_order = 0,1,2,… Bền vững kể cả khi các bản ghi đang trùng sort_order.
 * Dùng cho nút ↑/↓ ở bảng.
 */
export function useReorderPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: Partner[]) => {
      const results = await Promise.all(
        ordered.map((p, i) =>
          p.sort_order === i
            ? Promise.resolve({ error: null })
            : partnersTable().update({ sort_order: i }).eq("id", p.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => invalidatePartners(qc),
  });
}

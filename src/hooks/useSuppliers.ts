import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Supplier, SupplierUpsert } from "@/types/supplier";
import { qk } from "@/lib/queryKeys";

// Truy cập qua untyped cast — cùng convention với useOrders.ts / useCustomers.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const suppliersTable = () => (supabase as any).from("suppliers");

const SUPPLIER_SELECT = "*";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await suppliersTable()
        .select(SUPPLIER_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });
}

export function useSupplier(id?: string) {
  return useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await suppliersTable()
        .select(SUPPLIER_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Xoá NCC còn dịch vụ tham chiếu → FK RESTRICT. Nhận diện để toast tiếng Việt. */
export function isSupplierInUseError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "23503" || (e?.message ?? "").includes("violates foreign key");
}

export function useUpsertSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SupplierUpsert) => {
      if (id) {
        const { data, error } = await suppliersTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Supplier;
      }
      const { data, error } = await suppliersTable().insert(payload).select().single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: (data: Supplier) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["supplier", data.id] });
      // Nhóm dịch vụ và thẻ hiển thị đều nhắc tên đối tác.
      qc.invalidateQueries({ queryKey: qk.services.all });
      qc.invalidateQueries({ queryKey: qk.partners.all });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await suppliersTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

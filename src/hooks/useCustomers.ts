import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer, CustomerUpsert } from "@/types/advertising";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customersTable = () => (supabase as any).from("customers");

export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await customersTable()
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
}

export function useCustomer(id?: string) {
  return useQuery<Customer>({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await customersTable().select("*").eq("id", id).single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });
}

export function useUpsertCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CustomerUpsert) => {
      if (id) {
        const { data, error } = await customersTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Customer;
      }
      const { data, error } = await customersTable().insert(payload).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data: Customer) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", data.id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await customersTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

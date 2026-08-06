import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resetCatalogCache } from "@/lib/serviceCatalog";
import type { ServiceVariant, ServiceVariantUpsert } from "@/types/orders";
import { qk } from "@/lib/queryKeys";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const variantsTable = () => (supabase as any).from("service_variants");

export function useServiceVariants() {
  return useQuery<ServiceVariant[]>({
    queryKey: ["service-variants"],
    queryFn: async () => {
      const { data, error } = await variantsTable()
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceVariant[];
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["service-variants"] });
  qc.invalidateQueries({ queryKey: qk.serviceCatalog });
  resetCatalogCache();
}

export function useUpsertServiceVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ServiceVariantUpsert) => {
      if (id) {
        const { data, error } = await variantsTable().update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as ServiceVariant;
      }
      const { data, error } = await variantsTable().insert(payload).select().single();
      if (error) throw error;
      return data as ServiceVariant;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteServiceVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await variantsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

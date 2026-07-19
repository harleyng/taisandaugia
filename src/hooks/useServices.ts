import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resetCatalogCache } from "@/lib/serviceCatalog";
import type { Service, ServiceUpsert } from "@/types/orders";

// Truy cập qua untyped cast — cùng convention với useCustomers.ts / useAdvertisements.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const servicesTable = () => (supabase as any).from("services");

// Bề mặt admin-only nên embed được nhà cung cấp (suppliers là RLS admin).
const SERVICE_SELECT = "*, supplier:suppliers(id,name,code)";

export function useServices() {
  return useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await servicesTable()
        .select(SERVICE_SELECT)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });
}

export function useService(id?: string) {
  return useQuery<Service>({
    queryKey: ["service", id],
    queryFn: async () => {
      const { data, error } = await servicesTable().select(SERVICE_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as Service;
    },
    enabled: !!id,
  });
}

export function useUpsertService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ServiceUpsert) => {
      if (id) {
        const { data, error } = await servicesTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Service;
      }
      const { data, error } = await servicesTable().insert(payload).select().single();
      if (error) throw error;
      return data as Service;
    },
    onSuccess: (data: Service) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["service", data.id] });
      qc.invalidateQueries({ queryKey: ["service-catalog"] });
      resetCatalogCache();
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await servicesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["service-catalog"] });
      resetCatalogCache();
    },
  });
}

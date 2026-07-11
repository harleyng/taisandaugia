import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AdPage, AdPageUpsert, AdPosition, AdPositionUpsert } from "@/types/advertising";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pagesTable = () => (supabase as any).from("ad_pages");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const positionsTable = () => (supabase as any).from("ad_positions");

// ─── ad_pages (Trang hiển thị) ───────────────────────────────────────────────

export function useAdPages() {
  return useQuery<AdPage[]>({
    queryKey: ["ad_pages"],
    queryFn: async () => {
      const { data, error } = await pagesTable()
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as AdPage[];
    },
    staleTime: 10 * 60_000,
  });
}

export function useUpsertAdPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AdPageUpsert) => {
      if (id) {
        const { error } = await pagesTable().update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await pagesTable().insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad_pages"] }),
  });
}

export function useDeleteAdPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await pagesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad_pages"] });
      qc.invalidateQueries({ queryKey: ["ad_positions"] });
    },
  });
}

// ─── ad_positions (Vị trí hiển thị) ──────────────────────────────────────────

export function useAdPositions() {
  return useQuery<AdPosition[]>({
    queryKey: ["ad_positions"],
    queryFn: async () => {
      const { data, error } = await positionsTable()
        .select("*, page:ad_pages(id,name,slug)")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as AdPosition[];
    },
    staleTime: 10 * 60_000,
  });
}

export function useUpsertAdPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AdPositionUpsert) => {
      if (id) {
        const { error } = await positionsTable().update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await positionsTable().insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad_positions"] }),
  });
}

export function useDeleteAdPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await positionsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad_positions"] }),
  });
}

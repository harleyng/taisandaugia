import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useListingSaveCounts(listingIds: string[]): Map<string, number> {
  const sortedIds = useMemo(() => [...listingIds].sort(), [listingIds]);

  const { data } = useQuery({
    queryKey: ["listing-save-counts", sortedIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_listing_save_counts", {
        listing_ids: sortedIds,
      });
      if (error || !data) return new Map<string, number>();
      const map = new Map<string, number>();
      for (const row of data as { listing_id: string; save_count: number }[]) {
        map.set(row.listing_id, Number(row.save_count));
      }
      return map;
    },
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
  });

  return data ?? new Map();
}

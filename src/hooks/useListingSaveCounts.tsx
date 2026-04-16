import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useListingSaveCounts(listingIds: string[]) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!listingIds.length) return;

    const fetch = async () => {
      const { data, error } = await supabase.rpc("get_listing_save_counts", {
        listing_ids: listingIds,
      });
      if (error || !data) return;
      const map = new Map<string, number>();
      for (const row of data as { listing_id: string; save_count: number }[]) {
        map.set(row.listing_id, Number(row.save_count));
      }
      setCounts(map);
    };

    fetch();
  }, [JSON.stringify(listingIds)]);

  return counts;
}

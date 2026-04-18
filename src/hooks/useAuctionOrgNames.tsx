import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch auction organization names by ids and return a Map<id, name>.
 * Used as a fallback when listings.custom_attributes.org_name is missing.
 */
export const useAuctionOrgNames = (orgIds: (string | null | undefined)[]) => {
  const uniqueIds = useMemo(
    () => Array.from(new Set(orgIds.filter((x): x is string => !!x))).sort(),
    [orgIds]
  );

  const { data } = useQuery({
    queryKey: ["auction-org-names", uniqueIds],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [] as { id: string; name: string }[];
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("id, name")
        .in("id", uniqueIds);
      if (error) throw error;
      return data || [];
    },
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    (data || []).forEach((o) => map.set(o.id, o.name));
    return map;
  }, [data]);
};

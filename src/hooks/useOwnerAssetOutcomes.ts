import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { mapResolvedOutcomeRow, type ResolvedAssetOutcome } from "@/lib/ownerOutcomes";

const EMPTY: ResolvedAssetOutcome[] = [];

/**
 * Kết quả phiên đã hợp nhất nguồn cho mọi tài sản đã nhận của một không gian
 * (RPC owner_asset_outcomes_resolved). Server quyết định nguồn nào thắng và có
 * lệch số liệu hay không — nơi dùng chỉ đọc.
 */
export function useOwnerAssetOutcomes(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.ownerAssetOutcomes(workspaceId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_asset_outcomes_resolved", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data ?? []).map(mapResolvedOutcomeRow);
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60_000,
  });

  const outcomes = query.data ?? EMPTY;
  const byListing = useMemo(() => {
    const map: Record<string, ResolvedAssetOutcome> = {};
    for (const o of outcomes) map[o.listingId] = o;
    return map;
  }, [outcomes]);

  return { outcomes, byListing, isLoading: query.isLoading, error: query.error };
}

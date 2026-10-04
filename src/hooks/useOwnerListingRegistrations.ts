import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const NO_REGISTRATIONS: ReadonlyMap<string, number> = new Map();

/**
 * Số hồ sơ tham gia đã thanh toán theo tài sản của Trạm — chỉ tài sản đang nằm trong phiên đã
 * công bố trên sàn (RPC owner_listing_registrations, Phase M6). Chỉ số đếm, không người mua.
 */
export function useOwnerListingRegistrations(workspaceId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: ["owner-listing-registrations", workspaceId],
    enabled: !!workspaceId && enabled,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<ReadonlyMap<string, number>> => {
      const { data, error } = await supabase.rpc("owner_listing_registrations", { p_workspace_id: workspaceId! });
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.listing_id, r.registrations]));
    },
  });
  return { byListing: query.data ?? NO_REGISTRATIONS, isLoading: query.isLoading && enabled && !!workspaceId };
}

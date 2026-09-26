import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Số tin trên sàn đứng tên ĐÚNG một thực thể danh bạ (listings.asset_owner_id).
 * Đây chính là số tài sản Trạm của chi nhánh nhận ngay khi hồ sơ được duyệt
 * (run_workspace_match nhánh 'entity') — không cộng công ty mẹ hay chi nhánh anh em.
 */
export function useOwnerEntityListingCount(assetOwnerId: string | null | undefined) {
  return useQuery({
    queryKey: ["asset-owner-entity-listing-count", assetOwnerId],
    enabled: !!assetOwnerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("asset_owner_id", assetOwnerId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

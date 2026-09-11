import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toAuctionListing } from "@/types/listing";

/**
 * Tin đấu giá công khai của một tổ chức (/auction-org/:id). Tách khỏi
 * CompanyDetail để trang (đếm số cho nhãn tab) và CompanyListingsTab dùng chung
 * một cache — giữ nguyên queryKey cũ.
 */
export function useAuctionOrgListings(auctionOrgId?: string) {
  return useQuery({
    queryKey: ["auction-org-listings", auctionOrgId],
    enabled: !!auctionOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("auction_org_id", auctionOrgId!)
        .in("status", ["ACTIVE", "SOLD_RENTED"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAuctionListing);
    },
  });
}

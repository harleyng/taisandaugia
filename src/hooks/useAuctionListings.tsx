import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sessionStatusOf } from "@/lib/listings/sessionStatus";
import type { AuctionSessionStatus } from "@/components/AuctionCard";
import type { AuctionListing, ListingCustomAttributes } from "@/types/listing";

// Kiểu thật nay nằm ở @/types/listing (suy từ types.ts sinh tự động). Re-export
// để các call site đang `import { AuctionListing } from "@/hooks/useAuctionListings"`
// không phải đổi.
export type { AuctionListing } from "@/types/listing";

/**
 * Trạng thái phiên suy diễn. Logic thật nằm ở @/lib/listings/sessionStatus
 * (module thuần, dùng chung với báo cáo admin và có bản sao SQL trong migration
 * 20260805000003_admin_listings_report.sql).
 *
 * Chỉ nhận đúng hai trường nó thật sự đọc, thay vì cả AuctionListing: nhiều nơi
 * gọi hàm này với dòng dữ liệu rút gọn (demandMatch, useOwnerPortfolioMetrics,
 * CompanyDetail) và trước đây phải `as AuctionListing` để lách.
 */
export function getSessionStatus(listing: {
  status: string | null | undefined;
  custom_attributes: ListingCustomAttributes | null | undefined;
}): AuctionSessionStatus {
  return sessionStatusOf(listing.status, listing.custom_attributes);
}

export const useAuctionListings = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["auction-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .in("status", ["ACTIVE", "SOLD_RENTED"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuctionListing[];
    },
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
};

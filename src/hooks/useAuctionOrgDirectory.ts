import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuctionOrgRow {
  id: string;
  name: string;
  province: string | null;
}

/** Danh bạ tổ chức đấu giá (bảng công khai, vài chục dòng) — dùng chung cho picker và nhập Excel. */
export function useAuctionOrgDirectory() {
  return useQuery<AuctionOrgRow[]>({
    queryKey: ["auction-orgs", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("id,name,province")
        .order("name");
      if (error) throw error;
      return (data ?? []) as AuctionOrgRow[];
    },
    staleTime: 5 * 60_000,
  });
}

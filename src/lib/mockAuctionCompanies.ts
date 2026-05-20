import type { Tables } from "@/integrations/supabase/types";

export interface AuctionCompany {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  province: string;
  phone: string;
  linkedAccountId: string | null;
}

export const mapOrgRow = (
  row: Tables<"auction_organizations">,
  linkedAccountId: string | null = null,
): AuctionCompany => ({
  id: row.id,
  name: row.name,
  taxCode: row.tax_code ?? "",
  address: row.address ?? "",
  province: row.province ?? "",
  phone: row.phone ?? "",
  linkedAccountId,
});

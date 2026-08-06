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

/**
 * Chỉ nhận đúng các cột được đọc, thay vì cả dòng auction_organizations.
 * CompanyTypeahead gọi hàm này với kết quả REST chỉ select 6 cột — trước đây
 * phải để `any` ở đó mới lọt.
 */
export const mapOrgRow = (
  row: Pick<Tables<"auction_organizations">, "id" | "name" | "tax_code" | "address" | "province" | "phone">,
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

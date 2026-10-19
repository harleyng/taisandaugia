import { useOrg } from "@/contexts/OrgContext";

/**
 * Tổ chức hiện tại của portal (theo MEMBERSHIP qua OrgContext) + auction_org_id
 * khi đã KYC APPROVED. Dùng chung cho phiên đấu giá và các màn tổ chức khác.
 */
export function useSessionOrg() {
  const { currentOrg, loading } = useOrg();
  const isApproved = currentOrg?.kycStatus === "APPROVED";
  const auctionOrgId = (currentOrg?.licenseInfo?.auction_org_id as string | undefined) ?? null;
  return {
    organizationId: currentOrg?.id ?? null,
    // Chưa KYC hoặc chưa liên kết danh bạ thì server cũng không cho công bố / thêm lô.
    auctionOrgId: isApproved ? auctionOrgId : null,
    isApproved,
    loading,
  };
}

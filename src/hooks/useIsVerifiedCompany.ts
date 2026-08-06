import { useMyOrganizations } from "@/hooks/useMyOrganizations";

/**
 * Có thuộc một tổ chức đã KYC APPROVED không (để hiện badge công ty đã xác thực
 * ở Header).
 *
 * Trước đây chỉ nhận diện CHỦ SỞ HỮU (`organizations.eq('owner_id', ...)`); nay
 * xét theo membership ACTIVE nên thành viên được mời cũng nhận badge. Tham số
 * userId giữ nguyên cho các call site cũ nhưng không còn dùng — useMyOrganizations
 * tự lấy user từ AuthContext.
 */
export function useIsVerifiedCompany(_userId?: string | null) {
  const { data: orgs } = useMyOrganizations();
  return (orgs ?? []).some((o) => o.kycStatus === "APPROVED");
}

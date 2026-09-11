// Đường dẫn dùng chung của luồng hồ sơ tham gia.

export const MY_CONTRACTS_PATH = "/profile?tab=auction-contracts";

/** Trang thanh toán VNPay cho một hồ sơ; thanh toán xong quay về trang phiên. */
export function contractCheckoutPath(contractId: string, sessionId: string): string {
  const sp = new URLSearchParams({ contract: contractId, return: `/sessions/${sessionId}` });
  return `/payment/vnpay?${sp.toString()}`;
}

/** "007" — số báo danh hiển thị đủ 3 chữ số như thẻ dự đấu giá. */
export const formatBidderNo = (n: number | null | undefined) => (n != null ? String(n).padStart(3, "0") : null);

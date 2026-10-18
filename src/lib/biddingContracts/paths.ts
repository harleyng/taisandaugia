// Đường dẫn dùng chung của luồng hồ sơ tham gia.

export const MY_CONTRACTS_PATH = "/profile?tab=auction-contracts";

/** Trang thanh toán VNPay cho một hồ sơ; thanh toán xong quay về trang phiên. */
export function contractCheckoutPath(contractId: string, sessionId: string): string {
  const sp = new URLSearchParams({ contract: contractId, return: `/sessions/${sessionId}` });
  return `/payment/vnpay?${sp.toString()}`;
}

/** "007" — số báo danh hiển thị đủ 3 chữ số như thẻ dự đấu giá. */
export const formatBidderNo = (n: number | null | undefined) => (n != null ? String(n).padStart(3, "0") : null);

/** Màn điểm danh của một phiên (tab "Điểm danh" trong portal tổ chức). */
export const sessionCheckinPath = (sessionId: string) => `/portal/phien-dau-gia/${sessionId}/diem-danh`;

/** Trang in thẻ số báo danh A6 — ngoài PortalLayout. */
export const bidderCardPrintPath = (sessionId: string, contractId: string) =>
  `${sessionCheckinPath(sessionId)}/${contractId}/the`;

/** Trang đăng ký tham gia (mua hồ sơ) của một phiên — 4 bước, cần đăng nhập. */
export const sessionRegistrationPath = (sessionId: string) => `/sessions/${sessionId}/dang-ky`;

/** Trang in danh sách điểm danh A4 của phiên — ngoài PortalLayout. */
export const sessionRosterPrintPath = (sessionId: string) => `${sessionCheckinPath(sessionId)}/in`;

/** Tab "Hồ sơ tham gia" của phiên trong portal tổ chức. */
export const sessionContractsPath = (sessionId: string) => `/portal/phien-dau-gia/${sessionId}/ho-so`;

/** Trang chi tiết một hồ sơ tham gia (thay ContractReviewSheet) — mã hồ sơ là UNIQUE. */
export const sessionContractPath = (sessionId: string, code: string) =>
  `${sessionContractsPath(sessionId)}/${encodeURIComponent(code)}`;

/** location.state của trang chi tiết hồ sơ: mở từ danh sách toàn tổ chức (path + query để quay lại). */
export interface ContractDetailState {
  fromList?: string;
}

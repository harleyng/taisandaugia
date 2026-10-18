// Đường dẫn dùng chung của luồng hồ sơ tham gia.

/** Nhóm tab trong danh sách hồ sơ của tôi — `?tab=` đã dành cho tab của trang hồ sơ cá nhân. */
export const MY_CONTRACTS_GROUP_PARAM = "nhom";

/**
 * "Hồ sơ đấu giá" — tab trong trang hồ sơ cá nhân trên sàn. `/ho-so-cua-toi`
 * (trang riêng cũ) chuyển hướng về đây; chi tiết hồ sơ vẫn ở `/ho-so-cua-toi/:code`.
 */
export const MY_CONTRACTS_PATH = "/profile?tab=auction-contracts";

/** Danh sách hồ sơ của tôi, mở sẵn một nhóm (active | done | cancelled). */
export const myContractsGroupPath = (group: string | null | undefined) =>
  group && group !== "active" ? `${MY_CONTRACTS_PATH}&${MY_CONTRACTS_GROUP_PARAM}=${group}` : MY_CONTRACTS_PATH;

/** Chi tiết một hồ sơ của tôi — mã hồ sơ là UNIQUE. */
export const myContractPath = (code: string) => `/ho-so-cua-toi/${encodeURIComponent(code)}`;

/** Hướng dẫn nộp tiền đặt trước của một hồ sơ. */
export const myContractDepositPath = (code: string) => `${myContractPath(code)}/dat-truoc`;

/**
 * Trang thanh toán VNPay cho một hồ sơ; thanh toán xong quay về trang đăng ký
 * (`?ho-so=`) để hiện màn "Đã mua hồ sơ tham gia".
 */
export function contractCheckoutPath(contractId: string, sessionId: string): string {
  const back = `${sessionRegistrationPath(sessionId)}?ho-so=${encodeURIComponent(contractId)}`;
  const sp = new URLSearchParams({ contract: contractId, return: back });
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

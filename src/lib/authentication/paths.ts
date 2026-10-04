// Đường dẫn dùng chung của luồng giám định.

import { ownerPostingPath } from "@/lib/vrTour/paths";

/** Gốc trang chi tiết đơn trong menu gộp "Yêu cầu dịch vụ" (`${gốc}/${id}`). */
export const ADMIN_AUTHENTICATION_PATH = "/admin/yeu-cau-dich-vu/giam-dinh";

export const CERT_BUCKET = "asset-authentication-certs";

/** Tab "Giám định" trên trang hồ sơ của người bán. */
export const ownerAuthenticationPath = (postingId: string) => `${ownerPostingPath(postingId)}?tab=giam-dinh`;

/** Trang thanh toán VNPay cho một đơn giám định; thanh toán xong quay về tab giám định. */
export function authenticationCheckoutPath(orderId: string, postingId: string): string {
  const sp = new URLSearchParams({ gd_order: orderId, return: ownerAuthenticationPath(postingId) });
  return `/payment/vnpay?${sp.toString()}`;
}

/** Thư mục chứng thư của một đơn — khớp kiểm tra đường dẫn trong admin_complete_authentication. */
export function certificateStoragePath(postingId: string, orderId: string, fileName: string): string {
  const safe = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${postingId}/${orderId}/${Date.now()}-${safe || "chung-thu.pdf"}`;
}

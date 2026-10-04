// Đường dẫn dùng chung của luồng thẩm định giá qua sàn.

import { ownerPostingPath } from "@/lib/vrTour/paths";

/** Gốc trang chi tiết trong menu gộp "Yêu cầu dịch vụ" (`${gốc}/${id}`). */
export const ADMIN_VALUATION_PATH = "/admin/yeu-cau-dich-vu/tham-dinh";

/** Bucket PRIVATE chứa chứng thư thẩm định giá — mở bằng signed URL. */
export const VALUATION_CERT_BUCKET = "asset-valuation-certs";

/** Tab "Thẩm định giá" trên trang hồ sơ của người bán. */
export const ownerValuationPath = (postingId: string) => `${ownerPostingPath(postingId)}?tab=tham-dinh`;

/** Trang thanh toán VNPay cho một đơn; thanh toán xong quay về tab thẩm định giá. */
export function valuationCheckoutPath(orderId: string, postingId: string): string {
  const sp = new URLSearchParams({ tdg_order: orderId, return: ownerValuationPath(postingId) });
  return `/payment/vnpay?${sp.toString()}`;
}

/** Chứng thư nằm đúng thư mục của đơn — server kiểm lại lúc hoàn tất (BR-TDG-01). */
export function valuationCertStoragePath(postingId: string, orderId: string, fileName: string): string {
  const safe = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${postingId}/${orderId}/${Date.now()}-${safe || "chung-thu.pdf"}`;
}

/** Ngày hết hiệu lực mặc định = ngày thẩm định + 6 tháng (khớp server). */
export function defaultValidUntil(valuationDate: string): string {
  const [y, m, d] = valuationDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + 6, d));
  return dt.toISOString().slice(0, 10);
}

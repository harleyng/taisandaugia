// Đường dẫn dùng chung của luồng VR tour.

/** Gốc trang chi tiết đơn trong menu gộp "Yêu cầu dịch vụ" (`${gốc}/${id}`). */
export const ADMIN_VR_TOUR_PATH = "/admin/yeu-cau-dich-vu/vr-tour";

/** Chi tiết hồ sơ số hoá — mở được cả hồ sơ nháp, nơi thẻ VR tour hiển thị trạng thái. */
export const ownerPostingPath = (postingId: string) => `/chu-tai-san/dang-tai-san/${postingId}`;

/** Trang thanh toán VNPay cho một đơn VR tour; thanh toán xong quay về hồ sơ. */
export function vrTourCheckoutPath(orderId: string, postingId: string): string {
  const sp = new URLSearchParams({ vr_order: orderId, return: ownerPostingPath(postingId) });
  return `/payment/vnpay?${sp.toString()}`;
}

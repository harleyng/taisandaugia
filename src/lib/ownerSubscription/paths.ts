// Đường dẫn dùng chung của gói thuê bao tổ chức chủ tài sản.

export const OWNER_SUBSCRIPTION_PATH = "/chu-tai-san/goi-thue-bao";

/** Trang thanh toán VNPay cho gói; thanh toán xong quay về trang gói. */
export function ownerSubscriptionCheckoutPath(subId: string): string {
  const sp = new URLSearchParams({ sub: subId, return: OWNER_SUBSCRIPTION_PATH });
  return `/payment/vnpay?${sp.toString()}`;
}

// Đường dẫn dùng chung của gói thuê bao tổ chức chủ tài sản.

export const OWNER_SUBSCRIPTION_PATH = "/chu-tai-san/goi-thue-bao";
/** Trang danh mục gói ("Xem các gói khác") — trang riêng, có nút quay lại. */
export const OWNER_SUBSCRIPTION_PLANS_PATH = "/chu-tai-san/goi-thue-bao/cac-goi";

/** Trang thanh toán VNPay cho gói; thanh toán xong quay về trang gói. */
export function ownerSubscriptionCheckoutPath(subId: string): string {
  const sp = new URLSearchParams({ sub: subId, return: OWNER_SUBSCRIPTION_PATH });
  return `/payment/vnpay?${sp.toString()}`;
}

/** Trang thanh toán VNPay cho một gói danh mục (đăng ký / nâng cấp / chuyển / gia hạn). */
export function ownerSubPlanCheckoutPath(workspaceId: string, planId: string, months: number): string {
  const sp = new URLSearchParams({
    sub_plan: planId,
    months: String(months),
    ws: workspaceId,
    return: OWNER_SUBSCRIPTION_PATH,
  });
  return `/payment/vnpay?${sp.toString()}`;
}

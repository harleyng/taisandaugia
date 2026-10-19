// Kernel dùng chung với sàn đấu giá trực tuyến (docs/platform-ownership.md §7) —
// tách khỏi hooks/useCheckoutItem để VnpayQrStep chép sang repo kia nguyên văn
// mà không kéo theo toàn bộ luồng thanh toán của nền tảng thông tin.

/** Thứ đang được thanh toán trên trang VNPay mô phỏng. */
export interface CheckoutItem {
  /** Mã hiển thị / nhúng vào QR. */
  ref: string;
  label: string;
  priceVnd: number;
  /** Tham số nhận diện gửi sang /payment-result (package=… hoặc contract=…). */
  resultParams: Record<string, string>;
}

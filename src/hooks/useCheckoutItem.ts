import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import { useBiddingContract } from "@/hooks/useBiddingContracts";

/** Thứ đang được thanh toán trên trang VNPay mô phỏng. */
export interface CheckoutItem {
  /** Mã hiển thị / nhúng vào QR. */
  ref: string;
  label: string;
  priceVnd: number;
  /** Tham số nhận diện gửi sang /payment-result (package=… hoặc contract=…). */
  resultParams: Record<string, string>;
}

interface CheckoutState {
  loading: boolean;
  item: CheckoutItem | null;
  /** Nơi quay về khi không có gì hợp lệ để thanh toán. */
  fallbackPath: string;
}

/**
 * Hai loại hàng qua cùng một trang thanh toán:
 *   • ?package=<variant_key> — gói credit, giá lấy từ catalog (luồng cũ, giữ nguyên).
 *   • ?contract=<id>        — hồ sơ tham gia; giá là BẢN CHỤP trên hồ sơ, không
 *     đọc lại giá phiên (tổ chức có thể vừa đổi giá trong lúc người mua giữ chỗ).
 */
export function useCheckoutItem(params: URLSearchParams): CheckoutState {
  const packageKey = params.get("package") || "";
  const contractId = params.get("contract") || "";
  const catalog = useServiceCatalog();
  const contract = useBiddingContract(contractId || null);

  if (contractId) {
    const c = contract.data;
    const sessionPath = c?.session_id ? `/sessions/${c.session_id}` : "/sessions";
    if (contract.isLoading) return { loading: true, item: null, fallbackPath: sessionPath };
    // Đã trả / đã huỷ / không phải của mình (RLS trả null) ⇒ không có gì để trả tiền.
    if (!c || c.status !== "pending_payment") return { loading: false, item: null, fallbackPath: sessionPath };
    const sessionCode = c.auction_sessions?.code;
    return {
      loading: false,
      fallbackPath: sessionPath,
      item: {
        ref: c.code,
        label: `Hồ sơ tham gia ${c.code}${sessionCode ? ` · phiên ${sessionCode}` : ""}`,
        priceVnd: Number(c.fee_amount),
        resultParams: { contract: c.id },
      },
    };
  }

  const fallbackPath = "/profile?tab=credits";
  if (catalog.isLoading) return { loading: true, item: null, fallbackPath };
  const pkg = catalog.variant(packageKey);
  if (!pkg) return { loading: false, item: null, fallbackPath };
  return {
    loading: false,
    fallbackPath,
    item: {
      ref: pkg.variant_key,
      label: `Gói ${pkg.name} — ${pkg.credits ?? 0} credit`,
      priceVnd: Number(pkg.price ?? 0),
      resultParams: { package: pkg.variant_key },
    },
  };
}

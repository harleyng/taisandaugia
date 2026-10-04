import { formatMoneyFull } from "@/utils/money";
import type { MarketingPackage } from "@/hooks/useOwnerMarketingOrders";
import type { Coverage } from "@/lib/ownerSubscription/coverage";

/** Có chặn nút đặt không (hết lượt ở chế độ chặn, hoặc thiếu credit). */
export function paymentBlocked(pkg: MarketingPackage | null, coverage: Coverage | null, balance: number): boolean {
  if (!pkg || pkg.pricing === "quote") return false;
  if (coverage?.kind === "covered") return false;
  if (coverage?.kind === "blocked") return true;
  return balance < pkg.creditCost;
}

export const PAYMENT_LABELS: Record<string, string> = {
  subscription: "Lượt gói dịch vụ",
  credits: "Credit",
  vnpay: "VNPay",
};

interface PaidOrder {
  payment_method: string | null;
  credit_cost: number | null;
  quoted_price: number | null;
}

/** Số đã trả của đơn: "12,500,000 ₫" / "99 credit" / "1 lượt gói"; null khi chưa trả. */
export function paidAmountText(o: PaidOrder): string | null {
  if (o.payment_method === "vnpay" && o.quoted_price != null) return formatMoneyFull(o.quoted_price);
  if (o.payment_method === "credits" && o.credit_cost) return `${o.credit_cost.toLocaleString("en-US")} credit`;
  if (o.payment_method === "subscription") return "1 lượt gói";
  return null;
}

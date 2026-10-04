import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import type { MarketingOrder } from "@/hooks/useOwnerMarketingOrders";
import {
  MKT_ORDER_STATUS_TONE,
  MKT_PACKAGE_META,
  MKT_TONE_BADGE,
  isMktOrderPackage,
  isQuoteExpired,
  statusLabel,
  type MktOrderStatus,
} from "@/lib/ownerMarketing/orders";
import { formatOrderDate } from "./format";

interface MarketingOrderListProps {
  orders: MarketingOrder[];
  onOpen: (order: MarketingOrder) => void;
}

function priceText(o: MarketingOrder): string {
  if (o.pricing === "quote") return o.quoted_price != null ? formatMoneyFull(o.quoted_price) : "Chờ báo giá";
  if (o.payment_method === "subscription") return "Gói dịch vụ";
  return o.credit_cost != null ? `${o.credit_cost.toLocaleString("en-US")} credit` : "—";
}

/** Danh sách đơn: mỗi dòng là một nút mở trang chi tiết (thẻ gói, tài sản, mã, trạng thái, giá). */
export function MarketingOrderList({ orders, onOpen }: MarketingOrderListProps) {
  return (
    <ul className="divide-y divide-border">
      {orders.map((o) => {
        const Icon = isMktOrderPackage(o.variant_key) ? MKT_PACKAGE_META[o.variant_key].icon : null;
        const tone = MKT_ORDER_STATUS_TONE[o.status as MktOrderStatus] ?? "muted";
        const expired = isQuoteExpired(o);
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onOpen(o)}
              className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted/40 sm:px-2"
            >
              {Icon && (
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{o.package_name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {o.listing_title} · <span className="font-mono">{o.code}</span> · {formatOrderDate(o.created_at)}
                </span>
              </span>
              <span className="hidden shrink-0 text-right text-sm tabular-nums text-foreground md:block">
                {priceText(o)}
              </span>
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                  expired ? MKT_TONE_BADGE.muted : MKT_TONE_BADGE[tone],
                )}
              >
                {expired ? "Báo giá hết hạn" : statusLabel(o.status)}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

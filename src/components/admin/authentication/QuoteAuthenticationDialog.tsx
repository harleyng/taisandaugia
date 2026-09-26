import { ServiceQuoteDialog } from "@/components/admin/service-requests/ServiceQuoteDialog";
import { useQuoteAuthentication } from "@/hooks/useAdminAuthenticationOrders";
import { gdMethodLabel } from "@/lib/authentication/status";
import type { AuthenticationOrder } from "@/types/authentication";

/** Báo giá THAY đối tác giám định. Báo lại được khi người bán chưa thanh toán. */
export function QuoteAuthenticationDialog({
  order,
  open,
  onOpenChange,
}: {
  order: AuthenticationOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const quote = useQuoteAuthentication();
  return (
    <ServiceQuoteDialog
      title={`${order.status === "quoted" ? "Báo giá lại" : "Báo giá"} · ${order.code}`}
      description={`${gdMethodLabel(order.method)} · ${order.partner_name}. Người bán thấy giá này và thanh toán trong thời hạn hiệu lực.`}
      initial={{ price: order.quoted_price, note: order.quote_note }}
      pricePlaceholder="2,000,000"
      notePlaceholder="Phạm vi giám định, số hiện vật, thời gian trả chứng thư…"
      open={open}
      onOpenChange={onOpenChange}
      isPending={quote.isPending}
      onSubmit={(t) => quote.mutateAsync({ orderId: order.id, ...t })}
    />
  );
}

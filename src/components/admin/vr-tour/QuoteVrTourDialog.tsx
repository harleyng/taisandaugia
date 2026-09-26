import { ServiceQuoteDialog } from "@/components/admin/service-requests/ServiceQuoteDialog";
import { useQuoteVrTour } from "@/hooks/useAdminVrTourOrders";
import type { VrTourOrder } from "@/types/vrTour";

/** Báo giá THAY đối tác. Báo lại được khi người bán chưa thanh toán. */
export function QuoteVrTourDialog({
  order,
  open,
  onOpenChange,
}: {
  order: VrTourOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const quote = useQuoteVrTour();
  return (
    <ServiceQuoteDialog
      title={`${order.status === "quoted" ? "Báo giá lại" : "Báo giá"} · ${order.code}`}
      description={`${order.package_name} · ${order.partner_name}. Người bán thấy giá này và thanh toán trong thời hạn hiệu lực.`}
      initial={{ price: order.quoted_price, note: order.quote_note }}
      pricePlaceholder="12,000,000"
      notePlaceholder="Phạm vi chụp, số điểm dừng, thời gian giao tour…"
      open={open}
      onOpenChange={onOpenChange}
      isPending={quote.isPending}
      onSubmit={(t) => quote.mutateAsync({ orderId: order.id, ...t })}
    />
  );
}

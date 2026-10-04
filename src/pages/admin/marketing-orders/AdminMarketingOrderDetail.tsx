import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Info, Loader2, Megaphone, PlayCircle, ReceiptText, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminCancelMarketingOrder,
  useAdminCompleteMarketingOrder,
  useAdminMarketingOrder,
  useAdminQuoteMarketingOrder,
  useAdminStartMarketingOrder,
} from "@/hooks/useAdminMarketingOrders";
import { ServiceDetailShell } from "@/components/admin/service-requests/ServiceDetailShell";
import { DetailRow, NoteBox, SectionCard } from "@/components/admin/service-requests/DetailSection";
import { QuotePaymentRows } from "@/components/admin/service-requests/QuotePaymentRows";
import { ServiceQuoteDialog } from "@/components/admin/service-requests/ServiceQuoteDialog";
import { ServiceCancelDialog } from "@/components/admin/service-requests/ServiceCancelDialog";
import { CompleteMarketingOrderDialog } from "@/components/admin/marketing-orders/CompleteMarketingOrderDialog";
import { MarketingOrderFulfilment } from "@/components/admin/marketing-orders/MarketingOrderFulfilment";
import { formatWhen } from "@/lib/serviceRequests/form";
import { FEATURED_DAYS, adminNextAction, goalLabel, statusLabel } from "@/lib/ownerMarketing/orders";

type DialogKind = "quote" | "cancel" | "complete" | null;

const PAYMENT_LABELS: Record<string, string> = {
  subscription: "Lượt gói dịch vụ của Trạm",
  credits: "Credit",
  vnpay: "VNPay",
};

/** /admin/yeu-cau-dich-vu/truyen-thong/:id — sàn thực hiện đơn "Giao việc cho sàn" của chủ tài sản. */
export default function AdminMarketingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: o, isLoading } = useAdminMarketingOrder(id);
  const canUpdate = useHasAdminPermission("don-truyen-thong", "update");
  const quote = useAdminQuoteMarketingOrder();
  const start = useAdminStartMarketingOrder();
  const complete = useAdminCompleteMarketingOrder();
  const cancel = useAdminCancelMarketingOrder();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const openFor = (k: Exclude<DialogKind, null>) => (v: boolean) => setDialog(v ? k : null);

  const isQuote = o?.pricing === "quote";
  const canCancel = !!o && ["requested", "quoted", "paid"].includes(o.status);

  return (
    <ServiceDetailShell
      kind="truyen-thong"
      isLoading={isLoading}
      found={!!o}
      notFoundText="Không tìm thấy đơn truyền thông."
      header={
        o
          ? {
              code: o.code,
              status: o.status,
              statusLabel: statusLabel(o.status),
              title: o.listing_title,
              partner: o.workspace_name,
              nextAction: adminNextAction(o),
            }
          : undefined
      }
      actions={
        o &&
        canUpdate && (
          <>
            {isQuote && (o.status === "requested" || o.status === "quoted") && (
              <Button size="sm" onClick={() => setDialog("quote")}>
                <ReceiptText className="mr-1.5 h-4 w-4" /> {o.status === "quoted" ? "Báo giá lại" : "Báo giá"}
              </Button>
            )}
            {o.status === "paid" && (
              <Button size="sm" disabled={start.isPending} onClick={() => start.mutate(o.id)}>
                {start.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
                {o.variant_key === "mkt_featured_owner" ? `Nhận việc & bật nổi bật ${FEATURED_DAYS} ngày` : "Nhận việc"}
              </Button>
            )}
            {o.status === "in_progress" && (
              <Button size="sm" onClick={() => setDialog("complete")}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Hoàn tất
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>
                <X className="mr-1.5 h-4 w-4" /> Huỷ đơn
              </Button>
            )}
          </>
        )
      }
      tabs={
        o
          ? [
              {
                value: "thong-tin",
                label: "Thông tin",
                icon: Info,
                content: (
                  <SectionCard title="Yêu cầu">
                    <DetailRow label="Gói" value={o.package_name} />
                    <DetailRow label="Trạm đặt" value={o.workspace_name} />
                    <DetailRow
                      label="Tài sản"
                      value={
                        o.listing_id ? (
                          <a href={`/listings/${o.listing_id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {o.listing_title}
                          </a>
                        ) : (
                          o.listing_title
                        )
                      }
                    />
                    <DetailRow label="Mục tiêu" value={goalLabel(o.goal)} />
                    <DetailRow label="Tạo lúc" value={formatWhen(o.created_at)} />
                    <DetailRow label="Nhận việc lúc" value={formatWhen(o.started_at)} />
                    <DetailRow label="Hoàn tất lúc" value={formatWhen(o.completed_at)} />
                    {o.status === "cancelled" && <DetailRow label="Lý do huỷ" value={o.cancel_reason ?? "—"} />}
                    {o.brief && <NoteBox>{o.brief}</NoteBox>}
                  </SectionCard>
                ),
              },
              {
                value: "thuc-hien",
                label: "Thực hiện",
                icon: Megaphone,
                content: <MarketingOrderFulfilment order={o} canUpdate={canUpdate} />,
              },
              {
                value: "thanh-toan",
                label: "Thanh toán",
                icon: Wallet,
                content: (
                  <SectionCard title="Thanh toán">
                    <DetailRow label="Hình thức" value={o.payment_method ? PAYMENT_LABELS[o.payment_method] ?? o.payment_method : "Chưa thanh toán"} />
                    {o.payment_method === "credits" && (
                      <DetailRow label="Credit đã trừ" value={(o.credit_cost ?? 0).toLocaleString("en-US")} />
                    )}
                    {isQuote ? (
                      <QuotePaymentRows row={o} />
                    ) : (
                      <DetailRow label="Thanh toán lúc" value={formatWhen(o.paid_at)} />
                    )}
                    {o.revenue_order_id && <DetailRow label="Doanh thu" value="Đã ghi đơn doanh thu lúc hoàn tất" />}
                    {o.refund_note && <NoteBox>{o.refund_note}</NoteBox>}
                  </SectionCard>
                ),
              },
            ]
          : []
      }
    >
      {o && (
        <>
          <ServiceQuoteDialog
            title={`Báo giá ${o.code}`}
            description={`${o.package_name} · ${o.listing_title}. Khách trả qua VNPay trong thời hạn hiệu lực.`}
            initial={{ price: o.quoted_price, note: o.quote_note }}
            pricePlaceholder="Ví dụ: 5,000,000"
            notePlaceholder="Vị trí, thời gian chạy, sản phẩm bàn giao…"
            noteMaxLength={1000}
            open={dialog === "quote"}
            onOpenChange={openFor("quote")}
            isPending={quote.isPending}
            onSubmit={(t) => quote.mutateAsync({ orderId: o.id, price: t.price, note: t.note, validDays: t.validDays })}
          />
          <CompleteMarketingOrderDialog
            open={dialog === "complete"}
            onOpenChange={openFor("complete")}
            code={o.code}
            requirePostUrl={o.variant_key === "mkt_social_owner"}
            initialPostUrl={o.post_url}
            isPending={complete.isPending}
            onSubmit={(v) => complete.mutateAsync({ orderId: o.id, note: v.note, postUrl: v.postUrl })}
          />
          <ServiceCancelDialog
            code={o.code}
            noun="đơn"
            description={
              o.status === "paid"
                ? o.payment_method === "vnpay"
                  ? "Đơn đã trả qua VNPay — hệ thống không tự hoàn tiền, cần hoàn ngoài hệ thống."
                  : "Đơn đã trả — hệ thống tự trả lại lượt gói dịch vụ / credit cho người đặt."
                : "Khách chưa thanh toán. Chủ tài sản sẽ thấy lý do huỷ."
            }
            placeholder="Lý do huỷ"
            open={dialog === "cancel"}
            onOpenChange={openFor("cancel")}
            isPending={cancel.isPending}
            onSubmit={(reason) => cancel.mutateAsync({ orderId: o.id, reason })}
          />
        </>
      )}
    </ServiceDetailShell>
  );
}

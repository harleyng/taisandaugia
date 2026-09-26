import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, CalendarClock, FileCheck2, FileText, Info, PackageCheck, PlayCircle, ReceiptText, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminAuthenticationOrder,
  useAdminCancelAuthentication,
  useScheduleAuthentication,
  useStartAuthenticationReview,
} from "@/hooks/useAdminAuthenticationOrders";
import { openCertificate } from "@/hooks/useAuthenticationOrders";
import { AuthenticationStatusStepper } from "@/components/authentication/AuthenticationStatusStepper";
import { VerdictText } from "@/components/admin/authentication/VerdictText";
import { QuoteAuthenticationDialog } from "@/components/admin/authentication/QuoteAuthenticationDialog";
import { CompleteAuthenticationDialog } from "@/components/admin/authentication/CompleteAuthenticationDialog";
import { ServiceDetailShell } from "@/components/admin/service-requests/ServiceDetailShell";
import { DetailRow, NoteBox, SectionCard, Wide } from "@/components/admin/service-requests/DetailSection";
import { formatWhen } from "@/lib/serviceRequests/form";
import { PostingLink, QuotePaymentRows } from "@/components/admin/service-requests/QuotePaymentRows";
import { ServiceCancelDialog } from "@/components/admin/service-requests/ServiceCancelDialog";
import { ServiceCommissionCard } from "@/components/admin/service-requests/ServiceCommissionCard";
import { ScheduleAppointmentDialog } from "@/components/admin/service-requests/ScheduleAppointmentDialog";
import { gdMethodLabel, gdNextAction, gdStatusLabel } from "@/lib/authentication/status";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";

type DialogKind = "quote" | "schedule" | "complete" | "cancel" | null;

export default function AdminAuthenticationOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: o, isLoading } = useAdminAuthenticationOrder(id);
  const canUpdate = useHasAdminPermission("don-giam-dinh", "update");
  const canViewPosting = useHasAdminPermission("tai-san-tu-nguyen", "view");
  const start = useStartAuthenticationReview();
  const schedule = useScheduleAuthentication();
  const cancel = useAdminCancelAuthentication();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const openFor = (k: Exclude<DialogKind, null>) => (v: boolean) => setDialog(v ? k : null);

  const review = o?.asset_postings?.review_status ?? null;
  const canStart =
    !!o && ((o.method === "from_photos" && o.status === "paid") || (o.method !== "from_photos" && o.status === "item_pending"));

  return (
    <ServiceDetailShell
      kind="giam-dinh"
      isLoading={isLoading}
      found={!!o}
      notFoundText="Không tìm thấy đơn giám định."
      header={
        o
          ? {
              code: o.code,
              status: o.status,
              statusLabel: gdStatusLabel(o.status),
              title: o.posting_title,
              partner: o.partner_name,
              nextAction: gdNextAction(o),
            }
          : undefined
      }
      actions={
        o &&
        canUpdate && (
          <>
            {(o.status === "requested" || o.status === "quoted") && (
              <>
                <Button size="sm" onClick={() => setDialog("quote")}>
                  <ReceiptText className="mr-1.5 h-4 w-4" /> {o.status === "quoted" ? "Báo giá lại" : "Báo giá"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>
                  <X className="mr-1.5 h-4 w-4" /> Huỷ đơn
                </Button>
              </>
            )}
            {o.method === "on_site" && (o.status === "paid" || o.status === "item_pending") && (
              <Button size="sm" variant={o.status === "item_pending" ? "outline" : "default"} onClick={() => setDialog("schedule")}>
                <CalendarClock className="mr-1.5 h-4 w-4" /> {o.status === "item_pending" ? "Dời lịch" : "Hẹn lịch"}
              </Button>
            )}
            {canStart && (
              <Button size="sm" disabled={start.isPending} onClick={() => start.mutate({ orderId: o.id })}>
                {o.method === "from_photos" ? <PlayCircle className="mr-1.5 h-4 w-4" /> : <PackageCheck className="mr-1.5 h-4 w-4" />}
                {o.method === "from_photos"
                  ? "Bắt đầu giám định"
                  : o.method === "on_site"
                    ? "Đã giám định tại chỗ"
                    : "Đã nhận hiện vật"}
              </Button>
            )}
            {o.status === "in_review" && (
              <Button size="sm" onClick={() => setDialog("complete")}>
                <FileCheck2 className="mr-1.5 h-4 w-4" /> Tải chứng thư & kết luận
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
                  <>
                    <AuthenticationStatusStepper status={o.status} method={o.method} />
                    <SectionCard title="Yêu cầu">
                      <DetailRow
                        label="Tài sản (lô)"
                        value={<PostingLink title={o.posting_title} postingId={o.asset_posting_id} canView={canViewPosting} onOpen={navigate} />}
                      />
                      <DetailRow label="Duyệt hồ sơ" value={review ? (REVIEW_STATUS_LABELS[review as AssetPostingReviewStatus] ?? review) : "—"} />
                      <DetailRow label="Phương thức" value={gdMethodLabel(o.method)} />
                      <DetailRow label="Đối tác" value={o.partner_name} />
                      {o.site_address && <DetailRow label="Địa chỉ hiện vật" value={o.site_address} />}
                      <DetailRow label="Thời gian thuận tiện" value={o.preferred_time ?? "—"} />
                      <DetailRow label="Tạo lúc" value={formatWhen(o.created_at)} />
                      {o.status === "cancelled" && <DetailRow label="Lý do huỷ" value={o.cancel_reason ?? "—"} />}
                      {o.request_note && <NoteBox>{o.request_note}</NoteBox>}
                    </SectionCard>
                  </>
                ),
              },
              {
                value: "ket-luan",
                label: "Hiện vật & kết luận",
                icon: BadgeCheck,
                content: (
                  <SectionCard title="Hiện vật & kết luận">
                    {o.method === "ship_item" && (
                      <DetailRow label="Mã vận đơn" value={<span className="font-mono text-xs">{o.shipment_tracking ?? "—"}</span>} />
                    )}
                    {o.method === "on_site" && <DetailRow label="Lịch tại chỗ" value={formatWhen(o.appointment_at)} />}
                    {o.method !== "from_photos" && <DetailRow label="Nhận hiện vật / đã tới" value={formatWhen(o.item_received_at)} />}
                    <DetailRow label="Bắt đầu giám định" value={formatWhen(o.review_started_at)} />
                    <DetailRow label="Kết luận" value={<VerdictText verdict={o.verdict} />} />
                    <DetailRow label="Số chứng thư" value={o.certificate_no ?? "—"} />
                    <DetailRow label="Cấp lúc" value={formatWhen(o.issued_at)} />
                    {o.posting_reverted_at && <DetailRow label="Trả hồ sơ về nháp" value={formatWhen(o.posting_reverted_at)} />}
                    <DetailRow label="Công khai" value={o.published_at ? "Đang hiển thị" : "Chưa"} />
                    {o.appointment_note && <NoteBox>{o.appointment_note}</NoteBox>}
                    {o.verdict_reason && <NoteBox tone="destructive">{o.verdict_reason}</NoteBox>}
                    {o.certificate_path && (
                      <Wide>
                        <Button size="sm" variant="outline" onClick={() => openCertificate(o.certificate_path!)}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> Xem chứng thư
                        </Button>
                      </Wide>
                    )}
                  </SectionCard>
                ),
              },
              {
                value: "thanh-toan",
                label: "Thanh toán & hoa hồng",
                icon: Wallet,
                content: (
                  <>
                    <SectionCard title="Báo giá & thanh toán">
                      <QuotePaymentRows row={o} />
                    </SectionCard>
                    <SectionCard title="Hoa hồng đối tác">
                      <ServiceCommissionCard
                        commissionOrderId={o.commission_order_id}
                        pendingText="Hoa hồng đối tác được ghi khi đơn có kết luận giám định."
                      />
                    </SectionCard>
                  </>
                ),
              },
            ]
          : []
      }
    >
      {o && (
        <>
          <QuoteAuthenticationDialog order={o} open={dialog === "quote"} onOpenChange={openFor("quote")} />
          <ScheduleAppointmentDialog
            title={`Hẹn giám định tại chỗ · ${o.code}`}
            noteLabel="Ghi chú cho người bán"
            notePlaceholder="Chuyên gia phụ trách, người đón tại chỗ, số điện thoại…"
            initialAt={o.appointment_at}
            initialNote={o.appointment_note ?? [o.site_address, o.preferred_time].filter(Boolean).join(" · ")}
            open={dialog === "schedule"}
            onOpenChange={openFor("schedule")}
            isPending={schedule.isPending}
            onSubmit={(v) => schedule.mutateAsync({ orderId: o.id, ...v })}
          />
          <CompleteAuthenticationDialog order={o} open={dialog === "complete"} onOpenChange={openFor("complete")} />
          <ServiceCancelDialog
            code={o.code}
            noun="đơn"
            description="Người bán thấy lý do huỷ và có thể gửi yêu cầu mới."
            placeholder="VD: Đối tác không nhận giám định loại hiện vật này"
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

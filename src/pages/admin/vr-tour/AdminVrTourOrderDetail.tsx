import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Info, Link2, Loader2, ReceiptText, Rotate3d, ShieldCheck, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminCancelVrTour,
  useAdminVrTourOrder,
  useAttachVrTour,
  useScheduleVrTour,
} from "@/hooks/useAdminVrTourOrders";
import { VrTourStatusStepper } from "@/components/vr-tour/VrTourStatusStepper";
import { VrTourViewer } from "@/components/vr-tour/VrTourViewer";
import { QuoteVrTourDialog } from "@/components/admin/vr-tour/QuoteVrTourDialog";
import { DeliverVrTourDialog } from "@/components/admin/vr-tour/DeliverVrTourDialog";
import { ServiceDetailShell } from "@/components/admin/service-requests/ServiceDetailShell";
import { DetailRow, NoteBox, SectionCard, Wide } from "@/components/admin/service-requests/DetailSection";
import { formatWhen } from "@/lib/serviceRequests/form";
import { PostingLink, QuotePaymentRows } from "@/components/admin/service-requests/QuotePaymentRows";
import { ServiceCancelDialog } from "@/components/admin/service-requests/ServiceCancelDialog";
import { ServiceCommissionCard } from "@/components/admin/service-requests/ServiceCommissionCard";
import { ScheduleAppointmentDialog } from "@/components/admin/service-requests/ScheduleAppointmentDialog";
import { vrNextAction, vrStatusLabel } from "@/lib/vrTour/status";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";

type DialogKind = "quote" | "schedule" | "deliver" | "cancel" | null;

export default function AdminVrTourOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: o, isLoading } = useAdminVrTourOrder(id);
  const canUpdate = useHasAdminPermission("don-vr-tour", "update");
  const canApprove = useHasAdminPermission("tai-san-tu-nguyen", "approve");
  const canViewPosting = useHasAdminPermission("tai-san-tu-nguyen", "view");
  const attach = useAttachVrTour();
  const schedule = useScheduleVrTour();
  const cancel = useAdminCancelVrTour();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const openFor = (k: Exclude<DialogKind, null>) => (v: boolean) => setDialog(v ? k : null);

  const review = o?.asset_postings?.review_status ?? null;
  const approved = review === "approved";

  return (
    <ServiceDetailShell
      kind="vr-tour"
      isLoading={isLoading}
      found={!!o}
      notFoundText="Không tìm thấy đơn VR tour."
      header={
        o
          ? {
              code: o.code,
              status: o.status,
              statusLabel: vrStatusLabel(o.status),
              title: o.posting_title,
              partner: o.partner_name,
              nextAction: vrNextAction(o.status, review),
            }
          : undefined
      }
      actions={
        o && (
          <>
            {canUpdate && (o.status === "requested" || o.status === "quoted") && (
              <>
                <Button size="sm" onClick={() => setDialog("quote")}>
                  <ReceiptText className="mr-1.5 h-4 w-4" /> {o.status === "quoted" ? "Báo giá lại" : "Báo giá"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>
                  <X className="mr-1.5 h-4 w-4" /> Huỷ đơn
                </Button>
              </>
            )}
            {canUpdate && (o.status === "paid" || o.status === "scheduled") && (
              <Button size="sm" variant={o.status === "scheduled" ? "outline" : "default"} onClick={() => setDialog("schedule")}>
                <CalendarClock className="mr-1.5 h-4 w-4" /> {o.status === "scheduled" ? "Dời lịch" : "Hẹn lịch"}
              </Button>
            )}
            {canUpdate && o.status === "scheduled" && (
              <Button size="sm" onClick={() => setDialog("deliver")}>
                <Link2 className="mr-1.5 h-4 w-4" /> Nhận link VR tour
              </Button>
            )}
            {o.status === "delivered" && canApprove && (
              <Button size="sm" disabled={!approved || attach.isPending} onClick={() => attach.mutate({ orderId: o.id })}>
                {attach.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                {approved ? "Duyệt & gắn vào lô" : "Hồ sơ chưa được duyệt"}
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
                    <VrTourStatusStepper status={o.status} />
                    <SectionCard title="Yêu cầu">
                      <DetailRow
                        label="Tài sản (lô)"
                        value={<PostingLink title={o.posting_title} postingId={o.asset_posting_id} canView={canViewPosting} onOpen={navigate} />}
                      />
                      <DetailRow label="Duyệt hồ sơ" value={review ? (REVIEW_STATUS_LABELS[review as AssetPostingReviewStatus] ?? review) : "—"} />
                      <DetailRow label="Gói" value={o.package_name} />
                      <DetailRow label="Đối tác" value={o.partner_name} />
                      <DetailRow label="Địa chỉ hiện trường" value={o.site_address ?? "—"} />
                      <DetailRow label="Thời gian mong muốn" value={o.preferred_time ?? "—"} />
                      <DetailRow label="Tạo lúc" value={formatWhen(o.created_at)} />
                      {o.status === "cancelled" && <DetailRow label="Lý do huỷ" value={o.cancel_reason ?? "—"} />}
                      {o.request_note && <NoteBox>{o.request_note}</NoteBox>}
                    </SectionCard>
                  </>
                ),
              },
              {
                value: "giao-tour",
                label: "Lịch hẹn & giao tour",
                icon: Rotate3d,
                content: (
                  <SectionCard title="Lịch hẹn & giao tour">
                    <DetailRow label="Lịch chụp" value={formatWhen(o.appointment_at)} />
                    <DetailRow label="Giao lúc" value={formatWhen(o.delivered_at)} />
                    <DetailRow label="Gắn vào lô lúc" value={formatWhen(o.attached_at)} />
                    <DetailRow label="Công khai" value={o.published_at ? "Đang hiển thị" : "Chưa"} />
                    {o.appointment_note && <NoteBox>{o.appointment_note}</NoteBox>}
                    {o.vr_url && (
                      <Wide>
                        <VrTourViewer url={o.vr_url} title={o.posting_title} />
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
                        pendingText={'Hoa hồng đối tác được ghi khi đơn chuyển sang "Đã giao".'}
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
          <QuoteVrTourDialog order={o} open={dialog === "quote"} onOpenChange={openFor("quote")} />
          <ScheduleAppointmentDialog
            title={`Hẹn lịch chụp · ${o.code}`}
            noteLabel="Địa điểm & người liên hệ"
            notePlaceholder="Địa chỉ hiện trường, người đón tại chỗ, số điện thoại…"
            noteMinLength={5}
            initialAt={o.appointment_at}
            initialNote={o.appointment_note ?? [o.site_address, o.preferred_time].filter(Boolean).join(" · ")}
            open={dialog === "schedule"}
            onOpenChange={openFor("schedule")}
            isPending={schedule.isPending}
            onSubmit={(v) => schedule.mutateAsync({ orderId: o.id, ...v })}
          />
          <DeliverVrTourDialog order={o} open={dialog === "deliver"} onOpenChange={openFor("deliver")} />
          <ServiceCancelDialog
            code={o.code}
            noun="đơn"
            description="Người bán thấy lý do huỷ và có thể gửi yêu cầu mới."
            placeholder="VD: Đối tác không phục vụ khu vực này"
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

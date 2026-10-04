import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calculator, FileCheck2, Info, PlayCircle, ReceiptText, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useAdminCancelValuation, useAdminValuationOrder, useStartValuation } from "@/hooks/useAdminValuationOrders";
import { ValuationStatusStepper } from "@/components/valuation/ValuationStatusStepper";
import { ValuationResult } from "@/components/valuation/ValuationResult";
import { QuoteValuationDialog } from "@/components/admin/valuation/QuoteValuationDialog";
import { CompleteValuationDialog } from "@/components/admin/valuation/CompleteValuationDialog";
import { ServiceDetailShell } from "@/components/admin/service-requests/ServiceDetailShell";
import { DetailRow, NoteBox, SectionCard } from "@/components/admin/service-requests/DetailSection";
import { formatWhen } from "@/lib/serviceRequests/form";
import { PostingLink, QuotePaymentRows } from "@/components/admin/service-requests/QuotePaymentRows";
import { ServiceCancelDialog } from "@/components/admin/service-requests/ServiceCancelDialog";
import { ServiceCommissionCard } from "@/components/admin/service-requests/ServiceCommissionCard";
import { purposeLabel, tdgNextAction, tdgStatusLabel } from "@/lib/valuation/status";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";

type DialogKind = "quote" | "cancel" | "complete" | null;

/** Chi tiết đơn thẩm định giá trong menu gộp "Yêu cầu dịch vụ" — admin thao tác thay đơn vị. */
export default function AdminValuationOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: o, isLoading } = useAdminValuationOrder(id);
  const canUpdate = useHasAdminPermission("tham-dinh-gia", "update");
  const canViewPosting = useHasAdminPermission("tai-san-tu-nguyen", "view");
  const start = useStartValuation();
  const cancel = useAdminCancelValuation();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const openFor = (k: Exclude<DialogKind, null>) => (v: boolean) => setDialog(v ? k : null);

  const review = o?.asset_postings?.review_status ?? null;
  const done = o?.status === "completed" || o?.status === "superseded";

  return (
    <ServiceDetailShell
      kind="tham-dinh"
      isLoading={isLoading}
      found={!!o}
      notFoundText="Không tìm thấy đơn thẩm định giá."
      header={
        o
          ? {
              code: o.code,
              status: o.status,
              statusLabel: tdgStatusLabel(o.status),
              title: o.posting_title,
              partner: o.partner_name,
              nextAction: tdgNextAction(o),
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
                  <ReceiptText className="mr-1.5 h-4 w-4" />
                  {o.status === "quoted" ? "Báo giá lại" : "Phân công & báo giá"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>
                  <X className="mr-1.5 h-4 w-4" /> Huỷ đơn
                </Button>
              </>
            )}
            {o.status === "paid" && (
              <Button size="sm" disabled={start.isPending} onClick={() => start.mutate({ id: o.id })}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Bắt đầu thẩm định
              </Button>
            )}
            {o.status === "in_review" && (
              <Button size="sm" onClick={() => setDialog("complete")}>
                <FileCheck2 className="mr-1.5 h-4 w-4" /> Nhập kết quả
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
                    <ValuationStatusStepper status={o.status} />
                    <SectionCard title="Yêu cầu">
                      <DetailRow
                        label="Tài sản"
                        value={
                          <PostingLink
                            title={o.posting_title}
                            postingId={o.asset_posting_id}
                            canView={canViewPosting}
                            onOpen={navigate}
                          />
                        }
                      />
                      <DetailRow
                        label="Duyệt hồ sơ"
                        value={review ? (REVIEW_STATUS_LABELS[review as AssetPostingReviewStatus] ?? review) : "—"}
                      />
                      <DetailRow label="Mục đích" value={purposeLabel(o.purpose)} />
                      <DetailRow label="Địa chỉ khảo sát" value={o.site_address ?? "Theo địa chỉ trong hồ sơ"} />
                      <DetailRow label="Thẩm định viên" value={o.expert_name ?? "Chưa phân công"} />
                      <DetailRow label="Đơn vị" value={o.partner_name ?? "—"} />
                      <DetailRow label="Tạo lúc" value={formatWhen(o.created_at)} />
                      <DetailRow label="Bắt đầu thẩm định" value={formatWhen(o.review_started_at)} />
                      <DetailRow label="Hoàn tất" value={formatWhen(o.completed_at)} />
                      {o.status === "cancelled" && <DetailRow label="Lý do huỷ" value={o.cancel_reason ?? "—"} />}
                      {o.request_note && <NoteBox>{o.request_note}</NoteBox>}
                    </SectionCard>
                  </>
                ),
              },
              ...(done
                ? [
                    {
                      value: "ket-qua",
                      label: "Kết quả",
                      icon: Calculator,
                      content: (
                        <SectionCard title="Kết quả thẩm định giá" layout="stack">
                          <ValuationResult row={o} />
                        </SectionCard>
                      ),
                    },
                  ]
                : []),
              {
                value: "thanh-toan",
                label: "Thanh toán & hoa hồng",
                icon: Wallet,
                content: (
                  <>
                    <SectionCard title="Báo giá & thanh toán">
                      <QuotePaymentRows row={o} />
                    </SectionCard>
                    <SectionCard title="Hoa hồng đơn vị thẩm định">
                      <ServiceCommissionCard
                        commissionOrderId={o.commission_order_id}
                        pendingText="Hoa hồng đơn vị thẩm định được ghi khi nhập kết quả và chứng thư."
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
          <QuoteValuationDialog row={o} open={dialog === "quote"} onOpenChange={openFor("quote")} />
          <CompleteValuationDialog order={o} open={dialog === "complete"} onOpenChange={openFor("complete")} />
          <ServiceCancelDialog
            code={o.code}
            noun="đơn"
            description="Người bán thấy đơn đã huỷ và có thể gửi yêu cầu mới."
            placeholder="VD: Tài sản ở ngoài vùng phục vụ của các đơn vị đối tác"
            maxLength={2000}
            open={dialog === "cancel"}
            onOpenChange={openFor("cancel")}
            isPending={cancel.isPending}
            onSubmit={(reason) => cancel.mutateAsync({ id: o.id, reason })}
          />
        </>
      )}
    </ServiceDetailShell>
  );
}

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardCheck, Info, PlayCircle, ReceiptText, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminCancelLegalConsult,
  useAdminLegalConsultation,
  useStartLegalConsult,
} from "@/hooks/useAdminLegalConsultations";
import { LegalConsultStatusStepper } from "@/components/legal-consult/LegalConsultStatusStepper";
import { LegalConsultResult } from "@/components/legal-consult/LegalConsultResult";
import { LegalDocChips } from "@/components/legal-consult/LegalDocChips";
import { QuoteLegalConsultDialog } from "@/components/admin/legal-consult/QuoteLegalConsultDialog";
import { ChecklistEditor } from "@/components/admin/legal-consult/ChecklistEditor";
import { ServiceDetailShell } from "@/components/admin/service-requests/ServiceDetailShell";
import { DetailRow, NoteBox, SectionCard, Wide } from "@/components/admin/service-requests/DetailSection";
import { formatWhen } from "@/lib/serviceRequests/form";
import { PostingLink, QuotePaymentRows } from "@/components/admin/service-requests/QuotePaymentRows";
import { ServiceCancelDialog } from "@/components/admin/service-requests/ServiceCancelDialog";
import { ServiceCommissionCard } from "@/components/admin/service-requests/ServiceCommissionCard";
import { tvplNextAction, tvplStatusLabel } from "@/lib/legalConsult/status";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";

type DialogKind = "quote" | "cancel" | null;

export default function AdminLegalConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: o, isLoading } = useAdminLegalConsultation(id);
  const canUpdate = useHasAdminPermission("tu-van-phap-ly", "update");
  const canViewPosting = useHasAdminPermission("tai-san-tu-nguyen", "view");
  const start = useStartLegalConsult();
  const cancel = useAdminCancelLegalConsult();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const openFor = (k: Exclude<DialogKind, null>) => (v: boolean) => setDialog(v ? k : null);

  const review = o?.asset_postings?.review_status ?? null;
  const done = o?.status === "completed" || o?.status === "superseded";

  return (
    <ServiceDetailShell
      kind="tu-van-phap-ly"
      isLoading={isLoading}
      found={!!o}
      notFoundText="Không tìm thấy yêu cầu tư vấn."
      header={
        o
          ? {
              code: o.code,
              status: o.status,
              statusLabel: tvplStatusLabel(o.status),
              title: o.posting_title,
              partner: o.partner_name,
              suffix: o.version != null && <Badge variant="outline">v{o.version}</Badge>,
              nextAction: tvplNextAction(o),
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
                  <X className="mr-1.5 h-4 w-4" /> Huỷ yêu cầu
                </Button>
              </>
            )}
            {o.status === "paid" && (
              <Button size="sm" disabled={start.isPending} onClick={() => start.mutate({ id: o.id })}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Bắt đầu rà soát
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
                    <LegalConsultStatusStepper status={o.status} />
                    <SectionCard title="Yêu cầu">
                      <DetailRow
                        label="Tài sản"
                        value={<PostingLink title={o.posting_title} postingId={o.asset_posting_id} canView={canViewPosting} onOpen={navigate} />}
                      />
                      <DetailRow label="Duyệt hồ sơ" value={review ? (REVIEW_STATUS_LABELS[review as AssetPostingReviewStatus] ?? review) : "—"} />
                      <DetailRow label="Chuyên gia" value={o.expert_name ?? "Chưa phân công"} />
                      <DetailRow label="Đối tác" value={o.partner_name ?? "—"} />
                      <DetailRow label="Tạo lúc" value={formatWhen(o.created_at)} />
                      <DetailRow label="Bắt đầu rà soát" value={formatWhen(o.review_started_at)} />
                      <DetailRow label="Hoàn tất" value={formatWhen(o.completed_at)} />
                      {o.status === "cancelled" && <DetailRow label="Lý do huỷ" value={o.cancel_reason ?? "—"} />}
                      {o.request_note && <NoteBox>{o.request_note}</NoteBox>}
                      <Wide>
                        <div className="space-y-1.5">
                          <p className="text-sm text-muted-foreground">Hồ sơ đã nộp ({o.submitted_doc_paths.length} tệp)</p>
                          <LegalDocChips paths={o.submitted_doc_paths} />
                        </div>
                      </Wide>
                    </SectionCard>
                  </>
                ),
              },
              ...(o.status === "in_review" || done
                ? [
                    {
                      value: "ra-soat",
                      label: done ? "Kết quả tư vấn" : "Checklist rà soát",
                      icon: ClipboardCheck,
                      content: (
                        <SectionCard title={done ? "Kết quả tư vấn" : "Checklist rà soát"} layout="stack">
                          {done ? <LegalConsultResult row={o} compact /> : <ChecklistEditor row={o} canUpdate={canUpdate} />}
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
                    <SectionCard title="Hoa hồng đối tác">
                      <ServiceCommissionCard
                        commissionOrderId={o.commission_order_id}
                        pendingText="Hoa hồng đối tác được ghi khi chuyên gia hoàn tất tư vấn."
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
          <QuoteLegalConsultDialog row={o} open={dialog === "quote"} onOpenChange={openFor("quote")} />
          <ServiceCancelDialog
            code={o.code}
            noun="yêu cầu"
            description="Người bán thấy yêu cầu đã huỷ và có thể gửi yêu cầu mới."
            placeholder="VD: Hồ sơ nộp không đọc được, cần tải lại bản rõ nét"
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

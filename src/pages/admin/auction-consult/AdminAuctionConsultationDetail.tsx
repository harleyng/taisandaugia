import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Info, Lightbulb, PlayCircle, ReceiptText, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminAuctionConsultation,
  useAdminCancelAuctionConsult,
  useStartAuctionConsult,
} from "@/hooks/useAdminAuctionConsultations";
import { AuctionConsultStatusStepper } from "@/components/auction-consult/AuctionConsultStatusStepper";
import { AuctionConsultResult } from "@/components/auction-consult/AuctionConsultResult";
import { AuctionConsultRequestSummary } from "@/components/auction-consult/AuctionConsultRequestSummary";
import { QuoteAuctionConsultDialog } from "@/components/admin/auction-consult/QuoteAuctionConsultDialog";
import { ProposalEditor } from "@/components/admin/auction-consult/ProposalEditor";
import { ServiceDetailShell } from "@/components/admin/service-requests/ServiceDetailShell";
import { DetailRow, SectionCard, Wide } from "@/components/admin/service-requests/DetailSection";
import { formatWhen } from "@/lib/serviceRequests/form";
import { PostingLink, QuotePaymentRows } from "@/components/admin/service-requests/QuotePaymentRows";
import { ServiceCancelDialog } from "@/components/admin/service-requests/ServiceCancelDialog";
import { ServiceCommissionCard } from "@/components/admin/service-requests/ServiceCommissionCard";
import { tvdgNextAction, tvdgStatusLabel } from "@/lib/auctionConsult/status";
import { REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";

type DialogKind = "quote" | "cancel" | null;

export default function AdminAuctionConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: o, isLoading } = useAdminAuctionConsultation(id);
  const canUpdate = useHasAdminPermission("tu-van-dau-gia", "update");
  const canViewPosting = useHasAdminPermission("tai-san-tu-nguyen", "view");
  const start = useStartAuctionConsult();
  const cancel = useAdminCancelAuctionConsult();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const openFor = (k: Exclude<DialogKind, null>) => (v: boolean) => setDialog(v ? k : null);

  const review = o?.asset_postings?.review_status ?? null;
  const done = o?.status === "completed" || o?.status === "superseded";

  return (
    <ServiceDetailShell
      kind="tu-van-dau-gia"
      isLoading={isLoading}
      found={!!o}
      notFoundText="Không tìm thấy yêu cầu tư vấn."
      header={
        o
          ? {
              code: o.code,
              status: o.status,
              statusLabel: tvdgStatusLabel(o.status),
              title: o.posting_title,
              partner: o.partner_name,
              suffix: o.version != null && <Badge variant="outline">v{o.version}</Badge>,
              nextAction: tvdgNextAction(o),
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
                <PlayCircle className="mr-1.5 h-4 w-4" /> Bắt đầu xây dựng phương án
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
                    <AuctionConsultStatusStepper status={o.status} />
                    <SectionCard title="Yêu cầu của người bán">
                      <DetailRow
                        label="Tài sản"
                        value={<PostingLink title={o.posting_title} postingId={o.asset_posting_id} canView={canViewPosting} onOpen={navigate} />}
                      />
                      <DetailRow label="Duyệt hồ sơ" value={review ? (REVIEW_STATUS_LABELS[review as AssetPostingReviewStatus] ?? review) : "—"} />
                      <DetailRow label="Chuyên gia" value={o.expert_name ?? "Chưa phân công"} />
                      <DetailRow label="Đối tác" value={o.partner_name ?? "—"} />
                      <DetailRow label="Tạo lúc" value={formatWhen(o.created_at)} />
                      <DetailRow label="Bắt đầu soạn" value={formatWhen(o.review_started_at)} />
                      <DetailRow label="Gửi đề xuất" value={formatWhen(o.completed_at)} />
                      {o.status === "cancelled" && <DetailRow label="Lý do huỷ" value={o.cancel_reason ?? "—"} />}
                      <Wide>
                        <AuctionConsultRequestSummary row={o} />
                      </Wide>
                    </SectionCard>
                  </>
                ),
              },
              ...(o.status === "in_review" || done
                ? [
                    {
                      value: "phuong-an",
                      label: done ? "Đề xuất đã gửi" : "Soạn phương án",
                      icon: Lightbulb,
                      content: (
                        <SectionCard title={done ? "Đề xuất đã gửi" : "Soạn phương án"} layout="stack">
                          {done ? <AuctionConsultResult row={o} mode="admin" compact /> : <ProposalEditor row={o} canUpdate={canUpdate} />}
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
                        pendingText="Hoa hồng đối tác được ghi khi chuyên gia gửi đề xuất phương án."
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
          <QuoteAuctionConsultDialog row={o} open={dialog === "quote"} onOpenChange={openFor("quote")} />
          <ServiceCancelDialog
            code={o.code}
            noun="yêu cầu"
            description="Người bán thấy yêu cầu đã huỷ và có thể gửi yêu cầu mới."
            placeholder="VD: Người bán yêu cầu huỷ để bổ sung thông tin tài sản trước"
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

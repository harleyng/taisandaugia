import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, FilePen, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import type { BiddingContract } from "@/types/bidding-contract";
import { ResubmitContractDialog } from "./ResubmitContractDialog";

interface Props {
  contract: BiddingContract;
  /** Phiên còn công bố — mới nộp lại / mua lại được. */
  sessionPublished: boolean;
  /** Hiện nút "Đăng ký lại" khi bị từ chối (tab hồ sơ; trang phiên đã có nút mua). */
  showRebuy?: boolean;
}

/**
 * Kết quả tổ chức duyệt hồ sơ, phía người mua: chờ duyệt / cần bổ sung (+ nộp lại)
 * / bị từ chối (+ hoàn tiền hồ sơ). Đã duyệt thì không hiện gì — phần dự phiên
 * (tiền đặt trước, phiếu, điểm danh) nằm ở thẻ khác.
 */
export function ContractReviewNotice({ contract: c, sessionPublished, showRebuy }: Props) {
  const navigate = useNavigate();
  const [resubmitOpen, setResubmitOpen] = useState(false);

  if (c.status === "refunded" || c.review_status === "rejected") {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium text-destructive">
          <XCircle className="h-4 w-4" />
          Hồ sơ bị tổ chức đấu giá từ chối
        </p>
        {c.review_note && <p className="whitespace-pre-line text-foreground">{c.review_note}</p>}
        <p className="text-muted-foreground">
          Tiền hồ sơ {formatVnd(c.fee_amount)} đã được hoàn
          {c.refunded_at && ` lúc ${formatDateTime(c.refunded_at)}`}
          {c.refund_txn_ref && ` (mã ${c.refund_txn_ref})`}.
          {c.deposit_status === "pending_refund" && " Tổ chức sẽ hoàn trả tiền đặt trước bạn đã nộp."}
        </p>
        {showRebuy && sessionPublished && (
          <Button size="sm" variant="outline" onClick={() => navigate(`/sessions/${c.session_id}`)}>
            Đăng ký lại
          </Button>
        )}
      </div>
    );
  }

  if (c.status !== "paid") return null;

  if (c.review_status === "pending") {
    return (
      <InfoBox variant="muted" className="flex items-start gap-2 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">
          {c.resubmitted_at
            ? `Đã nộp lại lúc ${formatDateTime(c.resubmitted_at)} — tổ chức đấu giá đang duyệt.`
            : "Tổ chức đấu giá đang duyệt hồ sơ của bạn. Kết quả hiện tại đây."}
        </span>
      </InfoBox>
    );
  }

  if (c.review_status === "needs_info") {
    return (
      <InfoBox variant="amber" className="space-y-2 text-sm">
        <p className="font-medium">Tổ chức đấu giá yêu cầu bổ sung hồ sơ</p>
        {c.review_note && <p className="whitespace-pre-line">{c.review_note}</p>}
        {sessionPublished && (
          <>
            <Button size="sm" className="gap-1.5" onClick={() => setResubmitOpen(true)}>
              <FilePen className="h-4 w-4" />
              Bổ sung hồ sơ
            </Button>
            <ResubmitContractDialog contract={c} open={resubmitOpen} onOpenChange={setResubmitOpen} />
          </>
        )}
      </InfoBox>
    );
  }

  return null;
}

import { useState } from "react";
import { Check, Loader2, MessageSquareWarning, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InfoBox } from "@/components/shared/InfoBox";
import { ContractReviewHistory } from "@/components/bidding-contracts/ContractReviewHistory";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { ReviewStatusBadge } from "@/components/bidding-contracts/ReviewStatusBadge";
import { useMarkDepositRefunded } from "@/hooks/useOrgBidding";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { reviewActionsFor } from "@/lib/biddingContracts/review";
import { CONTRACT_STATUS_LABELS, type ContractWithSession, type ReviewDecision } from "@/types/bidding-contract";
import { ContractPartiesView } from "./ContractPartiesView";
import { ReviewDecisionDialog } from "./ReviewDecisionDialog";

const DECISION_BUTTONS: Record<ReviewDecision, { label: string; icon: typeof Check; variant: "default" | "outline" | "destructive" }> = {
  approved: { label: "Duyệt", icon: Check, variant: "default" },
  needs_info: { label: "Yêu cầu bổ sung", icon: MessageSquareWarning, variant: "outline" },
  rejected: { label: "Từ chối", icon: X, variant: "destructive" },
};

interface Props {
  /** Lấy từ danh sách đang hiển thị theo id ⇒ tự cập nhật sau mỗi lần duyệt. */
  contract: ContractWithSession | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Xem + duyệt một hồ sơ tham gia (ho-so-tham-gia:review). Quyền xét theo TỔ CHỨC
 * CỦA HỒ SƠ chứ không theo tổ chức đang chọn — sheet mở được từ chi tiết phiên.
 */
export function ContractReviewSheet({ contract, onOpenChange }: Props) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const canReview = useHasOrgPermissionIn(contract?.organization_id, "ho-so-tham-gia", "review");
  const canUpdate = useHasOrgPermissionIn(contract?.organization_id, "ho-so-tham-gia", "update");
  const markRefunded = useMarkDepositRefunded(contract?.session_id);

  const rejected = contract?.status === "refunded";
  const actions = contract ? reviewActionsFor(contract) : { decisions: [], blockedNote: null };
  const s = contract?.auction_sessions;

  return (
    <Sheet open={!!contract} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {contract && (
          <div className="space-y-5">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="font-mono">{contract.code}</SheetTitle>
              <SheetDescription>{s ? `${s.code} · ${s.title}` : "—"}</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ReviewStatusBadge status={contract.review_status} />
                <DepositStatusBadge status={contract.deposit_status} />
                <span className="text-xs text-muted-foreground">
                  {CONTRACT_STATUS_LABELS[contract.status]} · {formatVnd(contract.fee_amount)} ·{" "}
                  {formatDateTime(contract.paid_at)}
                </span>
              </div>
            </SheetHeader>

            {contract.review_note && contract.review_status !== "approved" && (
              <InfoBox variant="amber" className="text-sm">
                <p className="font-medium">
                  {contract.review_status === "rejected" ? "Lý do từ chối" : "Đã yêu cầu bổ sung"}
                </p>
                <p className="whitespace-pre-line">{contract.review_note}</p>
                {contract.review_status === "pending" && contract.resubmitted_at && (
                  <p className="mt-1 text-xs">Người mua đã nộp lại lúc {formatDateTime(contract.resubmitted_at)}.</p>
                )}
              </InfoBox>
            )}

            {rejected && (
              <InfoBox variant="muted" className="space-y-2 text-sm">
                <p>
                  Đã hoàn tiền hồ sơ lúc {formatDateTime(contract.refunded_at)} (mã {contract.refund_txn_ref}). Ảnh giấy
                  tờ không còn hiển thị sau khi hồ sơ bị từ chối.
                </p>
                {contract.deposit_status === "pending_refund" && canUpdate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={markRefunded.isPending}
                    onClick={() => markRefunded.mutate({ contractId: contract.id })}
                  >
                    {markRefunded.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Ghi nhận đã hoàn trả tiền đặt trước
                  </Button>
                )}
              </InfoBox>
            )}

            <ContractPartiesView contract={contract} showImages={!rejected} />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Lịch sử duyệt</h3>
              <ContractReviewHistory contractId={contract.id} />
            </section>

            {canReview && (
              <>
                <Separator />
                {actions.decisions.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {actions.decisions.map((d) => {
                      const b = DECISION_BUTTONS[d];
                      return (
                        <Button key={d} variant={b.variant} className="gap-1.5" onClick={() => setDecision(d)}>
                          <b.icon className="h-4 w-4" />
                          {b.label}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  actions.blockedNote && <p className="text-sm text-muted-foreground">{actions.blockedNote}</p>
                )}
              </>
            )}

            <ReviewDecisionDialog
              contract={contract}
              decision={decision}
              onOpenChange={(open) => !open && setDecision(null)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

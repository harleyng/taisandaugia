import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useReviewContract } from "@/hooks/useOrgBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { decisionNeedsNote, REVIEW_NOTE_MIN } from "@/lib/biddingContracts/review";
import type { ContractWithSession, ReviewDecision } from "@/types/bidding-contract";

const COPY: Record<ReviewDecision, { title: string; noteLabel: string; placeholder: string; confirm: string }> = {
  approved: {
    title: "Duyệt hồ sơ",
    noteLabel: "Ghi chú",
    placeholder: "Không bắt buộc",
    confirm: "Duyệt hồ sơ",
  },
  needs_info: {
    title: "Yêu cầu bổ sung hồ sơ",
    noteLabel: "Nội dung cần bổ sung",
    placeholder: "Ví dụ: Ảnh mặt sau CCCD bị mờ, vui lòng chụp lại.",
    confirm: "Gửi yêu cầu bổ sung",
  },
  rejected: {
    title: "Từ chối hồ sơ",
    noteLabel: "Lý do từ chối",
    placeholder: "Người mua sẽ thấy lý do này trên hồ sơ của họ.",
    confirm: "Từ chối và hoàn tiền hồ sơ",
  },
};

interface Props {
  contract: ContractWithSession;
  decision: ReviewDecision | null;
  onOpenChange: (open: boolean) => void;
}

/** Xác nhận một quyết định duyệt. Bổ sung / từ chối bắt buộc ghi nội dung; từ chối cảnh báo hoàn tiền. */
export function ReviewDecisionDialog({ contract, decision, onOpenChange }: Props) {
  const review = useReviewContract();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (decision) setNote("");
  }, [decision]);

  const copy = decision ? COPY[decision] : null;
  const needsNote = decision ? decisionNeedsNote(decision) : false;
  const invalid = needsNote && note.trim().length < REVIEW_NOTE_MIN;

  const submit = () => {
    if (!decision || invalid) return;
    review.mutate(
      { contractId: contract.id, decision, note: note.trim() || undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={!!decision} onOpenChange={(v) => !review.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>
            {contract.code} · {contract.buyer_kind === "organization" ? contract.org_name : contract.full_name}
          </DialogDescription>
        </DialogHeader>

        {decision === "rejected" && (
          <InfoBox variant="amber" className="space-y-1 text-sm">
            <p>
              Người mua được hoàn <strong>{formatVnd(contract.fee_amount)}</strong> tiền hồ sơ và được mua lại hồ sơ
              mới cho phiên này.
            </p>
            {contract.deposit_status === "received" && (
              <p>Tiền đặt trước đã nhận chuyển sang “Chờ hoàn trả” — ghi nhận khi đã chuyển trả cho người mua.</p>
            )}
            <p className="font-medium">Không hoàn tác được.</p>
          </InfoBox>
        )}
        {decision === "needs_info" && (
          <p className="text-sm text-muted-foreground">
            Người mua sửa thông tin hoặc tải lại giấy tờ rồi nộp lại; hồ sơ quay về “Chờ duyệt”.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="review-note">
            {copy?.noteLabel} {needsNote && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={copy?.placeholder}
            rows={3}
            maxLength={1000}
          />
          {needsNote && note.length > 0 && invalid && (
            <p className="text-xs text-destructive">Nhập ít nhất {REVIEW_NOTE_MIN} ký tự.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={review.isPending}>
            Quay lại
          </Button>
          <Button
            variant={decision === "rejected" ? "destructive" : "default"}
            onClick={submit}
            disabled={review.isPending || invalid}
            className="gap-1.5"
          >
            {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

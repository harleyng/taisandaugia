import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DetailNote } from "@/components/portal/auction-sessions/DetailCard";
import { useReviewContract } from "@/hooks/useOrgBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { contractDocuments, displayNameOf } from "@/lib/biddingContracts/contractDetail";
import type { ContractWithSession } from "@/types/bidding-contract";
import { DIALOG_BTN } from "./ui";

interface Props {
  contract: ContractWithSession;
  /** Tổng tiền đặt trước các lô — null nếu phiên không khai. */
  required: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Phê duyệt hồ sơ?" — nhắc những điểm còn thiếu trước khi duyệt (design openApprove). */
export function ApproveDialog({ contract: c, required, open, onOpenChange }: Props) {
  const review = useReviewContract();
  const unpaid = c.deposit_status === "pending";
  const received = c.deposit_amount_received ?? 0;
  const short = c.deposit_status === "received" && required != null && received < required;
  const flagged = contractDocuments(c).filter((d) => d.flag).length;
  const warnings = [
    unpaid &&
      `Chưa nhận tiền đặt trước${required != null ? ` ${formatVnd(required)}` : ""} — người tham gia chỉ được điểm danh khi đã nộp đủ.`,
    short && `Tiền đặt trước còn thiếu ${formatVnd((required ?? 0) - received)}.`,
    flagged > 0 && `${flagged} giấy tờ có thông tin người đăng ký đã sửa so với máy đọc.`,
  ].filter(Boolean);

  const submit = () =>
    review.mutate({ contractId: c.id, decision: "approved" }, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={(v) => !review.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-[420px] gap-3.5 rounded-[14px] px-[22px] pb-5 pt-[18px]">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-base font-semibold">Phê duyệt hồ sơ?</DialogTitle>
          <DialogDescription className="text-[13px]">
            {displayNameOf(c)} · <span className="font-mono text-[12.5px]">{c.code}</span>
          </DialogDescription>
        </DialogHeader>
        {warnings.length > 0 && <DetailNote icon={<AlertTriangle />}>{warnings.join(" ")}</DetailNote>}
        <p className="text-[12.5px] text-muted-foreground">
          Người đăng ký thấy kết quả duyệt trên hồ sơ của họ. Sau khi duyệt, hồ sơ không thể chuyển về trạng thái chờ duyệt.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className={DIALOG_BTN} onClick={() => onOpenChange(false)} disabled={review.isPending}>
            Huỷ
          </Button>
          <Button className={DIALOG_BTN} onClick={submit} disabled={review.isPending}>
            {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Phê duyệt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

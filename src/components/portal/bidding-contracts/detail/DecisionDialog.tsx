import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useReviewContract } from "@/hooks/useOrgBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { REVIEW_NOTE_MIN } from "@/lib/biddingContracts/review";
import type { ContractWithSession } from "@/types/bidding-contract";
import { DIALOG_BTN } from "./ui";

export type NoteDecision = "rejected" | "needs_info";

/** Lý do gõ nhanh của design (pdg-hoso.js openDecide). */
const QUICK: Record<NoteDecision, string[]> = {
  rejected: ["Không thuộc đối tượng được tham gia", "Giấy tờ giả mạo hoặc không hợp lệ", "Đăng ký quá hạn"],
  needs_info: ["Chụp lại CCCD rõ nét", "Bổ sung giấy uỷ quyền công chứng", "Bổ sung quyết định cử người đại diện"],
};

interface Props {
  contract: ContractWithSession;
  decision: NoteDecision | null;
  onOpenChange: (open: boolean) => void;
}

/** Từ chối / Yêu cầu bổ sung — bắt buộc ghi nội dung (CHECK abc_review_note_shape ≥ 3 ký tự). */
export function DecisionDialog({ contract, decision, onOpenChange }: Props) {
  const review = useReviewContract();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const reject = decision === "rejected";

  useEffect(() => {
    if (decision) {
      setNote("");
      setErr("");
    }
  }, [decision]);

  const submit = () => {
    if (!decision) return;
    const t = note.trim();
    if (t.length < REVIEW_NOTE_MIN) {
      setErr(reject ? "Nhập lý do từ chối." : "Nhập nội dung cần bổ sung.");
      ref.current?.focus();
      return;
    }
    review.mutate({ contractId: contract.id, decision, note: t }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={!!decision} onOpenChange={(v) => !review.isPending && onOpenChange(v)}>
      <DialogContent
        className="max-w-[420px] gap-3.5 rounded-[14px] px-[22px] pb-5 pt-[18px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          ref.current?.focus();
        }}
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-base font-semibold">{reject ? "Từ chối hồ sơ" : "Yêu cầu bổ sung"}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {reject
              ? `Người đăng ký thấy lý do trên hồ sơ của họ và được hoàn ${formatVnd(contract.fee_amount)} tiền hồ sơ. Tiền đặt trước đã nộp sẽ chuyển sang chờ hoàn trả.`
              : "Người đăng ký nộp lại giấy tờ trên sàn trước hạn đóng nhận hồ sơ."}
          </DialogDescription>
        </DialogHeader>

        {decision && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK[decision].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setNote(q);
                  setErr("");
                }}
                className="min-h-[30px] rounded-full bg-muted px-[11px] py-[5px] text-left text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <Textarea
          ref={ref}
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErr("");
          }}
          placeholder={reject ? "Lý do từ chối" : "Cần bổ sung gì?"}
          aria-label={reject ? "Lý do từ chối" : "Nội dung cần bổ sung"}
          className="text-[13.5px]"
        />
        {err && <p className="text-[12.5px] font-medium text-destructive">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" className={DIALOG_BTN} onClick={() => onOpenChange(false)} disabled={review.isPending}>
            Huỷ
          </Button>
          <Button
            variant={reject ? "destructive" : "default"}
            className={DIALOG_BTN}
            onClick={submit}
            disabled={review.isPending}
          >
            {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {reject ? "Xác nhận từ chối" : "Gửi yêu cầu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

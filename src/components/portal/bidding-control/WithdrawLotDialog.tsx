import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/** Giống org_pause_lot: lý do ≥ 3 ký tự sau khi trim. */
const MIN_REASON = 3;

interface Props {
  lot: AuctionSessionItem | null;
  state: LotState | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function WithdrawLotDialog({ lot, state, pending, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= MIN_REASON;
  const bidCount = state?.bid_count ?? 0;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) setReason("");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={!!lot} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rút lô {lot?.lot_no} khỏi phiên?</DialogTitle>
          <DialogDescription>
            {lot?.title} sẽ dừng hẳn, không nhận thêm lượt trả giá nào và không thể mở lại. Lý do hiển thị công khai.
          </DialogDescription>
        </DialogHeader>

        {bidCount > 0 && (
          // Tiền đặt trước tính theo PHIÊN chứ không theo lô, nên rút lô không
          // hoàn tiền cho ai — nói rõ để không bị hiểu nhầm là đã xử lý xong.
          <InfoBox variant="amber" className="text-sm">
            Lô đã có {bidCount} lượt trả giá. Rút lô không hoàn tiền đặt trước — tiền đặt trước tính theo phiên và được
            xử lý khi chốt kết quả.
          </InfoBox>
        )}

        <div className="space-y-1.5">
          <Label>
            Lý do rút lô <span className="text-destructive">*</span>
          </Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Chủ tài sản rút uỷ quyền, có tranh chấp về tài sản…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Giữ lô
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={!valid || pending}
            className="gap-1.5"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Rút lô
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

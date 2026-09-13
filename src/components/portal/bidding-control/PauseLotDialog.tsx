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
import type { AuctionSessionItem } from "@/types/auction-session";

/** org_pause_lot đòi lý do ≥ 3 ký tự sau khi trim (reason_required). */
const MIN_REASON = 3;

interface Props {
  lot: AuctionSessionItem | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function PauseLotDialog({ lot, pending, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= MIN_REASON;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) setReason("");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={!!lot} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạm dừng lô {lot?.lot_no}?</DialogTitle>
          <DialogDescription>
            Người tham gia không trả giá được cho tới khi bạn tiếp tục. Đồng hồ được giữ nguyên: khoảng thời gian tạm
            dừng sẽ được cộng bù vào giờ đóng lô. Lý do hiển thị công khai trong phòng đấu giá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>
            Lý do tạm dừng <span className="text-destructive">*</span>
          </Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Kiểm tra lại hồ sơ người trả giá, sự cố đường truyền…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={() => onConfirm(reason)} disabled={!valid || pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạm dừng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

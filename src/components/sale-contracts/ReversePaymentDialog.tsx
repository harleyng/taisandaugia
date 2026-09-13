import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatVnd } from "@/lib/advertising/slug";

const MIN_REASON = 5;

/**
 * Hoàn một bút toán. Sổ tiền CHỈ GHI THÊM: việc này tạo một dòng đối ứng mới
 * chứ không sửa dòng cũ — nói rõ để người dùng không tưởng là "xoá".
 */
export function ReversePaymentDialog({
  open, onOpenChange, amount, isPending, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  isPending: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hoàn bút toán {formatVnd(amount)}</DialogTitle>
          <DialogDescription>
            Số tiền này sẽ được cộng lại vào số còn phải trả và các kỳ liên quan sẽ mở lại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <InfoBox variant="muted">
            Sổ tiền chỉ ghi thêm: thao tác này tạo một <strong>bút toán đối ứng mới</strong>, dòng
            thu ban đầu vẫn nằm nguyên trong sổ để đối chiếu.
          </InfoBox>

          <div className="space-y-1.5">
            <Label htmlFor="sale-reverse-reason">Lý do</Label>
            <Textarea
              id="sale-reverse-reason"
              rows={3}
              value={reason}
              disabled={isPending}
              placeholder="Ví dụ: ngân hàng báo giao dịch bị huỷ…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={reason.trim().length < MIN_REASON || isPending}
            onClick={() => onSubmit(reason.trim())}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Hoàn bút toán
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

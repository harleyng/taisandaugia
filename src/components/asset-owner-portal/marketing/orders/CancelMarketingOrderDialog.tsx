import { useEffect, useState } from "react";
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
import { useCancelMarketingOrder } from "@/hooks/useOwnerMarketingOrders";

interface CancelMarketingOrderDialogProps {
  orderId: string | null;
  code: string;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

/** Huỷ yêu cầu chưa thanh toán (chờ báo giá / chờ thanh toán). */
export function CancelMarketingOrderDialog({ orderId, code, onOpenChange, onCancelled }: CancelMarketingOrderDialogProps) {
  const cancel = useCancelMarketingOrder();
  const [reason, setReason] = useState("");
  const open = !!orderId;

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const busy = cancel.isPending;
  const submit = () =>
    orderId && cancel.mutate({ orderId, reason: reason.trim() }, { onSuccess: () => onCancelled() });

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Huỷ yêu cầu {code}</DialogTitle>
          <DialogDescription>Sàn sẽ dừng xử lý yêu cầu này. Bạn chưa bị trừ tiền.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mkt-order-cancel-reason">
            Lý do huỷ <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="mkt-order-cancel-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            placeholder="Ví dụ: đã bán được tài sản, đổi kế hoạch truyền thông…"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Đóng
          </Button>
          <Button variant="destructive" disabled={reason.trim().length < 5 || busy} onClick={submit}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Huỷ yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Huỷ yêu cầu dịch vụ chưa thanh toán (hoàn tiền nằm ngoài phạm vi ⇒ đã trả thì không huỷ được).
 * `onSubmit` là mutateAsync của RPC huỷ riêng từng loại; lỗi đã được toast ở hook.
 */
export function ServiceCancelDialog({
  code,
  noun,
  description,
  placeholder,
  maxLength = 1000,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  code: string;
  /** "đơn" | "yêu cầu" — theo cách gọi đang dùng với người bán. */
  noun: string;
  description: string;
  placeholder: string;
  maxLength?: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = () =>
    onSubmit(reason).then(
      () => onOpenChange(false),
      // Lỗi đã được toast ở hook; giữ dialog mở để sửa lại.
      (): void => undefined,
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Huỷ {noun} {code}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="service-cancel-reason">Lý do huỷ</Label>
          <Textarea
            id="service-cancel-reason"
            rows={3}
            maxLength={maxLength}
            value={reason}
            placeholder={placeholder}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Đóng
          </Button>
          <Button variant="destructive" disabled={reason.trim().length < 5 || isPending} onClick={submit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Huỷ {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { useSetOwnerSubscriptionStatus } from "@/hooks/useAdminOwnerSubscriptions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subId: string;
}

/** Huỷ gói: thành viên trả credit lại ngay. Không hoàn tiền tự động — xử lý tay. */
export function CancelSubscriptionDialog({ open, onOpenChange, subId }: Props) {
  const setStatus = useSetOwnerSubscriptionStatus();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const valid = reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Huỷ gói thuê bao?</DialogTitle>
          <DialogDescription>
            Thành viên Trạm quay về trả credit ngay lập tức. Hệ thống không tự hoàn tiền phần còn lại của kỳ — xử lý hoàn tiền (nếu có) ngoài hệ thống.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Lý do huỷ <span className="text-destructive">*</span></Label>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button
            variant="destructive"
            disabled={!valid || setStatus.isPending}
            onClick={() =>
              setStatus.mutate({ subId, status: "cancelled", reason: reason.trim() }, { onSuccess: () => onOpenChange(false) })
            }
          >
            {setStatus.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Huỷ gói
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

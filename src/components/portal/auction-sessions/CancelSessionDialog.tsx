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
import { useCancelAuctionSession } from "@/hooks/useAuctionSessions";

interface Props {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_REASON = 5;

export function CancelSessionDialog({ sessionId, open, onOpenChange }: Props) {
  const cancel = useCancelAuctionSession();
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= MIN_REASON;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) setReason("");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Huỷ phiên đấu giá?</DialogTitle>
          <DialogDescription>
            Phiên vẫn hiện trên sàn với nhãn “Đã huỷ” kèm lý do bạn nhập, để người đang theo dõi không bị mất dấu. Không
            thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>
            Lý do huỷ <span className="text-destructive">*</span>
          </Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Chủ tài sản rút hồ sơ, dời lịch theo yêu cầu cơ quan thi hành án…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={cancel.isPending}>
            Giữ phiên
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancel.mutate({ id: sessionId, reason }, { onSuccess: () => close(false) })}
            disabled={!valid || cancel.isPending}
            className="gap-1.5"
          >
            {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Huỷ phiên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

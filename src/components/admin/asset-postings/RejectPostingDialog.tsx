import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { XCircle } from "lucide-react";
import { REJECT_REASON_PRESETS } from "@/lib/asset-posting/reviewStatus";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processing: boolean;
  onConfirm: (reason: string, notes: string) => void;
}

/** Từ chối hồ sơ — lý do BẮT BUỘC vì chủ tài sản sẽ đọc nó để biết phải sửa gì. */
export function RejectPostingDialog({ open, onOpenChange, processing, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const close = (v: boolean) => {
    if (!v) {
      setReason("");
      setNotes("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Từ chối hồ sơ tài sản</DialogTitle>
          <DialogDescription>
            Lý do sẽ hiển thị cho chủ tài sản để họ chỉnh sửa và nộp lại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASON_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Lý do từ chối (chủ tài sản sẽ đọc được)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <Textarea
            placeholder="Ghi chú nội bộ (tuỳ chọn, không hiện cho chủ tài sản)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={processing}>
            Huỷ
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason, notes)}
            disabled={processing || !reason.trim()}
            className="gap-1.5"
          >
            <XCircle className="h-4 w-4" />
            {processing ? "Đang xử lý..." : "Xác nhận từ chối"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

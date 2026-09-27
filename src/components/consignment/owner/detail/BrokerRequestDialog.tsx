import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import { useCreateBrokerRequest } from "@/hooks/useAssetPosting";

interface BrokerRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postingId: string;
}

/** Xác nhận "Nhờ sàn chọn giúp" + lời nhắn tuỳ chọn cho chuyên viên sàn. */
export function BrokerRequestDialog({ open, onOpenChange, postingId }: BrokerRequestDialogProps) {
  const [note, setNote] = useState("");
  const broker = useCreateBrokerRequest();

  const submit = () =>
    broker.mutate(
      { postingId, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setNote("");
          onOpenChange(false);
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !broker.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Nhờ sàn chọn giúp
          </DialogTitle>
          <DialogDescription>
            Chuyên viên sàn tìm và thương lượng với tổ chức phù hợp, bạn chỉ cần chọn báo giá. Miễn phí với chủ tài sản.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="broker-note">Ghi chú cho sàn (tuỳ chọn)</Label>
          <Textarea
            id="broker-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mong muốn cụ thể của bạn về tổ chức hoặc phiên đấu giá…"
            className="min-h-[80px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={broker.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={broker.isPending} className="gap-2">
            {broker.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Nhờ sàn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

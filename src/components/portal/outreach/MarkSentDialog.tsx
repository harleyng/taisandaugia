import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMarkChannelSent } from "@/hooks/useSessionOutreach";
import { SEND_CHANNEL_LABELS } from "@/lib/outreach/labels";
import type { OutreachSendChannel } from "@/types/outreach";

interface Props {
  sessionId: string;
  packId: string | null;
  target: { channel: OutreachSendChannel; text: string } | null;
  onClose: () => void;
}

export function MarkSentDialog({ sessionId, packId, target, onClose }: Props) {
  const mark = useMarkChannelSent(sessionId);
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [target]);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Đánh dấu đã đăng — {target ? SEND_CHANNEL_LABELS[target.channel] : ""}</DialogTitle>
          <DialogDescription>
            Hệ thống không tự gửi. Chỉ bấm xác nhận sau khi bạn đã đăng / gửi thật; nội dung dưới đây được lưu làm bằng
            chứng và không sửa được.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-xs">
            {target?.text}
          </pre>
          <div className="space-y-1.5">
            <Label>Ghi chú (tuỳ chọn)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: đăng nhóm Zalo BĐS Quận 5, link bài…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            disabled={!packId || !target || mark.isPending}
            onClick={() =>
              packId && target && mark.mutate({ packId, channel: target.channel, text: target.text, note }, { onSuccess: onClose })
            }
          >
            {mark.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận đã đăng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

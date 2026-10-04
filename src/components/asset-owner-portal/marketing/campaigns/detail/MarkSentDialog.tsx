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
import { useMarkCampaignSent } from "@/hooks/useOwnerMarketingCampaigns";
import { CAMPAIGN_CHANNEL_META, type CampaignChannel } from "@/lib/ownerMarketing/campaigns";

interface MarkSentDialogProps {
  campaignId: string;
  channel: CampaignChannel | null;
  onOpenChange: (open: boolean) => void;
}

/** "Đánh dấu đã gửi" một kênh (truyen-thong:share) — ghi kênh + thời điểm vào nhật ký. */
export function MarkSentDialog({ campaignId, channel, onOpenChange }: MarkSentDialogProps) {
  const mark = useMarkCampaignSent();
  const [note, setNote] = useState("");
  useEffect(() => {
    if (channel) setNote("");
  }, [channel]);

  const label = channel ? CAMPAIGN_CHANNEL_META[channel].label : "";
  return (
    <Dialog open={!!channel} onOpenChange={(v) => !mark.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Đánh dấu đã gửi qua {label}</DialogTitle>
          <DialogDescription>
            Xác nhận đơn vị đã gửi nội dung này qua kênh {label}. Thời điểm gửi được ghi vào lịch sử chiến dịch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mkt-sent-note">Ghi chú</Label>
          <Textarea
            id="mkt-sent-note"
            rows={2}
            maxLength={500}
            placeholder="VD: Gửi nhóm Zalo khách hàng ưu tiên CN Quận 7 (≈ 300 người)"
            value={note}
            disabled={mark.isPending}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Không ghi tên hay số điện thoại của khách.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={mark.isPending} onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            disabled={mark.isPending || !channel}
            onClick={() => channel && mark.mutate({ id: campaignId, channel, note }, { onSuccess: () => onOpenChange(false) })}
          >
            {mark.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Đã gửi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

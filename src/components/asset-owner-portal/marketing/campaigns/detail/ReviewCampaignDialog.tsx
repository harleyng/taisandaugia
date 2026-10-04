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
import { useApproveCampaign, useRejectCampaign } from "@/hooks/useOwnerMarketingCampaigns";
import { REJECT_REASON_MAX, REJECT_REASON_MIN, type CampaignRow } from "@/lib/ownerMarketing/campaigns";

interface ReviewCampaignDialogProps {
  campaign: CampaignRow;
  /** null = đóng. */
  mode: "approve" | "reject" | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Duyệt / từ chối chiến dịch (truyen-thong:finalize). Duyệt ⇒ sàn tạo link Hồ sơ online
 * cho từng tài sản × kênh. Từ chối bắt buộc có lý do để người soạn sửa.
 */
export function ReviewCampaignDialog({ campaign, mode, onOpenChange }: ReviewCampaignDialogProps) {
  const approve = useApproveCampaign();
  const reject = useRejectCampaign();
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (mode) {
      setText("");
      setTouched(false);
    }
  }, [mode]);

  const busy = approve.isPending || reject.isPending;
  const isReject = mode === "reject";
  const reasonOk = text.trim().length >= REJECT_REASON_MIN;
  const links = campaign.assetKeys.length * campaign.channels.length;

  const confirm = () => {
    if (isReject) {
      setTouched(true);
      if (!reasonOk) return;
      reject.mutate({ id: campaign.id, reason: text }, { onSuccess: () => onOpenChange(false) });
    } else {
      approve.mutate({ id: campaign.id, note: text }, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={!!mode} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isReject ? "Từ chối chiến dịch" : "Duyệt chiến dịch"}</DialogTitle>
          <DialogDescription>
            {isReject
              ? "Chiến dịch quay về người soạn kèm lý do. Họ sửa xong có thể gửi duyệt lại."
              : `Sàn sẽ tạo ${links} link Hồ sơ online (${campaign.assetKeys.length} tài sản × ${campaign.channels.length} kênh) và ghép vào nội dung để đơn vị gửi đi.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mkt-review-text">
            {isReject ? (
              <>
                Lý do <span className="text-destructive">*</span>
              </>
            ) : (
              "Ghi chú duyệt"
            )}
          </Label>
          <Textarea
            id="mkt-review-text"
            rows={3}
            maxLength={isReject ? REJECT_REASON_MAX : 500}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {isReject && touched && !reasonOk && (
            <p className="text-xs text-destructive">Nhập lý do (ít nhất {REJECT_REASON_MIN} ký tự).</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button variant={isReject ? "destructive" : "default"} disabled={busy} onClick={confirm}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isReject ? "Từ chối" : "Duyệt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { InfoBox } from "@/components/shared/InfoBox";
import type { FinalizePreview } from "@/lib/bidding/finalize";

/**
 * Xác nhận chốt kết quả. KHÔNG hoàn tác được: org_finalize_session đặt
 * finalized_at rồi mọi RPC điều hành đều trả invalid_status / already_finalized,
 * và tiền đặt trước của cả phiên đổi trạng thái trong cùng một giao dịch.
 */

interface Props {
  open: boolean;
  sessionTitle: string;
  preview: FinalizePreview;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function FinalizeSessionDialog({ open, sessionTitle, preview, pending, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chốt kết quả phiên?</DialogTitle>
          <DialogDescription>{sessionTitle}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-muted p-3 text-sm">
          <dt className="text-muted-foreground">Lô đấu giá thành</dt>
          <dd className="text-right font-medium text-foreground">{preview.sold}</dd>
          <dt className="text-muted-foreground">Lô không thành</dt>
          <dd className="text-right font-medium text-foreground">{preview.unsold}</dd>
          <dt className="text-muted-foreground">Lô đã rút</dt>
          <dd className="text-right font-medium text-foreground">{preview.withdrawn}</dd>
          <dt className="text-muted-foreground">Hồ sơ chuyển thành tiền mua</dt>
          <dd className="text-right font-medium text-foreground">{preview.applied}</dd>
          <dt className="text-muted-foreground">Hồ sơ chờ hoàn trả</dt>
          <dd className="text-right font-medium text-foreground">{preview.pendingRefund}</dd>
        </dl>

        <InfoBox variant="amber" className="text-sm">
          Không hoàn tác được. Sau khi chốt, không mở hay đóng lô được nữa; tiền đặt trước chuyển sang “Chuyển vào tiền
          mua tài sản” hoặc “Chờ hoàn trả”. Biên bản đấu giá chỉ phát hành được sau bước này.
        </InfoBox>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Chưa chốt
          </Button>
          <Button onClick={onConfirm} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Chốt kết quả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

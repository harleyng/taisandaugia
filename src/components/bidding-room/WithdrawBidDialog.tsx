import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/advertising/slug";
import type { LotBid } from "@/types/auction-bidding";

/**
 * Cảnh báo trước khi rút lại lượt đang dẫn đầu.
 *
 * Hậu quả phải nói ĐÚNG như SQL làm (withdraw_bid, 20260913000001):
 *  - Chỉ LÔ NÀY quay về lượt hợp lệ trước đó.
 *  - Tiền đặt trước tính theo PHIÊN nên bị tịch thu ngay, không hoàn lại.
 *  - Mất tiền đặt trước ⇒ không trả giá tiếp ở BẤT KỲ lô nào của phiên, và
 *    không vào lại được phòng đấu giá.
 *  - Các lô khác đang dẫn đầu thì VẪN giữ và vẫn có thể trúng.
 */

interface Props {
  bid: LotBid | null;
  lotTitle: string;
  depositAmount: number | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (bidId: string) => void;
}

export function WithdrawBidDialog({ bid, lotTitle, depositAmount, pending, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={!!bid} onOpenChange={(open) => !open && !pending && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rút lại giá {formatVnd(bid?.amount)}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>«{lotTitle}» sẽ quay về lượt trả giá hợp lệ trước đó.</p>
              <p className="font-semibold text-destructive">
                Tiền đặt trước của cả phiên{depositAmount ? ` (${formatVnd(depositAmount)})` : ""} bị tịch thu ngay và
                không được hoàn lại.
              </p>
              <p>
                Sau khi rút, bạn <strong>không trả giá tiếp được ở bất kỳ lô nào</strong> của phiên này và không vào lại
                phòng đấu giá. Những lô khác bạn đang dẫn đầu vẫn được giữ và vẫn có thể trúng đấu giá.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Giữ lượt trả giá</AlertDialogCancel>
          <Button
            variant="destructive"
            className="gap-1.5"
            disabled={pending || !bid}
            onClick={() => bid && onConfirm(bid.id)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Rút lại giá
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

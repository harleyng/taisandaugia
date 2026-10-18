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
import { formatMoneyFull } from "@/utils/money";
import type { LotBid } from "@/types/auction-bidding";

/**
 * Cảnh báo trước khi rút lại lượt đang dẫn đầu.
 *
 * Hậu quả phải nói ĐÚNG như SQL làm (withdraw_bid, 20260913000001):
 *  - Chỉ LÔ NÀY quay về lượt hợp lệ trước đó.
 *  - Tiền đặt trước tính theo PHIÊN nên bị tịch thu ngay, không hoàn lại.
 *  - Mất tiền đặt trước ⇒ không trả giá tiếp ở BẤT KỲ lô nào của phiên (vẫn
 *    vào phòng ở chế độ chỉ xem — roomGateOf trả view_only 'forfeited').
 *  - Các lô khác đang dẫn đầu thì VẪN giữ và vẫn có thể trúng.
 */

interface Props {
  bid: LotBid | null;
  lotNo: number;
  depositAmount: number | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (bidId: string) => void;
}

export function WithdrawBidDialog({ bid, lotNo, depositAmount, pending, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={!!bid} onOpenChange={(open) => !open && !pending && onOpenChange(false)}>
      <AlertDialogContent className="max-w-[440px] gap-0 rounded-[14px] p-[22px]">
        <AlertDialogHeader className="space-y-0 text-left">
          <AlertDialogTitle className="mb-1.5 text-[17px]">Rút lại giá {formatMoneyFull(bid?.amount)}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[13.5px] text-muted-foreground">
              <p>
                Đây là lượt đang dẫn đầu của bạn ở tài sản {lotNo}. Giá sẽ quay về lượt hợp lệ liền trước. Những tài sản
                khác bạn đang dẫn đầu vẫn được giữ.
              </p>
              <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
                Bạn sẽ <b>mất toàn bộ tiền đặt trước{depositAmount ? ` ${formatMoneyFull(depositAmount)}` : ""}</b> và
                không được trả giá tiếp trong phiên này.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-[18px] gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            Giữ nguyên
          </AlertDialogCancel>
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

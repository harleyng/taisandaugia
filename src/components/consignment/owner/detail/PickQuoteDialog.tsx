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
import { formatMoneyShort } from "@/utils/money";
import { formatPct } from "@/lib/consignment/ownerConsignmentView";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";

interface PickQuoteDialogProps {
  /** Báo giá đang chờ xác nhận; null = đóng. */
  quote: RequestWithOrg | null;
  /** Yêu cầu / báo giá khác còn mở sẽ bị đóng khi chốt. */
  otherOpenCount: number;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Xác nhận trước khi chốt một báo giá — chốt là cam kết: đóng mọi báo giá còn lại
 * và mở cơ hội trong CRM. Nút xác nhận là Button thường (không phải
 * AlertDialogAction) để hộp thoại còn mở trong lúc RPC chạy.
 */
export function PickQuoteDialog({ quote, otherOpenCount, isPending, onConfirm, onClose }: PickQuoteDialogProps) {
  const figures = quote
    ? [
        quote.quote_commission_pct != null && `Thù lao ${formatPct(quote.quote_commission_pct)}`,
        quote.quote_starting_price != null && `giá khởi điểm ${formatMoneyShort(quote.quote_starting_price)}`,
        quote.quote_lead_time_days != null && `${quote.quote_lead_time_days} ngày`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <AlertDialog open={!!quote} onOpenChange={(o) => !o && !isPending && onClose()}>
      <AlertDialogContent className="max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Chọn {quote?.org?.name ?? "tổ chức này"}?</AlertDialogTitle>
          <AlertDialogDescription className="[text-wrap:pretty]">
            {figures && `${figures}. `}
            {otherOpenCount > 0
              ? `${otherOpenCount} yêu cầu còn lại sẽ đóng và không mở lại được trừ khi hợp đồng bị huỷ.`
              : "Tổ chức được chọn sẽ bắt đầu soạn hợp đồng dịch vụ."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận chọn
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

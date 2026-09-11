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
import type { RequestWithOrg } from "@/hooks/useAssetPosting";

interface AcceptQuoteDialogProps {
  /** Báo giá đang chờ xác nhận; null = đóng hộp thoại. */
  quote: RequestWithOrg | null;
  /** Số yêu cầu / báo giá khác còn mở sẽ bị đóng khi chốt. */
  otherOpenCount: number;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Xác nhận trước khi chốt một báo giá.
 *
 * Chốt là cam kết: đóng mọi báo giá còn lại của hồ sơ và mở cơ hội trong CRM,
 * nên không cho bấm một phát là xong. Nút xác nhận là Button thường (không phải
 * AlertDialogAction) để hộp thoại còn mở trong lúc RPC chạy.
 */
export function AcceptQuoteDialog({
  quote,
  otherOpenCount,
  isPending,
  onConfirm,
  onOpenChange,
}: AcceptQuoteDialogProps) {
  const orgName = quote?.org?.name ?? "tổ chức đấu giá này";

  return (
    <AlertDialog open={!!quote} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chọn {orgName} làm tổ chức đấu giá?</AlertDialogTitle>
          <AlertDialogDescription>
            Đây là cam kết, không phải thao tác nháp. Kiểm tra lại các con số trước khi xác nhận.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {quote && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <Figure
              label="Thù lao"
              value={quote.quote_commission_pct != null ? `${quote.quote_commission_pct}%` : "—"}
            />
            <Figure
              label="Phí dịch vụ"
              value={quote.quote_service_fee != null ? formatVnd(quote.quote_service_fee) : "—"}
            />
            <Figure
              label="Giá khởi điểm đề xuất"
              value={quote.quote_starting_price != null ? formatVnd(quote.quote_starting_price) : "—"}
            />
            <Figure
              label="Thời gian dự kiến"
              value={quote.quote_lead_time_days != null ? `${quote.quote_lead_time_days} ngày` : "—"}
            />
          </div>
        )}

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Mỗi hồ sơ chỉ chốt được <span className="font-medium text-foreground">một</span> tổ chức đấu giá.
          </li>
          {otherOpenCount > 0 && <li>{otherOpenCount} yêu cầu / báo giá còn lại sẽ đóng lại.</li>}
          <li>
            Bước tiếp theo: tổ chức soạn hợp đồng dịch vụ đấu giá theo đúng báo giá này; hai bên ký và xác nhận
            trên sàn.
          </li>
          <li>Trước khi ký, bên nào cũng huỷ được (kèm lý do) — các báo giá khác sẽ mở lại để bạn chọn.</li>
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Để sau</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận chọn
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

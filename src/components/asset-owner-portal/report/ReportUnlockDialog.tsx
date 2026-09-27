import { Coins, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterLabel: string;
  cost: number;
  balance: number;
  /** Hết hạn mức gói, đang tính credit theo chế độ "trừ credit". */
  quotaExhausted?: boolean;
  pending: boolean;
  onConfirm: () => void;
}

/** Xác nhận trừ credit khi mở khoá báo cáo danh mục với bộ lọc tuỳ chỉnh. */
export function ReportUnlockDialog({ open, onOpenChange, filterLabel, cost, balance, quotaExhausted, pending, onConfirm }: Props) {
  const short = balance < cost;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#1f3a2a] to-[#15291d] px-6 py-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-lg">
            <Coins className="h-5 w-5 text-yellow-950" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-white">Xác nhận mở khoá báo cáo</h3>
          <p className="mt-1 text-xs text-green-300">Phân tích riêng theo tiêu chí của bạn</p>
        </div>
        <div className="px-6 py-5">
          {quotaExhausted && (
            <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
              Đã hết lượt xem của gói thuê bao tháng này — lượt này tính credit.
            </p>
          )}
          <div className="divide-y divide-border">
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Bộ lọc</span>
              <span className="max-w-[180px] truncate text-right font-medium text-foreground">{filterLabel}</span>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Chi phí</span>
              <span className="font-mono font-semibold">⊛{cost} tín dụng</span>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">Số dư của bạn</span>
              <span className={cn("font-mono font-semibold", short ? "text-destructive" : "text-foreground")}>⊛{balance}</span>
            </div>
          </div>
          {short && <p className="mt-3 text-xs text-destructive">Không đủ tín dụng. Vui lòng nạp thêm để tiếp tục.</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              Để sau
            </button>
            <button
              onClick={onConfirm}
              disabled={pending || short}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Mở khoá · ⊛{cost}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

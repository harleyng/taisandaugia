import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins } from "lucide-react";
import { OWNER_REPORT_COST } from "@/lib/credits";
import type { PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  open: boolean;
  filter: PortfolioFilter;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function filterSummary(f: PortfolioFilter): string {
  const parts: string[] = [];
  if (f.propertyTypeSlugs?.length) parts.push(`Loại TS: ${f.propertyTypeSlugs.join(", ")}`);
  if (f.provinces?.length) parts.push(`Tỉnh: ${f.provinces.join(", ")}`);
  if (f.auctionOrgIds?.length) parts.push(`${f.auctionOrgIds.length} TCDG`);
  if (f.dateFrom || f.dateTo) parts.push(`${f.dateFrom ?? "..."} → ${f.dateTo ?? "..."}`);
  return parts.join(" · ") || "Toàn bộ danh mục";
}

export function ReportConfirmDialog({ open, filter, onConfirm, onCancel, isLoading }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xem báo cáo</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>Tổ hợp bộ lọc:</p>
            <p className="font-medium text-foreground bg-muted rounded-lg px-3 py-2 text-sm">
              {filterSummary(filter)}
            </p>
            <p>
              Mỗi lần xem báo cáo với bộ lọc tùy chỉnh sẽ tiêu{" "}
              <span className="font-semibold text-foreground inline-flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {OWNER_REPORT_COST} tín dụng
              </span>
              . Phí sẽ được trừ ngay khi xác nhận.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isLoading}>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Đang xử lý..." : `Xác nhận · ${OWNER_REPORT_COST} tín dụng`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

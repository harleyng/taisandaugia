import { useNavigate } from "react-router-dom";
import { ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import { TARGET_PERIOD_LABEL } from "@/lib/ownerTargets";
import {
  REPORT_STATUS_LABEL,
  formatReportDay,
  reportHref,
  reportPrintHref,
  reportTitle,
  type OwnerReportListItem,
} from "@/lib/ownerPeriodicReport";
import { shareListLabel } from "@/lib/ownerReportShare";

interface OwnerReportsTableProps {
  rows: OwnerReportListItem[];
  emptyText: string;
  /** Phạm vi đã tra tên (bản nháp theo chi nhánh hiện tại, đã chốt theo phạm vi đóng băng). */
  scopeOf: (r: OwnerReportListItem) => string;
  preparedBy: (r: OwnerReportListItem) => string;
}

const STATUS_BADGE: Record<OwnerReportListItem["status"], string> = {
  draft: "bg-warning/10 text-warning",
  final: "bg-success/10 text-success",
};

/**
 * Bảng báo cáo định kỳ — cùng kiểu với bảng hợp đồng mua bán của cổng chủ tài
 * sản. Cả dòng bấm được; ô tên báo cáo là nút thật để dùng được bằng bàn phím.
 */
export function OwnerReportsTable({ rows, emptyText, scopeOf, preparedBy }: OwnerReportsTableProps) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Báo cáo</th>
            <th className="px-4 py-3 font-medium">Loại kỳ</th>
            <th className="px-4 py-3 font-medium">Người lập</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
            <th className="px-4 py-3 font-medium">Ngày chốt</th>
            <th className="px-4 py-3 text-right font-medium">Đã thu</th>
            <th className="px-4 py-3 font-medium">Chia sẻ</th>
            <th className="w-20 px-2 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = () => navigate(reportHref(r.id));
            const share = r.status === "final" ? shareListLabel(r.share) : null;
            return (
              <tr
                key={r.id}
                onClick={open}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    className="rounded-sm text-left font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {reportTitle(r.periodType, r.periodStart)}
                  </button>
                  <div className="max-w-[18rem] truncate text-xs text-muted-foreground">{scopeOf(r)}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{TARGET_PERIOD_LABEL[r.periodType]}</td>
                <td className="px-4 py-3">
                  <div className="max-w-[11rem] truncate">{preparedBy(r)}</div>
                  <div className="text-xs text-muted-foreground">Lập {formatReportDay(r.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", STATUS_BADGE[r.status])}>
                    {REPORT_STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {r.finalizedAt ? formatReportDay(r.finalizedAt) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-medium tabular-nums">
                    {r.collected !== null ? formatMoneyShort(r.collected) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.soldCount !== null ? `${r.soldCount} tài sản đấu thành` : r.status === "draft" ? "Số liệu trực tiếp" : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {share ?? (r.status === "final" ? "Chưa chia sẻ" : "—")}
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {r.status === "final" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="In / lưu PDF"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`${reportPrintHref(r.id)}?auto=1`, "_blank", "noopener");
                            }}
                          >
                            <Printer className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>In / lưu PDF</TooltipContent>
                      </Tooltip>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

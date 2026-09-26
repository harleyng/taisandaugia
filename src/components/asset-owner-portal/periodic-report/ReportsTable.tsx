import { Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import {
  REPORT_STATUS_LABEL,
  formatReportDay,
  reportHref,
  reportPrintHref,
  reportScopeLabel,
  reportTitle,
  type OwnerReportListItem,
} from "@/lib/ownerPeriodicReport";
import { shareListLabel } from "@/lib/ownerReportShare";

const GRID = "md:grid md:grid-cols-[minmax(0,2.2fr)_7rem_minmax(0,1.3fr)_7rem_7rem_2.75rem] md:items-center md:gap-4";

interface ReportsTableProps {
  reports: OwnerReportListItem[];
  /** workspace_branches.id → tên (cho bản nháp; báo cáo đã chốt dùng phạm vi đóng băng). */
  branchNames: ReadonlyMap<string, string>;
  /** user id → tên thành viên. */
  memberNames: ReadonlyMap<string, string>;
}

/** L4: mọi báo cáo đã lập, mới nhất trước. Bấm dòng ⇒ xem / sửa nháp; nút in cho báo cáo đã chốt. */
export function ReportsTable({ reports, branchNames, memberNames }: ReportsTableProps) {
  const navigate = useNavigate();

  const scopeOf = (r: OwnerReportListItem) =>
    r.frozenScope
      ? reportScopeLabel(r.frozenScope)
      : r.branchId
        ? branchNames.get(r.branchId) ?? "Chi nhánh"
        : "Toàn đơn vị";
  const preparedBy = (r: OwnerReportListItem) =>
    (r.createdBy && memberNames.get(r.createdBy)) || r.frozenPreparedBy || "—";

  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Báo cáo</span>
        <span>Trạng thái</span>
        <span>Người lập</span>
        <span>Ngày chốt</span>
        <span className="text-right">Đã thu</span>
        <span />
      </div>
      <ul className="divide-y">
        {reports.map((r) => (
          <li
            key={r.id}
            className={cn(
              "relative flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 transition-colors hover:bg-muted/40",
              GRID,
            )}
          >
            <div className="min-w-0 basis-full md:basis-auto">
              <button
                type="button"
                onClick={() => navigate(reportHref(r.id))}
                className="text-left font-medium text-foreground after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {reportTitle(r.periodType, r.periodStart)}
              </button>
              <p className="truncate text-xs text-muted-foreground">
                {[scopeOf(r), shareListLabel(r.share)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div>
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0 text-[11px] font-medium",
                  r.status === "final" ? "border-success/30 bg-success/10 text-foreground" : "text-muted-foreground",
                )}
              >
                {REPORT_STATUS_LABEL[r.status]}
              </Badge>
            </div>
            <p className="min-w-0 truncate text-muted-foreground">{preparedBy(r)}</p>
            {/* Nháp chưa có ngày chốt / số đã thu: mobile bỏ hẳn, desktop giữ "—" cho thẳng cột. */}
            <p className={cn("tabular-nums text-muted-foreground", !r.finalizedAt && "hidden md:block")}>
              {r.finalizedAt ? (
                <>
                  <span className="md:hidden">chốt </span>
                  {formatReportDay(r.finalizedAt)}
                </>
              ) : (
                "—"
              )}
            </p>
            <p className={cn("tabular-nums text-foreground md:text-right", r.collected === null && "hidden md:block")}>
              {r.collected !== null ? formatMoneyShort(r.collected) : "—"}
            </p>
            <div className="relative z-10 md:text-right">
              {r.status === "final" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="In / lưu PDF"
                      onClick={() => window.open(`${reportPrintHref(r.id)}?auto=1`, "_blank", "noopener")}
                    >
                      <Printer className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>In / lưu PDF</TooltipContent>
                </Tooltip>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

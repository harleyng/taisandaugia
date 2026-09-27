import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { formatMoneyShort } from "@/utils/money";
import { formatReportDay, reportHref, reportTitle, type OwnerReportListItem } from "@/lib/ownerPeriodicReport";
import { reportDueDate, reportRangeLabel, type ReportFigures } from "@/lib/ownerReportDigest";
import { ReportStatusChip } from "./ReportStatusChip";

interface OwnerReportsTableProps {
  rows: OwnerReportListItem[];
  /** Số chính của từng báo cáo: đã chốt ⇒ đóng băng, nháp ⇒ tính trực tiếp (undefined khi đang tải). */
  figuresOf: (r: OwnerReportListItem) => ReportFigures | undefined;
  /** Phạm vi đã tra tên — chỉ hiện khi báo cáo theo chi nhánh. */
  scopeOf: (r: OwnerReportListItem) => string;
  today: string;
}

const Num = ({ children }: { children: ReactNode }) => (
  <td className="px-2.5 py-3 text-right tabular-nums">{children}</td>
);

/**
 * Bảng báo cáo định kỳ (design "Bao Cao Dinh Ky"): Kỳ · Giá trúng · Đạt chỉ tiêu ·
 * Đã thu · Trạng thái. Cả dòng bấm được; tên kỳ là nút thật cho bàn phím.
 */
export function OwnerReportsTable({ rows, figuresOf, scopeOf, today }: OwnerReportsTableProps) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-[13.5px]">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="whitespace-nowrap pb-2 pr-2.5 pt-3 font-medium">Kỳ báo cáo</th>
            <th className="whitespace-nowrap px-2.5 pb-2 pt-3 text-right font-medium">Giá trúng</th>
            <th className="whitespace-nowrap px-2.5 pb-2 pt-3 text-right font-medium">Đạt chỉ tiêu</th>
            <th className="whitespace-nowrap px-2.5 pb-2 pt-3 text-right font-medium">Đã thu</th>
            <th className="whitespace-nowrap px-2.5 pb-2 pt-3 font-medium">Trạng thái</th>
            <th className="w-6 pb-2 pt-3" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = () => navigate(reportHref(r.id));
            const f = figuresOf(r);
            const due = reportDueDate(r.periodType, r.periodStart);
            const range = reportRangeLabel(r.periodType, r.periodStart);
            return (
              <tr
                key={r.id}
                onClick={open}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="py-3 pr-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    className="rounded-sm text-left font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {reportTitle(r.periodType, r.periodStart).replace(/^Báo cáo /, "").replace(/^./, (c) => c.toUpperCase())}
                  </button>
                  <div className="text-[12.5px] tabular-nums text-muted-foreground">
                    {range}
                    {r.branchId && ` · ${scopeOf(r)}`}
                  </div>
                </td>
                <Num>
                  <span className="font-semibold">{f ? formatMoneyShort(f.soldValue) : "—"}</span>
                </Num>
                <Num>{f && f.targetPct !== null ? `${f.targetPct}%` : "—"}</Num>
                <Num>{f ? formatMoneyShort(f.collected) : "—"}</Num>
                <td className="px-2.5 py-3">
                  <ReportStatusChip status={r.status} />
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {r.status === "draft"
                      ? `${today > due ? "Quá hạn" : "Hạn"} ${formatReportDay(due)}`
                      : `Chốt ${formatReportDay(r.finalizedAt)}`}
                  </span>
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  <ChevronRight className="ml-auto h-4 w-4" aria-hidden />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

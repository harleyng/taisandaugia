import { Button } from "@/components/ui/button";
import { formatReportDay, reportTitle, type OwnerReportListItem } from "@/lib/ownerPeriodicReport";

interface ReportDueCardProps {
  report: OwnerReportListItem;
  dueDate: string;
  overdue: boolean;
  onOpen: () => void;
}

/** Thẻ nhắc đầu danh sách: bản nháp sớm nhất đã có số liệu, chờ rà soát và chốt. */
export function ReportDueCard({ report, dueDate, overdue, onOpen }: ReportDueCardProps) {
  const title = reportTitle(report.periodType, report.periodStart);
  const missing = report.notes?.trim() ? "đã có nhận định — chỉ còn chốt" : "còn thiếu nhận định & đề xuất";
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-warning/10 px-[18px] py-4">
      <div className="min-w-[220px] flex-1">
        <p className="text-[15px] font-semibold text-foreground">{title} đã sẵn sàng</p>
        <p className="text-[13px] tabular-nums text-warning">
          {overdue ? "Quá hạn chốt" : "Hạn chốt"} {formatReportDay(dueDate)} · {missing}
        </p>
      </div>
      <Button onClick={onOpen}>Rà soát & chốt</Button>
    </div>
  );
}

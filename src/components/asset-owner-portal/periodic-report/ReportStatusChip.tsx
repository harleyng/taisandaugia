import { cn } from "@/lib/utils";
import { REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/ownerPeriodicReport";

const STYLE: Record<ReportStatus, string> = {
  draft: "bg-warning/10 text-warning",
  final: "bg-primary/10 text-primary",
};

/** "Chờ chốt" (vàng) / "Đã chốt" (xanh) — dùng chung cho danh sách, thẻ nhắc và trang chi tiết. */
export function ReportStatusChip({ status, className }: { status: ReportStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        STYLE[status],
        className,
      )}
    >
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}

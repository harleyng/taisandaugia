import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
  className?: string;
}

/** Khung card chung cho các biểu đồ/bảng trong báo cáo (title + skeleton + empty). */
export default function ReportCard({
  title,
  subtitle,
  loading,
  empty,
  emptyText = "Chưa có dữ liệu trong khoảng đã chọn",
  children,
  className = "",
}: Props) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 space-y-4 ${className}`}>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {loading ? (
        <div className="h-48 rounded-lg bg-muted animate-pulse" />
      ) : empty ? (
        <div className="h-48 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

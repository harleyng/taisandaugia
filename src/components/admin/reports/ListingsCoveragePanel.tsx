import type { CoverageStat } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  data: CoverageStat[];
  loading?: boolean;
}

/** Ngưỡng cảnh báo: dưới 50% thì tô hổ phách để lộ trường dữ liệu đang thiếu nhiều. */
const LOW = 50;

export default function ListingsCoveragePanel({ data, loading }: Props) {
  const empty = !loading && (data.length === 0 || data.every((c) => c.total === 0));

  return (
    <ReportCard
      title="Độ đầy đủ dữ liệu"
      subtitle="Tỉ lệ tin có đủ từng trường — trường thiếu nhiều làm lệch mọi con số phía trên"
      loading={loading}
      empty={empty}
    >
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
        {data.map((c) => {
          const low = c.pct < LOW;
          return (
            <div key={c.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{c.label}</span>
                <span className="tabular-nums">
                  <span className={low ? "font-medium text-amber-700" : "font-medium text-foreground"}>
                    {c.pct.toFixed(0)}%
                  </span>
                  <span className="text-muted-foreground/70 ml-1.5">
                    {c.count.toLocaleString("vi-VN")}/{c.total.toLocaleString("vi-VN")}
                  </span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, c.pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ReportCard>
  );
}

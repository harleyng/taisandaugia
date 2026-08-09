import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatVndCompact, type Granularity } from "@/lib/reports/transactionReport";
import type { ListingsTimeBucket } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  data: ListingsTimeBucket[];
  loading?: boolean;
  /** Ngày/Tuần/Tháng sống Ở ĐÂY: đây là biểu đồ DUY NHẤT dùng tới granularity,
   *  để ở thanh lọc cấp trang sẽ khiến người dùng tưởng nó lọc cả trang. */
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
];

const pill = (active: boolean) =>
  [
    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "bg-muted text-muted-foreground hover:text-foreground",
  ].join(" ");

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const BAR = "hsl(152 60% 26%)";
const LINE = "hsl(43 96% 56%)";

export default function ListingsTrendChart({
  data,
  loading,
  granularity,
  onGranularityChange,
}: Props) {
  const empty = !loading && data.every((d) => d.listings === 0);
  const tickStep = Math.max(0, Math.ceil(data.length / 6) - 1);

  return (
    <ReportCard
      title="Tin đăng mới theo thời gian"
      subtitle="Cột: số tin mới · Đường: tổng giá trị khởi điểm"
      loading={loading}
      empty={empty}
      action={
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Gộp theo</span>
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => onGranularityChange(g.key)}
              className={pill(granularity === g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            interval={tickStep}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatVndCompact}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value: number, name: string) =>
              name === "Giá trị khởi điểm"
                ? [formatVnd(value), name]
                : [`${value.toLocaleString("vi-VN")} tin`, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Bar
            yAxisId="left"
            dataKey="listings"
            name="Tin mới"
            fill={BAR}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="value"
            name="Giá trị khởi điểm"
            stroke={LINE}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatVndCompact, type PackageStat } from "@/lib/reports/transactionReport";
import ReportCard from "./ReportCard";

interface Props {
  data: PackageStat[];
  loading?: boolean;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

const COLORS = [
  "hsl(210 90% 30%)",
  "hsl(43 96% 56%)",
  "hsl(142 76% 36%)",
  "hsl(262 60% 55%)",
  "hsl(199 89% 48%)",
  "hsl(215 16% 60%)",
];

export default function RevenueByPackageChart({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.vnd, 0);
  const empty = !loading && data.length === 0;
  const rows = data.map((d) => ({ ...d, share: total > 0 ? (d.vnd / total) * 100 : 0 }));

  return (
    <ReportCard
      title="Doanh thu theo gói nạp"
      subtitle="Nguồn doanh thu đến từ gói credit nào"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatVndCompact(v)}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value: number, _name, item) => {
              const p = item?.payload as (typeof rows)[number];
              return [`${formatVnd(value)} · ${p.count} lượt · ${p.share.toFixed(1)}%`, p.label];
            }}
          />
          <Bar dataKey="vnd" radius={[0, 4, 4, 0]} barSize={18}>
            {rows.map((d, i) => (
              <Cell key={d.key} fill={d.vndKnown ? COLORS[i % COLORS.length] : "hsl(215 16% 75%)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Chú thích danh sách gói */}
      <div className="space-y-1.5 pt-1">
        {rows.map((d, i) => (
          <div key={d.key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.vndKnown ? COLORS[i % COLORS.length] : "hsl(215 16% 75%)" }}
              />
              <span className="text-foreground truncate">{d.label}</span>
              <span className="text-muted-foreground">· {d.count} lượt</span>
            </div>
            <span className="font-medium text-foreground tabular-nums">
              {d.vndKnown ? formatVnd(d.vnd) : "—"}
            </span>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}

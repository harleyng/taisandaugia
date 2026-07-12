import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { FeatureStat } from "@/lib/reports/transactionReport";
import ReportCard from "./ReportCard";

interface Props {
  data: FeatureStat[];
  loading?: boolean;
}

const COLORS = [
  "hsl(210 90% 30%)",
  "hsl(43 96% 56%)",
  "hsl(142 76% 36%)",
  "hsl(262 60% 55%)",
  "hsl(199 89% 48%)",
  "hsl(0 72% 55%)",
  "hsl(215 16% 60%)",
];

export default function CreditConsumptionChart({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.credits, 0);
  const empty = !loading && total === 0;

  return (
    <ReportCard
      title="Tiêu dùng credit theo tính năng"
      subtitle="Credit đã dùng (không phải VND) vào từng tính năng"
      loading={loading}
      empty={empty}
    >
      <div className="grid sm:grid-cols-[1fr_1fr] gap-4 items-center">
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={2}
                dataKey="credits"
                nameKey="label"
              >
                {data.map((d, idx) => (
                  <Cell key={d.type} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [`${v.toLocaleString("vi-VN")} credit`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-foreground">{total.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground">credit</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {data.map((d, idx) => (
            <div key={d.type} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-foreground truncate">{d.label}</span>
              </div>
              <span className="font-medium text-foreground tabular-nums">
                {total > 0 ? ((d.credits / total) * 100).toFixed(1) : "0"}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </ReportCard>
  );
}

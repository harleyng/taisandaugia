import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatVndCompact } from "@/lib/reports/transactionReport";
import type { RevenueBucket } from "@/lib/reports/revenueReport";
import ReportCard from "./ReportCard";

interface Props {
  data: RevenueBucket[];
  loading?: boolean;
}

import { SOURCE_COLORS } from "@/lib/reports/revenueSource";

const CREDIT = SOURCE_COLORS.credit;
const DIRECT = SOURCE_COLORS.direct;
const COMMISSION = SOURCE_COLORS.commission;

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

export default function RevenueSourceTrendChart({ data, loading }: Props) {
  const empty = !loading && data.every((d) => d.totalVnd === 0);
  const tickInterval = Math.max(1, Math.ceil(data.length / 6));
  const ticks = data.filter((_, i) => i % tickInterval === 0 || i === data.length - 1).map((d) => d.label);

  return (
    <ReportCard
      title="Doanh thu theo thời gian"
      subtitle="Cộng dồn: nạp credit + dịch vụ trực tiếp"
      loading={loading}
      empty={empty}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillCredit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CREDIT} stopOpacity={0.5} />
              <stop offset="95%" stopColor={CREDIT} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="fillCommission" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COMMISSION} stopOpacity={0.5} />
              <stop offset="95%" stopColor={COMMISSION} stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="fillDirect" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DIRECT} stopOpacity={0.5} />
              <stop offset="95%" stopColor={DIRECT} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatVndCompact(v)}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatVnd(value), name]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="creditVnd"
            name="Nạp credit"
            stackId="1"
            stroke={CREDIT}
            strokeWidth={2}
            fill="url(#fillCredit)"
          />
          <Area
            type="monotone"
            dataKey="directVnd"
            name="Dịch vụ trực tiếp"
            stackId="1"
            stroke={DIRECT}
            strokeWidth={2}
            fill="url(#fillDirect)"
          />
          <Area
            type="monotone"
            dataKey="commissionVnd"
            name="Hoa hồng môi giới"
            stackId="1"
            stroke={COMMISSION}
            strokeWidth={2}
            fill="url(#fillCommission)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

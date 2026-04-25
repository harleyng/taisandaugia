import { Card } from "@/components/ui/card";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ReportSection } from "../ReportSection";
import { failureTrendByQuarter } from "@/lib/mockOutcomesReport";

export const OutcomesSectionTrend = () => (
  <ReportSection
    id="outcomes-c7"
    label="C7"
    title="Xu hướng theo thời gian"
    keyInsight="Tỷ lệ không thành đang giảm dần qua 4 quý — thị trường đang 'ấm' hơn, ít cơ hội deal hiếm hơn so với cuối 2024."
    deepDiveLabel=""
    hideDeepDive
  >
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Tỷ lệ không thành theo quý (12 tháng gần nhất)
      </p>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={failureTrendByQuarter} margin={{ top: 10, right: 16, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="quarter"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 35]}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => [`${v}%`, "Tỷ lệ không thành"]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 5, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border">
        → Tỷ lệ không thành đã giảm từ <span className="font-medium text-foreground">28%</span> (Q4'24)
        xuống <span className="font-medium text-foreground">19%</span> (Q3'25). Thị trường đang phục
        hồi — số lượng deal "đấu lại với giá thấp" có xu hướng giảm.
      </p>
    </Card>
  </ReportSection>
);

import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ReportSection } from "./ReportSection";
import { priceTrendData } from "@/lib/mockMarketReport";

const seriesColors: Record<string, string> = {
  "BĐS chung": "hsl(var(--primary))",
  "Long An": "hsl(var(--accent))",
  "Quanh HCMC": "hsl(var(--success))",
};

export const SectionPriceTrend = () => {
  return (
    <ReportSection
      id="price-trend"
      label="D"
      title="Xu hướng giá"
      keyInsight="Giá trúng BĐS tăng 14% YoY, dẫn dắt bởi các tỉnh quanh HCMC — Long An tăng nhanh nhất với +22%."
      deepDiveLabel="Xu hướng giá"
    >
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Giá trúng/m² theo quý (triệu đồng)
        </h3>
        <p className="text-xs text-muted-foreground mb-5">7 quý gần nhất · phân theo khu vực</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceTrendData} margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                unit="tr"
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `${v} tr/m²`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {Object.keys(seriesColors).map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={seriesColors[key]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </ReportSection>
  );
};

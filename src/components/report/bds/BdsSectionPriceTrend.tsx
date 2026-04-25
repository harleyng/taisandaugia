import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { ReportSection } from "../ReportSection";
import { bdsPriceTrend12m, bdsTrendCities } from "@/lib/mockBdsReport";

const CITY_COLORS: Record<string, string> = {
  "TP.HCM": "hsl(var(--primary))",
  "Hà Nội": "hsl(var(--accent))",
  "Bình Dương": "hsl(var(--chart-3, 220 70% 50%))",
  "Đồng Nai": "hsl(var(--chart-4, 30 80% 55%))",
  "Long An": "hsl(var(--chart-5, 280 65% 60%))",
};

export const BdsSectionPriceTrend = () => (
  <ReportSection
    id="bds-b5"
    label="B5"
    title="Xu hướng giá/m² 12 tháng"
    keyInsight="Hà Nội tăng nhanh nhất nhóm trên (+14% YoY), TP.HCM gần như đi ngang — dấu hiệu chu kỳ nóng đang chuyển dịch ra ngoại ô và vùng vệ tinh."
    deepDiveLabel=""
    hideDeepDive
  >
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Giá/m² đất ở trung vị theo tháng — 5 tỉnh thành lớn
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Đơn vị: triệu VND/m²</p>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={bdsPriceTrend12m} margin={{ top: 5, right: 12, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {bdsTrendCities.map((city) => (
              <Line
                key={city}
                type="monotone"
                dataKey={city}
                stroke={CITY_COLORS[city]}
                strokeWidth={2}
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

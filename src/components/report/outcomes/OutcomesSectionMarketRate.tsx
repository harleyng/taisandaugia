import { Card } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ReportSection } from "../ReportSection";
import { marketRateData, outcomesMeta } from "@/lib/mockOutcomesReport";

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.45)"];

export const OutcomesSectionMarketRate = () => (
  <ReportSection
    id="outcomes-c1"
    label="C1"
    title="Tỷ lệ thành công toàn thị trường"
    keyInsight="Cứ 4 phiên thì có 1 phiên không có người trúng. Đây là cơ hội cho người mua kiên nhẫn — nhiều tài sản sẽ đấu giá lại với giá khởi điểm thấp hơn."
    deepDiveLabel=""
    hideDeepDive
  >
    <Card className="p-6">
      <div className="grid md:grid-cols-[1fr_1fr] gap-6 items-center">
        <div className="h-[260px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={marketRateData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {marketRateData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `${v}%`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-3xl font-bold text-foreground">76%</p>
            <p className="text-xs text-muted-foreground">Thành công</p>
          </div>
        </div>

        <div className="space-y-3">
          {marketRateData.map((d, idx) => (
            <div
              key={d.name}
              className="flex items-center justify-between p-3 rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[idx] }}
                />
                <span className="text-sm font-medium text-foreground">{d.name}</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground">{d.value}%</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            n = {outcomesMeta.sessionCount.toLocaleString("vi-VN")} phiên
          </p>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-border text-sm text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">Bối cảnh:</span> Tỷ lệ này CAO bất thường so
        với thị trường giao dịch BĐS thông thường (95–98% thành công). Phản ánh đặc thù của đấu
        giá tài sản công, NPL, thi hành án — nơi giá khởi điểm thường được set cao hơn giá thị
        trường để bảo toàn quyền lợi của bên có tài sản.
      </div>
    </Card>
  </ReportSection>
);

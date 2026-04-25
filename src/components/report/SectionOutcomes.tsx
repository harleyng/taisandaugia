import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ReportSection } from "./ReportSection";
import { outcomeData, outcomeMeta } from "@/lib/mockMarketReport";

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground) / 0.5)"];

export const SectionOutcomes = () => {
  return (
    <ReportSection
      id="outcomes"
      label="C"
      title="Kết quả & không thành"
      keyInsight={`24% phiên đấu giá kết thúc không có người trúng — và ${outcomeMeta.reauctionRate}% trong số đó được tổ chức lại trong ${outcomeMeta.reauctionWindow} ngày, thường ở giá thấp hơn.`}
      deepDiveLabel="Kết quả & không thành"
      deepDiveHref="/report/deep/outcomes"
    >
      <Card className="p-6">
        <div className="grid md:grid-cols-[1fr_1fr] gap-6 items-center">
          <div className="h-[260px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outcomeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {outcomeData.map((_, idx) => (
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
            {outcomeData.map((d, idx) => (
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
            <div className="rounded-md border border-dashed border-border p-3 mt-4">
              <p className="text-xs text-muted-foreground">Tỷ lệ tổ chức lại trong 60 ngày</p>
              <p className="text-2xl font-bold text-primary mt-1">
                {outcomeMeta.reauctionRate}%
              </p>
            </div>
          </div>
        </div>
      </Card>
    </ReportSection>
  );
};

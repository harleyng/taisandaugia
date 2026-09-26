import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ESTIMATE_MIN_RESULTS, type EstimateLayer, type Forecast, type ForecastBucket } from "@/lib/ownerCashFlow";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";

interface CashForecastCardProps {
  forecast: Forecast;
  estimate: EstimateLayer;
}

const OWED = "hsl(var(--primary))";
const OVERDUE = "hsl(var(--warning))";

function BucketTooltip({ active, payload }: { active?: boolean; payload?: { payload: ForecastBucket }[] }) {
  const b = active ? payload?.[0]?.payload : undefined;
  if (!b) return null;
  return (
    <div className="space-y-0.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{b.label}</p>
      <p className="tabular-nums text-muted-foreground">Còn phải thu: {formatMoneyFull(b.owed)}</p>
      {b.key !== "overdue" && (
        <p className="tabular-nums text-muted-foreground">Ước tính từ phiên sắp tới: {formatMoneyFull(b.estimate)}</p>
      )}
    </div>
  );
}

function Swatch({ fill, hatch }: { fill: string; hatch?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border"
      style={
        hatch
          ? { borderColor: fill, backgroundImage: `repeating-linear-gradient(45deg, ${fill} 0 2px, transparent 2px 5px)` }
          : { background: fill, borderColor: fill }
      }
    />
  );
}

/** L3: tiền dự kiến về theo mốc 30 / 60 / 90 ngày — phần chắc (đã bán, còn phải thu) và phần ước tính tách bạch. */
export function CashForecastCard({ forecast, estimate }: CashForecastCardProps) {
  const patternId = `cf-hatch-${useId().replace(/:/g, "")}`;
  const data = forecast.buckets;
  const any = data.some((b) => b.owed || b.estimate);

  const notes = [
    forecast.laterOwed ? `${formatMoneyShort(forecast.laterOwed)} còn phải thu có hạn sau 90 ngày.` : null,
    forecast.undatedOwed ? `${formatMoneyShort(forecast.undatedOwed)} còn phải thu chưa rõ ngày phiên nên chưa xếp vào mốc nào.` : null,
    estimate.skippedNoRate
      ? `${estimate.skippedNoRate} phiên sắp tới chưa ước tính: đơn vị chưa đủ ${ESTIMATE_MIN_RESULTS} kết quả trong 12 tháng.`
      : null,
    estimate.skippedNoPrice ? `${estimate.skippedNoPrice} phiên sắp tới thiếu giá khởi điểm nên chưa ước tính.` : null,
  ].filter(Boolean);

  const renderTotal = (props: unknown) => {
    const { x, y, width, index } = props as { x?: number; y?: number; width?: number; index?: number };
    const b = index !== undefined ? data[index] : undefined;
    const total = b ? b.owed + b.estimate : 0;
    if (!b || !total || x === undefined || y === undefined || width === undefined) return null;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        {formatMoneyShort(total)}
      </text>
    );
  };

  return (
    <SectionCard title="Dự báo tiền về" icon={CalendarClock}>
      {!any ? (
        <EmptyState compact icon={CalendarClock} title="Chưa có khoản nào dự kiến về trong 90 ngày tới." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Swatch fill={OWED} /> Còn phải thu (đã bán)
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch fill={OVERDUE} /> Quá hạn
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch fill={OWED} hatch /> Ước tính từ phiên sắp tới
            </span>
          </div>
          <div className="relative h-[240px] w-full" role="img" aria-label="Biểu đồ dự báo tiền về — số liệu trong bảng ẩn ngay sau">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                <defs>
                  <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="hsl(var(--primary) / 0.12)" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--primary))" strokeWidth="2" />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} />
                <YAxis
                  width={56}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => formatMoneyShort(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BucketTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="owed" stackId="f" isAnimationActive={false} stroke="hsl(var(--card))" strokeWidth={2}>
                  {data.map((b) => (
                    <Cell key={b.key} fill={b.key === "overdue" ? OVERDUE : OWED} />
                  ))}
                </Bar>
                <Bar
                  dataKey="estimate"
                  stackId="f"
                  isAnimationActive={false}
                  fill={`url(#${patternId})`}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 2"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList dataKey="estimate" content={renderTotal} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <table className="sr-only">
              <caption>Dự báo tiền về</caption>
              <thead>
                <tr>
                  <th scope="col">Mốc</th>
                  <th scope="col">Còn phải thu</th>
                  <th scope="col">Ước tính</th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.key}>
                    <th scope="row">{b.label}</th>
                    <td>{formatMoneyFull(b.owed)}</td>
                    <td>{formatMoneyFull(b.estimate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>
              Ước tính = giá khởi điểm × tỷ lệ thành công 12 tháng của đơn vị, tiền về 30 ngày sau phiên. Hạn thu chưa đặt
              được tính 30 ngày sau phiên.
            </li>
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

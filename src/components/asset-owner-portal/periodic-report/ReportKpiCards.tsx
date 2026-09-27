import { cn } from "@/lib/utils";
import { moneyShortParts } from "@/utils/money";
import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import { deltaLabel, reportDelta } from "@/lib/ownerReportDigest";

/** Số của kỳ trước (báo cáo đã chốt, cùng loại kỳ và phạm vi) để so sánh. */
export interface PreviousFigures {
  label: string;
  soldValue: number | null;
  collected: number | null;
}

interface Kpi {
  label: string;
  value: number;
  context: string;
  tone: "up" | "down" | "none";
}

function Card({ kpi }: { kpi: Kpi }) {
  const { value, unit } = moneyShortParts(kpi.value);
  return (
    <div className="min-w-0 rounded-2xl bg-card px-4 py-3.5 shadow-card">
      <p className="text-[12.5px] text-muted-foreground">{kpi.label}</p>
      <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-foreground">
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-muted-foreground">{unit}</span>}
      </p>
      <p
        className={cn(
          "truncate text-xs font-semibold",
          kpi.tone === "up" ? "text-primary" : kpi.tone === "down" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {kpi.context}
      </p>
    </div>
  );
}

function compare(current: number, previous: PreviousFigures | null, pick: (p: PreviousFigures) => number | null) {
  if (!previous) return { context: "Chưa có kỳ trước để so", tone: "none" as const };
  const d = reportDelta(current, pick(previous));
  if (!d) return { context: "Chưa có kỳ trước để so", tone: "none" as const };
  return { context: deltaLabel(d, previous.label), tone: d.dir === "up" ? ("up" as const) : d.dir === "down" ? ("down" as const) : ("none" as const) };
}

/** Ba con số dưới kết luận: Giá trúng, Đã thu (so kỳ trước) và Chờ thu. */
export function ReportKpiCards({ payload, previous }: { payload: ReportPayload; previous: PreviousFigures | null }) {
  const { results, money } = payload;
  const pending = money.items.filter((i) => i.paymentStatus !== "defaulted" && i.awaiting > 0).length;
  const awaitingContext = [
    pending ? `${pending} khoản` : "Không có khoản chờ thu",
    money.defaulted.count ? `${money.defaulted.count} bỏ cọc` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const kpis: Kpi[] = [
    { label: "Giá trúng", value: results.totals.soldValue, ...compare(results.totals.soldValue, previous, (p) => p.soldValue) },
    { label: "Đã thu", value: money.collected, ...compare(money.collected, previous, (p) => p.collected) },
    {
      label: "Chờ thu",
      value: money.awaiting,
      context: awaitingContext,
      tone: money.awaiting > 0 || money.defaulted.count ? "down" : "none",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 tabular-nums sm:grid-cols-3">
      {kpis.map((k) => (
        <Card key={k.label} kpi={k} />
      ))}
    </div>
  );
}

import type { WaterfallTotals } from "@/lib/ownerCashFlow";
import { ownerPeriodLabel, ownerPeriodPhrase } from "@/lib/ownerPeriods";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";

interface CashReportHeroProps {
  totals: WaterfallTotals;
  rate: number | null;
  periodId: string;
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-card px-3 py-3 shadow-card sm:min-w-[8.5rem] sm:px-4">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-baseline gap-1">
        <span className="truncate text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</span>
        {unit && <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}

/**
 * L1 của Dòng tiền: THỰC NHẬN của các tài sản bán trong kỳ (= đáy thác tiền bên dưới).
 * Đã thu + Còn phải thu = Giá trúng; tỷ lệ thu = đã thu / giá trúng.
 */
export function CashReportHero({ totals, rate, periodId }: CashReportHeroProps) {
  const empty = totals.count === 0;
  const net = moneyShortParts(totals.net);
  const recorded = moneyShortParts(totals.recorded);
  const awaiting = moneyShortParts(totals.awaiting);

  return (
    <section
      aria-label="Thực nhận trong kỳ"
      // Nền trắng dưới dải primary trong suốt ⇒ xanh bạc hà như design (trên nền xám sẽ ngả xám).
      className="grid gap-5 rounded-2xl bg-card bg-gradient-to-br from-primary/5 via-primary/10 to-primary/20 p-5 shadow-card sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Thực nhận · {ownerPeriodLabel(periodId)}</p>
        <p className="mt-2 flex min-w-0 items-baseline gap-2">
          <span className="truncate text-4xl font-semibold tracking-tight tabular-nums text-primary sm:text-5xl">
            {empty ? "0" : net.value}
          </span>
          {!empty && <span className="shrink-0 text-xl text-muted-foreground">{net.unit}</span>}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {empty
            ? "Chưa có phiên bán nào đơn vị tự theo dõi tiền trong kỳ."
            : `${totals.count} tài sản bán ${ownerPeriodPhrase(periodId)} · đã trừ phí ${formatMoneyShort(totals.fees)}`}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <MiniStat label="Đã thu" value={empty ? "0" : recorded.value} unit={empty ? undefined : recorded.unit} />
        <MiniStat label="Còn phải thu" value={empty ? "0" : awaiting.value} unit={empty ? undefined : awaiting.unit} />
        <MiniStat label="Tỷ lệ thu" value={rate === null ? "—" : String(Math.round(rate * 100))} unit={rate === null ? undefined : "%"} />
      </dl>
    </section>
  );
}

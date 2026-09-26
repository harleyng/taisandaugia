import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import type { PeriodCashTotals } from "@/lib/ownerCashFlow";
import { ownerPeriodPhrase } from "@/lib/ownerPeriods";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";

interface CashFlowHeroProps {
  totals: PeriodCashTotals;
  periodId: string;
}

/** L1: tiền thực về tay đơn vị trong kỳ, tính theo NGÀY TIỀN VỀ (không theo ngày phiên). */
export function CashFlowHero({ totals, periodId }: CashFlowHeroProps) {
  const net = moneyShortParts(totals.net);
  const parts = [`Đã thu ${formatMoneyShort(totals.inflow)}`];
  if (totals.fees) parts.push(`phí ${formatMoneyShort(totals.fees)}`);
  if (totals.refunds) parts.push(`hoàn trả ${formatMoneyShort(totals.refunds)}`);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <HeroFigure
        label={`Thực nhận ${ownerPeriodPhrase(periodId)} · theo ngày tiền về`}
        value={totals.count ? net.value : "0"}
        unit={totals.count ? net.unit : "₫"}
        context={totals.count ? parts.join(" · ") : "Chưa có khoản thu chi nào trong kỳ này."}
      />
    </div>
  );
}

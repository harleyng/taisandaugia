import { CalendarClock, HandCoins, Receipt, Wallet } from "lucide-react";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import type { CashFlowView } from "@/lib/ownerCashFlow";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";

/** L3: bốn ô số — hai ô theo kỳ, hai ô "tính đến hôm nay". */
export function CashFlowStatGrid({ view }: { view: CashFlowView }) {
  const inflow = moneyShortParts(view.period.inflow);
  const out = moneyShortParts(view.period.fees + view.period.refunds);
  const owed = moneyShortParts(view.owedTotal);
  const next = moneyShortParts(view.next30);
  const d30 = view.forecast.buckets.find((b) => b.key === "d30");

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Đã thu trong kỳ"
        value={inflow.value}
        unit={inflow.unit}
        icon={Wallet}
        context="Tiền đặt trước + tiền thanh toán"
      />
      <StatTile
        label="Phí & hoàn trả trong kỳ"
        value={out.value}
        unit={out.unit}
        icon={Receipt}
        tone="muted"
        context={`Phí ${formatMoneyShort(view.period.fees)} · hoàn ${formatMoneyShort(view.period.refunds)}`}
      />
      <StatTile
        label="Còn phải thu"
        value={owed.value}
        unit={owed.unit}
        icon={HandCoins}
        tone={view.overdue.length ? "warning" : "primary"}
        context={`${view.receivables.length} tài sản · tính đến hôm nay`}
      />
      <StatTile
        label="Dự kiến về trong 30 ngày"
        value={next.value}
        unit={next.unit}
        icon={CalendarClock}
        context={d30?.estimate ? `gồm ${formatMoneyShort(d30.estimate)} ước tính` : "Theo hạn thanh toán"}
      />
    </div>
  );
}

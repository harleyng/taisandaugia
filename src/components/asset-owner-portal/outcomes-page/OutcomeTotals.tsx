import { AlertTriangle } from "lucide-react";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { moneyShortParts } from "@/utils/money";
import { ownerPeriodPhrase } from "@/lib/ownerPeriods";
import type { OutcomeTotals as Totals } from "@/lib/ownerOutcomesOverview";

/** L1: "Đã bán trong {kỳ}" — tổng giá trúng + số tài sản / tỷ lệ thành công. */
export function OutcomeHero({ totals, periodId }: { totals: Totals; periodId: string }) {
  const money = moneyShortParts(totals.soldValue);
  const parts = [
    `${totals.sold}/${totals.total} tài sản có kết quả`,
    totals.successRate !== null ? `${totals.successRate}% thành công` : null,
    totals.soldWithoutPrice ? `${totals.soldWithoutPrice} tài sản chưa rõ giá trúng` : null,
  ].filter(Boolean);
  return (
    <HeroFigure
      label={`Đã bán ${ownerPeriodPhrase(periodId)}`}
      value={money.value}
      unit={money.unit}
      context={parts.join(" · ")}
    />
  );
}

/** L3: số tài sản theo nhóm kết quả trong phạm vi đang lọc. */
export function OutcomeStatGrid({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Thành"
        value={String(totals.sold)}
        context={totals.defaulted ? `trong đó ${totals.defaulted} người trúng bỏ cọc` : `trên ${totals.total} tài sản`}
      />
      <StatTile label="Không thành" value={String(totals.unsold)} context="cần đấu lại" />
      <StatTile label="Hoãn / Huỷ" value={String(totals.voided)} context="phiên không diễn ra" />
      <StatTile
        label="Lệch số liệu"
        value={String(totals.conflicts)}
        icon={totals.conflicts ? AlertTriangle : undefined}
        tone={totals.conflicts ? "warning" : undefined}
        context={totals.conflicts ? "các nguồn nói khác nhau" : "các nguồn đều khớp"}
      />
    </div>
  );
}

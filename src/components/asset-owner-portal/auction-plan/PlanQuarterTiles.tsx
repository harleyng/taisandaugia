import { CalendarRange } from "lucide-react";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { moneyShortParts } from "@/utils/money";
import { QUARTERS, QUARTER_LABELS, type PlanTotals } from "@/lib/auctionPlan/totals";

/** Tầng L3 của trang danh sách: bốn ô quý của năm đang chọn (lưới 4 / 2×2). */
export function PlanQuarterTiles({ totals, planYear }: { totals: PlanTotals; planYear: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {QUARTERS.map((q) => {
        const slice = totals.byQuarter[q];
        const money = moneyShortParts(slice.expected);
        return (
          <StatTile
            key={q}
            label={`${QUARTER_LABELS[q]}/${planYear}`}
            value={String(slice.count)}
            unit="tài sản"
            icon={CalendarRange}
            tone={slice.count === 0 ? "muted" : "primary"}
            context={slice.expected > 0 ? `Giá trị khởi điểm ${money.value} ${money.unit}` : "Chưa có tài sản nào"}
          />
        );
      })}
    </div>
  );
}

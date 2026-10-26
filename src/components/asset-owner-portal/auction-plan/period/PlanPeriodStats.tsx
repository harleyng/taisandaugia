import { CircleDashed, Gavel, Target, Wallet } from "lucide-react";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";
import type { PlanVsActual } from "@/lib/auctionPlan/period";

/** Bốn ô chỉ số của bảng A5 (tầng L3) — nhãn đúng chữ của A5. */
export function PlanPeriodStats({ metrics }: { metrics: PlanVsActual }) {
  const offered = metrics.offeredCount;
  const planned = metrics.plannedCount;
  const start = moneyShortParts(metrics.actualStartValue);
  const win = moneyShortParts(metrics.winningTotal);
  const collected = moneyShortParts(metrics.collected);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Số tài sản đưa ra đấu giá"
        value={String(offered)}
        icon={Gavel}
        tone="primary"
        context={planned > 0 ? `Theo kế hoạch kỳ này: ${planned}` : "Kỳ này không có tài sản theo kế hoạch"}
      />
      <StatTile
        label="Số tài sản đấu thành"
        value={String(metrics.soldCount)}
        icon={Target}
        tone="success"
        context={offered > 0 ? `Trong ${offered} tài sản đã đưa ra đấu giá` : "Chưa có phiên nào trong kỳ"}
      />
      <StatTile
        label="Giá trị khởi điểm"
        value={start.value}
        unit={start.unit}
        icon={CircleDashed}
        tone="muted"
        context={`Kế hoạch: ${formatMoneyShort(metrics.plannedStartValue)}`}
      />
      <StatTile
        label="Tổng giá trúng"
        value={win.value}
        unit={win.unit}
        icon={Wallet}
        tone="primary"
        context={`Đã thu ${collected.value} ${collected.unit}${
          metrics.awaiting > 0 ? ` · chờ thu ${formatMoneyShort(metrics.awaiting)}` : ""
        }`}
      />
    </div>
  );
}

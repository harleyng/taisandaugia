import { CalendarClock, Clock, Gavel, Wallet } from "lucide-react";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { moneyShortParts } from "@/utils/money";
import type { ProvinceSummary } from "@/lib/auctionPlan/province";

/** Bốn ô chỉ số của "Toàn tỉnh" (tầng L3) — cùng bộ nhãn A5 với tab "Theo kỳ". */
export function ProvinceStats({ summary, periodLabel }: { summary: ProvinceSummary; periodLabel: string }) {
  const assigned = moneyShortParts(summary.assignedRevenue);
  const win = moneyShortParts(summary.winningTotal);
  const collected = moneyShortParts(summary.collected);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Đơn vị đã trình kế hoạch"
        value={`${summary.submittedCount}/${summary.submittedOf}`}
        icon={CalendarClock}
        tone="primary"
        context={
          summary.inCycleCount > 0
            ? `${summary.inCycleCount} đơn vị được giao trong đợt`
            : "Chưa mở đợt lập kế hoạch cho năm này"
        }
      />
      <StatTile
        label={`Tài sản đấu thành ${periodLabel}`}
        value={`${summary.soldCount}/${summary.plannedCount}`}
        icon={Gavel}
        tone="success"
        context={
          summary.plannedCount > 0
            ? `Đạt ${summary.donePct ?? 0}% kế hoạch của kỳ`
            : "Kỳ này không có tài sản theo kế hoạch"
        }
      />
      <StatTile
        label="Chỉ tiêu thu giao"
        value={assigned.value}
        unit={assigned.unit}
        icon={Wallet}
        tone="muted"
        context={
          summary.assignedPct === null
            ? "Chưa giao chỉ tiêu thu cho đơn vị nào"
            : `Đã thu ${collected.value} ${collected.unit} · đạt ${summary.assignedPct}%`
        }
      />
      <StatTile
        label="Tài sản trễ kế hoạch"
        value={String(summary.lateCount)}
        icon={Clock}
        tone={summary.lateCount > 0 ? "destructive" : "muted"}
        context={
          summary.atRiskCount > 0
            ? `${summary.atRiskCount} tài sản có nguy cơ trễ · tổng giá trúng ${win.value} ${win.unit}`
            : `Chưa có tài sản nào nguy cơ trễ · tổng giá trúng ${win.value} ${win.unit}`
        }
      />
    </div>
  );
}

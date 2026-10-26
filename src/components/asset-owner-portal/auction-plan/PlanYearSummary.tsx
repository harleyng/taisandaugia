import { CalendarRange } from "lucide-react";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { moneyShortParts } from "@/utils/money";
import { AUCTION_PLAN_STATUS_LABELS, type AuctionPlan } from "@/lib/auctionPlan/types";
import type { PlanTotals } from "@/lib/auctionPlan/totals";

const areaText = (area: number) =>
  area > 0 ? `${Math.round(area).toLocaleString("en-US")} m²` : null;

/**
 * Tầng L1 của trang danh sách: câu trả lời cho "năm nay đơn vị dự kiến đấu giá
 * bao nhiêu?" — tổng giá trị khởi điểm, số tài sản, trạng thái các kế hoạch.
 */
export function PlanYearSummary({
  planYear,
  plans,
  totals,
  loading,
}: {
  planYear: number;
  plans: readonly AuctionPlan[];
  totals: PlanTotals;
  loading?: boolean;
}) {
  const money = moneyShortParts(totals.expected);
  const statuses = [...new Set(plans.map((p) => AUCTION_PLAN_STATUS_LABELS[p.status]))].join(" · ");
  const parts = [
    `${totals.count} tài sản`,
    areaText(totals.area),
    statuses || null,
    totals.withoutMonth > 0 ? `${totals.withoutMonth} chưa có tháng` : null,
  ].filter(Boolean);

  return (
    <SectionCard title={`Kế hoạch năm ${planYear}`} icon={CalendarRange}>
      <HeroFigure
        label="Giá trị khởi điểm dự kiến"
        value={loading ? "…" : money.value}
        unit={loading ? undefined : money.unit}
        context={loading ? "Đang tính…" : parts.join(" · ")}
      />
    </SectionCard>
  );
}

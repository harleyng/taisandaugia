import { Gavel, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import type { PlanMonthItem } from "@/hooks/useAuctionPlanPeriod";
import { PLAN_ITEM_HEALTH_LABELS, PLAN_ITEM_HEALTH_TONES } from "@/lib/auctionPlan/health";
import { planStepLabel } from "@/lib/auctionPlan/steps";
import { monthLabel } from "@/lib/auctionPlan/totals";

interface Props {
  title: string;
  items: readonly PlanMonthItem[];
  emptyTitle: string;
  canUpdate: boolean;
  onMove: (item: PlanMonthItem) => void;
  onOpen: (item: PlanMonthItem) => void;
  /** Tháng sau chỉ XEM TRƯỚC: không có nút ghi. */
  readOnly?: boolean;
}

/** Tài sản cần đấu giá trong kỳ — mỗi thẻ mang sức khoẻ + mốc tiếp theo. */
export function PlanMonthItemList({ title, items, emptyTitle, canUpdate, onMove, onOpen, readOnly }: Props) {
  return (
    <SectionCard title={title} icon={Gavel} count={items.length}>
      {items.length === 0 ? (
        <EmptyState compact icon={Gavel} tone="muted" title={emptyTitle} />
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <ActionCard
              key={i.item_id}
              icon={Gavel}
              tone={PLAN_ITEM_HEALTH_TONES[i.health]}
              title={i.item_title ?? "Tài sản"}
              meta={
                <>
                  {i.item_code ? `${i.item_code} · ` : ""}
                  {i.plan_title} · kế hoạch {monthLabel(i.baseline_month)}
                  {i.forecast_month && i.forecast_month !== i.baseline_month
                    ? ` · dự kiến mới ${monthLabel(i.forecast_month)}`
                    : ""}
                  {` · ${PLAN_ITEM_HEALTH_LABELS[i.health]}`}
                  {i.next_step ? ` · mốc tiếp: ${planStepLabel(i.next_step)}` : ""}
                  {` · ${i.steps_done}/${i.steps_total} mốc`}
                </>
              }
              actions={
                <>
                  {!readOnly && canUpdate && (
                    <Button size="sm" variant="outline" onClick={() => onMove(i)}>
                      <PencilRuler />
                      Dời dự kiến
                    </Button>
                  )}
                  <Button size="sm" variant={readOnly ? "outline" : "default"} onClick={() => onOpen(i)}>
                    Mở kế hoạch
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

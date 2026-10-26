import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { daysToDeadline, deadlineText } from "@/lib/auctionPlan/cycles";
import { formatPlanDate } from "@/lib/auctionPlan/print";
import {
  AUCTION_PLAN_CYCLE_STATUS_LABELS,
  AUCTION_PLAN_KIND_LABELS,
  type AuctionPlanCycle,
  type AuctionPlanCycleUnit,
} from "@/lib/auctionPlan/types";

interface ProvinceCycleListProps {
  cycles: readonly AuctionPlanCycle[];
  units: readonly AuctionPlanCycleUnit[];
  today: string;
  canApprove: boolean;
  onOpenCycle: (cycleId: string) => void;
  onCreate: () => void;
}

/** Các đợt lập kế hoạch của năm đang xem — cửa vào trang chi tiết từng đợt. */
export function ProvinceCycleList({
  cycles,
  units,
  today,
  canApprove,
  onOpenCycle,
  onCreate,
}: ProvinceCycleListProps) {
  return (
    <SectionCard
      title="Đợt lập kế hoạch"
      icon={CalendarClock}
      count={cycles.length}
      actions={
        canApprove ? (
          <Button size="sm" variant="outline" onClick={onCreate}>
            Mở đợt mới
          </Button>
        ) : undefined
      }
    >
      {cycles.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          compact
          title="Năm này chưa có đợt lập kế hoạch."
          description={
            canApprove
              ? "Mở một đợt để ra hạn trình và giao chỉ tiêu cho từng xã, phường."
              : "Cấp có quyền duyệt kế hoạch sẽ mở đợt và giao chỉ tiêu."
          }
        />
      ) : (
        <div className="space-y-2">
          {cycles.map((cycle) => {
            const count = units.filter((u) => u.cycle_id === cycle.id).length;
            const days = cycle.status === "open" ? daysToDeadline(cycle.submit_deadline, today) : null;
            return (
              <ActionCard
                key={cycle.id}
                icon={CalendarClock}
                tone={cycle.status === "open" ? "primary" : "muted"}
                title={`${AUCTION_PLAN_KIND_LABELS[cycle.kind]} ${cycle.plan_year} · ${AUCTION_PLAN_CYCLE_STATUS_LABELS[cycle.status]}`}
                meta={[
                  `${count} đơn vị`,
                  cycle.submit_deadline ? `hạn trình ${formatPlanDate(cycle.submit_deadline)}` : "chưa đặt hạn trình",
                  deadlineText(days),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                actions={
                  <Button size="sm" variant="outline" onClick={() => onOpenCycle(cycle.id)}>
                    Xem đợt
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

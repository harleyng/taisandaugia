import { Clock, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import type { PlanDueStep } from "@/hooks/useAuctionPlanPeriod";
import { planDayLabel } from "@/lib/auctionPlan/period";
import { planStepLabel } from "@/lib/auctionPlan/steps";

interface Props {
  title: string;
  steps: readonly PlanDueStep[];
  /** Thẻ quá hạn tô `destructive`, thẻ đến hạn trong kỳ tô `warning`. */
  tone: "destructive" | "warning";
  emptyTitle: string;
  canUpdate: boolean;
  pendingId: string | null;
  onDone: (step: PlanDueStep) => void;
  onOpen: (step: PlanDueStep) => void;
  /** Số thẻ hiện tối đa (A8.2: tầng L2 không quá 5 thẻ), còn lại gộp vào một dòng. */
  limit?: number;
}

/** Tầng L2 của "Vận hành tháng": việc phải làm, mỗi thẻ mang nút của chính nó. */
export function PlanDueStepList({
  title,
  steps,
  tone,
  emptyTitle,
  canUpdate,
  pendingId,
  onDone,
  onOpen,
  limit = 5,
}: Props) {
  const shown = steps.slice(0, limit);
  const rest = steps.length - shown.length;

  return (
    <SectionCard title={title} icon={tone === "destructive" ? Clock : ListChecks} tone={tone} count={steps.length}>
      {steps.length === 0 ? (
        <EmptyState compact icon={ListChecks} tone="muted" title={emptyTitle} />
      ) : (
        <div className="space-y-2">
          {shown.map((s) => (
            <ActionCard
              key={s.step_id}
              icon={tone === "destructive" ? Clock : ListChecks}
              tone={tone}
              title={`${planStepLabel(s.step)} — ${s.item_title ?? "tài sản"}`}
              meta={
                <>
                  {s.item_code ? `${s.item_code} · ` : ""}
                  {s.plan_title} · hạn {planDayLabel(s.planned_date)}
                </>
              }
              actions={
                <>
                  {canUpdate && (
                    <Button size="sm" onClick={() => onDone(s)} disabled={pendingId === s.step_id}>
                      {pendingId === s.step_id && <Loader2 className="animate-spin" />}
                      Đánh dấu xong
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onOpen(s)}>
                    Mở kế hoạch
                  </Button>
                </>
              }
            />
          ))}
          {rest > 0 && <p className="text-xs text-muted-foreground">Còn {rest} mốc nữa — mở kế hoạch để xem đủ.</p>}
        </div>
      )}
    </SectionCard>
  );
}

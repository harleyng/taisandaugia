import { Check, Circle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { planStepLabel, sortPlanSteps } from "@/lib/auctionPlan/steps";
import type { AuctionPlanItemStep } from "@/lib/auctionPlan/types";
import { PlanStepSourceBadge } from "./PlanStepSourceBadge";

interface PlanStepChecklistProps {
  steps: readonly AuctionPlanItemStep[];
  /** `ke-hoach:update` đúng chi nhánh — mốc sửa được kể cả khi kế hoạch đã duyệt. */
  canEdit: boolean;
  asOf: string;
  onOpenStep: (step: AuctionPlanItemStep) => void;
}

const vnDate = (iso: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};

/**
 * Danh sách mốc công việc của một tài sản, theo đúng thứ tự bản mẫu (A4.4).
 * Mốc quá hạn mà chưa xong hiện icon `Clock` màu warning — màu chỉ nằm ở icon.
 */
export function PlanStepChecklist({ steps, canEdit, asOf, onOpenStep }: PlanStepChecklistProps) {
  return (
    <ol className="space-y-1.5">
      {sortPlanSteps(steps).map((step) => {
        const done = !!step.done_on;
        const overdue = !done && !!step.planned_date && step.planned_date < asOf;
        return (
          <li
            key={step.id}
            className="flex items-start gap-2.5 rounded-xl border border-border px-3 py-2.5"
          >
            <span className="mt-0.5 shrink-0">
              {done ? (
                <Check className="h-4 w-4 text-success" strokeWidth={1.75} aria-label="Đã xong" />
              ) : overdue ? (
                <Clock className="h-4 w-4 text-warning" strokeWidth={1.5} aria-label="Quá hạn" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", done ? "text-foreground" : "text-foreground")}>
                {step.sort_order}. {planStepLabel(step.step)}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {done ? `Xong ${vnDate(step.done_on)}` : step.planned_date ? `Dự kiến ${vnDate(step.planned_date)}` : "Chưa đặt ngày dự kiến"}
                </span>
                {step.doc_no && <span>· {step.doc_no}</span>}
                <PlanStepSourceBadge step={step} />
              </p>
              {step.note && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{step.note}</p>}
            </div>
            {canEdit && (
              <Button
                variant={done ? "ghost" : "outline"}
                size="sm"
                className="h-8 shrink-0 px-2 text-xs"
                onClick={() => onOpenStep(step)}
              >
                {done ? "Sửa" : "Đánh dấu xong"}
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

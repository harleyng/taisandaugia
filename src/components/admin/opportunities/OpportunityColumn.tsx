import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { formatVndCompact } from "@/lib/reports/transactionReport";
import { STAGE_LABELS, STAGE_ACCENT } from "@/lib/opportunities/opportunityStage";
import { OpportunityCard } from "./OpportunityCard";
import type { Opportunity, OpportunityStage } from "@/types/opportunities";

interface Props {
  stage: OpportunityStage;
  items: Opportunity[];
  onOpen: (o: Opportunity) => void;
}

export function OpportunityColumn({ stage, items, onOpen }: Props) {
  // Vùng thả riêng cho cột — cần thiết để thả được vào CỘT RỖNG (khi đó
  // SortableContext không có phần tử nào để suy ra đích).
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage}` });
  const total = items.reduce((s, o) => s + Number(o.amount ?? 0), 0);

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      <div className="rounded-t-xl border border-b-0 border-border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STAGE_ACCENT[stage]}`} />
          <span className="text-sm font-medium text-foreground">{STAGE_LABELS[stage]}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {total > 0 ? formatVndCompact(total) : "—"}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-b-xl border border-border p-2 space-y-2 min-h-[420px] transition-colors ${
          isOver ? "bg-primary/5 border-primary/40" : "bg-card"
        }`}
      >
        <SortableContext items={items.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          {items.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} onOpen={onOpen} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
            Kéo thẻ vào đây
          </div>
        )}
      </div>
    </div>
  );
}

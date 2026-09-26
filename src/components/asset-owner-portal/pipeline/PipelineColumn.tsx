import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGE_META,
  PIPELINE_STALE_DAYS,
  type PipelineColumnData,
} from "@/lib/ownerPipeline";
import { PipelineCard } from "./PipelineCard";

/** Số thẻ hiện trước khi bấm "Xem thêm" — giữ cột dài vừa một màn hình. */
const VISIBLE_CARDS = 20;

export function PipelineColumn({ column }: { column: PipelineColumnData }) {
  const [expanded, setExpanded] = useState(false);
  const { label, empty } = PIPELINE_STAGE_META[column.stage];
  const limit = PIPELINE_STALE_DAYS[column.stage];
  const total = column.cards.length;
  const shown = expanded ? column.cards : column.cards.slice(0, VISIBLE_CARDS);
  const headingId = `pipeline-col-${column.stage}`;

  return (
    // Cột trống hẹp lại để các cột có việc lọt vào màn hình đầu tiên; vẫn giữ chỗ (§A8.2).
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex shrink-0 snap-start flex-col rounded-2xl border border-border bg-muted/40 p-2",
        total === 0 ? "w-44" : "w-64",
      )}
    >
      <header className="px-1.5 pb-2 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h3 id={headingId} className="text-sm font-semibold text-foreground">
            {label}
          </h3>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {total}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {limit === null ? "Giai đoạn cuối" : `Chậm sau ${limit} ngày`}
          {column.overdueCount > 0 && <span className="text-destructive"> · {column.overdueCount} chậm</span>}
        </p>
      </header>

      {total === 0 ? (
        <p className="px-1.5 pb-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((card) => (
            <PipelineCard key={`${card.kind}:${card.id}`} card={card} />
          ))}
        </div>
      )}

      {total > VISIBLE_CARDS && (
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Thu gọn" : `Xem thêm ${total - VISIBLE_CARDS}`}
        </Button>
      )}
    </section>
  );
}

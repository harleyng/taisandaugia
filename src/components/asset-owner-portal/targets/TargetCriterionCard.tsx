import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TARGET_METRIC_META, formatMetricValue, type CriterionProgress, type TargetTiming } from "@/lib/ownerTargets";
import { criterionNote } from "@/lib/ownerTargetView";
import { TargetProgressBar } from "./TargetProgressBar";
import { HOVER_RAISE, SELECTED_RING } from "./targetStyles";

const B = ({ children, className }: { children: ReactNode; className?: string }) => (
  <b className={cn("font-semibold text-foreground", className)}>{children}</b>
);

function Note({ c, timing, daysLeft }: { c: CriterionProgress; timing: TargetTiming; daysLeft: number }) {
  const note = criterionNote(c, timing, daysLeft);
  const v = (n: number) => formatMetricValue(c.metric, n);
  switch (note.kind) {
    case "hint":
      return <>{note.text}</>;
    case "met":
      return (
        <>
          <B className="text-primary">Đã đạt</B>
          {note.excess > 0 && ` · vượt ${v(note.excess)}`}
        </>
      );
    case "missed":
      return (
        <>
          Thiếu <B>{v(note.remaining)}</B>
        </>
      );
    case "pace":
      return (
        <>
          Còn thiếu <B>{v(note.remaining)}</B> · cần <B>{v(note.weekly)}</B>/tuần
        </>
      );
    case "final":
      return (
        <>
          Còn thiếu <B>{v(note.remaining)}</B> trong {note.daysLeft} ngày
        </>
      );
  }
}

interface TargetCriterionCardProps {
  criterion: CriterionProgress;
  timing: TargetTiming;
  daysLeft: number;
  /** Chỉ tiêu đã trượt: thanh của tiêu chí chưa đạt tô đỏ. */
  failed: boolean;
  selected: boolean;
  onSelect: () => void;
}

/** Một tiêu chí: thực tế / mục tiêu, thanh, dòng chú thích. Đang chọn ⇒ viền xanh + mũi nhọn chỉ xuống bảng. */
export function TargetCriterionCard({ criterion: c, timing, daysLeft, failed, selected, onSelect }: TargetCriterionCardProps) {
  const meta = TARGET_METRIC_META[c.metric];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl bg-card px-4 py-3.5 text-left transition-shadow",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected
          ? cn(
              SELECTED_RING,
              "after:absolute after:-bottom-[9px] after:left-1/2 after:-ml-[7px] after:h-3.5 after:w-3.5 after:rotate-45 after:rounded-br-[3px] after:bg-card after:shadow-[2px_2px_0_0_hsl(var(--primary))] after:content-['']",
            )
          : cn("shadow-card", HOVER_RAISE),
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <b className="text-[13.5px] font-[650] text-foreground">{meta.label}</b>
        <em
          className={cn(
            "rounded-full px-2 py-px text-xs font-bold not-italic tabular-nums",
            c.met ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
          )}
        >
          {c.pct}%
        </em>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 tabular-nums">
        <strong className="whitespace-nowrap text-xl font-bold tracking-[-0.02em] text-foreground">
          {formatMetricValue(c.metric, c.actual)}
        </strong>
        <span className="whitespace-nowrap text-[13px] text-muted-foreground">/ {formatMetricValue(c.metric, c.goal)}</span>
      </span>
      <TargetProgressBar
        pct={c.pct}
        tone={failed && !c.met ? "failed" : "normal"}
        className="h-1.5"
        label={`${meta.label}: đạt ${c.pct}%`}
      />
      <span className="text-[12.5px] tabular-nums text-muted-foreground">
        <Note c={c} timing={timing} daysLeft={daysLeft} />
      </span>
    </button>
  );
}

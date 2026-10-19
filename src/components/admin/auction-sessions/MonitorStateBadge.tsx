import { cn } from "@/lib/utils";
import { MONITOR_STATE_LABELS, type MonitorState } from "@/lib/auctionMonitor/monitor";

const TONE: Record<MonitorState, string> = {
  live: "border-primary/30 bg-primary/10 text-primary",
  upcoming: "border-accent/40 bg-accent/15 text-foreground",
  ended: "border-border bg-muted text-muted-foreground",
  draft: "border-dashed border-border bg-card text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function MonitorStateBadge({ state, detail }: { state: MonitorState; detail?: string | null }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
          TONE[state],
        )}
      >
        {state === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />}
        {MONITOR_STATE_LABELS[state]}
      </span>
      {detail && <span className="text-[11px] text-muted-foreground">{detail}</span>}
    </span>
  );
}

import { CalendarCheck, CircleSlash, Clock, Gavel, RotateCcw, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_ITEM_HEALTH_LABELS, type PlanItemHealth } from "@/lib/auctionPlan/health";

/** Màu CHỈ nằm trên viên nhỏ, không phủ cả dòng (A8.4 / A8.10). */
const TONE: Record<PlanItemHealth, string> = {
  done: "border-success/40 bg-success/10 text-foreground",
  dropped: "border-border bg-muted text-muted-foreground",
  failed_retry: "border-warning/40 bg-warning/15 text-foreground",
  late: "border-destructive/40 bg-destructive/10 text-foreground",
  at_risk: "border-warning/40 bg-warning/15 text-foreground",
  on_track: "border-primary/30 bg-primary/10 text-foreground",
};

const ICON_TONE: Record<PlanItemHealth, string> = {
  done: "text-success",
  dropped: "text-muted-foreground",
  failed_retry: "text-warning",
  late: "text-destructive",
  at_risk: "text-warning",
  on_track: "text-primary",
};

const ICONS: Record<PlanItemHealth, LucideIcon> = {
  done: Gavel,
  dropped: CircleSlash,
  failed_retry: RotateCcw,
  late: Clock,
  at_risk: ShieldAlert,
  on_track: CalendarCheck,
};

interface PlanHealthChipProps {
  health: PlanItemHealth;
  /** Chỉ hiện icon + nhãn ngắn (dùng trong bảng dày). */
  compact?: boolean;
  className?: string;
}

export function PlanHealthChip({ health, compact = false, className }: PlanHealthChipProps) {
  const Icon = ICONS[health];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[health],
        className,
      )}
      title={PLAN_ITEM_HEALTH_LABELS[health]}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", ICON_TONE[health])} strokeWidth={1.5} aria-hidden="true" />
      <span className={cn("truncate", compact && "hidden sm:inline")}>{PLAN_ITEM_HEALTH_LABELS[health]}</span>
    </span>
  );
}

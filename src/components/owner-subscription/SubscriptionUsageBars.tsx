import { Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usagePercent } from "@/lib/ownerSubscription/coverage";
import { SUB_FEATURE_LABELS, SUB_FEATURE_UNITS, formatSubDate } from "@/lib/ownerSubscription/status";
import type { SubLine } from "@/lib/ownerSubscription/types";

interface Props {
  lines: SubLine[];
  nextResetOn?: string | null;
  className?: string;
}

/** Hạn mức từng tính năng trong tháng hiện tại: đã dùng / tổng, thanh tiến độ. */
export function SubscriptionUsageBars({ lines, nextResetOn, className }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Gói chưa có tính năng nào.</p>;
  }
  return (
    <div className={cn("space-y-4", className)}>
      {lines.map((line) => {
        const pct = usagePercent(line.used, line.monthly_quota);
        const exhausted = line.remaining === 0;
        const unit = SUB_FEATURE_UNITS[line.variant_key];
        return (
          <div key={line.variant_key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{SUB_FEATURE_LABELS[line.variant_key] ?? line.name}</span>
              {line.monthly_quota === null ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <InfinityIcon className="h-4 w-4" aria-hidden />
                  Không giới hạn · đã dùng {Math.max(line.used, 0)} {unit}
                </span>
              ) : (
                <span className={cn("tabular-nums", exhausted ? "text-destructive" : "text-muted-foreground")}>
                  {Math.max(line.used, 0)} / {line.monthly_quota} {unit}
                </span>
              )}
            </div>
            {pct !== null && (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={line.monthly_quota ?? 0}
                aria-valuenow={Math.max(line.used, 0)}
                aria-label={SUB_FEATURE_LABELS[line.variant_key]}
              >
                <div
                  className={cn("h-full rounded-full", exhausted ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
      {nextResetOn && (
        <p className="text-xs text-muted-foreground">Hạn mức làm mới vào {formatSubDate(nextResetOn)}.</p>
      )}
    </div>
  );
}

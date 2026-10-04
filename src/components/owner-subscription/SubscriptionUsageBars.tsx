import { Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usagePercent } from "@/lib/ownerSubscription/coverage";
import { CYCLE_LABELS } from "@/lib/ownerSubscription/benefits";
import { formatSubDate } from "@/lib/ownerSubscription/status";
import type { SubLine } from "@/lib/ownerSubscription/types";

interface Props {
  /** Chỉ các dòng có số lượt dùng (`tracked`). */
  lines: SubLine[];
  className?: string;
}

/** Hạn mức từng quyền lợi trong cửa sổ hiện tại của chu kỳ: đã dùng / tổng, thanh tiến độ. */
export function SubscriptionUsageBars({ lines, className }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Gói chưa có quyền lợi nào đếm lượt dùng.</p>;
  }
  return (
    <div className={cn("space-y-4", className)}>
      {lines.map((line) => {
        const pct = usagePercent(line.used, line.quota);
        const exhausted = line.remaining === 0;
        return (
          <div key={line.benefit_key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">
                {line.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {line.cycle ? CYCLE_LABELS[line.cycle] : ""}
                  {line.resets_on ? ` · làm mới ${formatSubDate(line.resets_on)}` : ""}
                </span>
              </span>
              {line.quota === null ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <InfinityIcon className="h-4 w-4" aria-hidden />
                  Không giới hạn · đã dùng {Math.max(line.used, 0)} {line.unit}
                </span>
              ) : (
                <span className={cn("tabular-nums", exhausted ? "text-destructive" : "text-muted-foreground")}>
                  {Math.max(line.used, 0)} / {line.quota} {line.unit}
                </span>
              )}
            </div>
            {pct !== null && (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={line.quota ?? 0}
                aria-valuenow={Math.max(line.used, 0)}
                aria-label={line.label}
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
    </div>
  );
}

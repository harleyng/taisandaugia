import { cn } from "@/lib/utils";
import { SUB_STATUS_LABELS, SUB_STATUS_TONES, SUB_TONE_CLASSES } from "@/lib/ownerSubscription/status";
import type { SubStatus } from "@/lib/ownerSubscription/types";

/** Huy hiệu trạng thái gói thuê bao — dùng chung cho admin và cổng chủ tài sản. */
export function SubscriptionStatusBadge({ status, className }: { status: SubStatus | null; className?: string }) {
  if (!status) {
    return (
      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", SUB_TONE_CLASSES.neutral, className)}>
        Chưa có gói
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        SUB_TONE_CLASSES[SUB_STATUS_TONES[status]],
        className,
      )}
    >
      {SUB_STATUS_LABELS[status]}
    </span>
  );
}

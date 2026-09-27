import { cn } from "@/lib/utils";
import type { TargetBarTone } from "@/lib/ownerTargetView";

const FILL: Record<TargetBarTone, string> = {
  normal: "bg-primary",
  behind: "bg-warning",
  failed: "bg-destructive",
};

interface TargetProgressBarProps {
  /** Tiến độ (%); phần vượt 100 bị cắt. */
  pct: number;
  /** Có ⇒ vạch dọc đánh dấu % thời gian của kỳ đã trôi qua (chỉ kỳ đang diễn ra). */
  elapsed?: number | null;
  tone?: TargetBarTone;
  /** Chiều cao: `h-1.5` thẻ tiêu chí · `h-2` danh sách · `h-2.5` tiến độ chung. */
  className?: string;
  label: string;
}

/** Thanh tiến độ nền xám, vạch thời gian đè lên (không bị cắt vì khung không overflow-hidden). */
export function TargetProgressBar({ pct, elapsed = null, tone = "normal", className = "h-2", label }: TargetProgressBarProps) {
  const value = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("relative rounded-full bg-muted", className)}
    >
      <span className={cn("absolute inset-y-0 left-0 rounded-full", FILL[tone])} style={{ width: `${value}%` }} />
      {elapsed !== null && (
        <span
          aria-hidden="true"
          title={`Thời gian đã qua ${elapsed}%`}
          className="absolute -bottom-[3px] -top-[3px] -ml-px w-0.5 rounded-sm bg-foreground/55"
          style={{ left: `${elapsed}%` }}
        />
      )}
    </div>
  );
}

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RecoverySummary } from "@/lib/ownerTargets";
import { formatMoneyShort } from "@/utils/money";
import { RECOVERY_SEGMENTS } from "./recoverySegments";

interface RecoveryBarProps {
  summary: Pick<RecoverySummary, "recorded" | "estimated" | "awaiting">;
  /** Chỉ tiêu — cả thanh; phần vượt chỉ tiêu bị cắt (đầy thanh = thu đủ là đạt). */
  goal: number;
}

/** Thanh 3 phần trên nền trắng: đã ghi thu / theo giá trúng / chờ thu — nối nhau, dừng ở chỉ tiêu. */
export function RecoveryBar({ summary, goal }: RecoveryBarProps) {
  const scale = goal > 0 ? goal : summary.recorded + summary.estimated + summary.awaiting || 1;
  let room = scale;
  const widths = RECOVERY_SEGMENTS.map((s) => {
    const w = Math.min(Math.max(0, summary[s.key]), room);
    room -= w;
    return (w / scale) * 100;
  });
  const label = RECOVERY_SEGMENTS.map((s) => `${s.label} ${formatMoneyShort(summary[s.key])}`).join(", ");

  return (
    <div>
      <div
        role="img"
        aria-label={`${label} — trên chỉ tiêu ${formatMoneyShort(goal)}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-card"
      >
        {RECOVERY_SEGMENTS.map((s, i) =>
          widths[i] > 0 ? (
            <i key={s.key} className={cn("block h-full", s.className)} style={{ ...s.style, width: `${widths[i]}%` }} />
          ) : null,
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] tabular-nums text-muted-foreground">
        {RECOVERY_SEGMENTS.map((s) => {
          const item = (
            <>
              <i aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", s.className)} style={s.style} />
              {s.label} <b className="font-semibold text-foreground">{formatMoneyShort(summary[s.key])}</b>
            </>
          );
          return (
            <li key={s.key} className="flex items-center gap-1.5">
              {s.key === "estimated" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-help items-center gap-1.5">{item}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    Kết quả do tổ chức đấu giá tự khai hoặc từ tin thu thập: chưa ai ghi nhận thu tiền nên tạm tính
                    bằng giá trúng.
                  </TooltipContent>
                </Tooltip>
              ) : (
                item
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

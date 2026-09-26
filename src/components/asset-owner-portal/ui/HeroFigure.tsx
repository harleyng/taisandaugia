import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface HeroFigureProps {
  label: string;
  value: string;
  /** Đơn vị in nhỏ, mờ cạnh số ("tỷ", "%"). */
  unit?: string;
  /** Một dòng bối cảnh: so với chỉ tiêu / kỳ trước. */
  context?: ReactNode;
  /** 0–100 — có thì vẽ thanh tiến độ dưới con số. */
  progress?: number;
  className?: string;
}

/** Con số trả lời câu hỏi chính của trang (tầng L1, §A8.2). */
export function HeroFigure({ label, value, unit, context, progress, className }: HeroFigureProps) {
  const pct = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-4xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {unit && <span className="shrink-0 text-base text-muted-foreground">{unit}</span>}
      </p>
      {pct !== undefined && <Progress value={pct} aria-label={label} className="h-2" />}
      {context && <p className="text-sm text-muted-foreground">{context}</p>}
    </div>
  );
}

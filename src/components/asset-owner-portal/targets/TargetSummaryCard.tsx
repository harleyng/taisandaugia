import { cn } from "@/lib/utils";
import { dayDiff, formatDayFull, formatDayMonth } from "@/lib/ownerPulse";
import type { TargetProgress, TargetTiming } from "@/lib/ownerTargets";
import { elapsedPct, isTimeCritical, targetBarTone } from "@/lib/ownerTargetView";
import { TargetProgressBar } from "./TargetProgressBar";

const EYEBROW = "text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground";
const count = (n: number) => n.toLocaleString("en-US");

function TimeBlock({ p, timing, today }: { p: TargetProgress; timing: TargetTiming; today: string }) {
  const { target } = p;
  if (timing === "upcoming") {
    return (
      <>
        <p className="text-xl font-bold tracking-[-0.01em] tabular-nums">Còn {count(dayDiff(today, target.periodStart))} ngày</p>
        <p className="text-[12.5px] tabular-nums text-muted-foreground">
          đến ngày bắt đầu {formatDayFull(target.periodStart)}
        </p>
      </>
    );
  }
  if (timing === "past") {
    return (
      <>
        <p className="text-xl font-bold tracking-[-0.01em]">Đã kết thúc</p>
        <p className="text-[12.5px] tabular-nums text-muted-foreground">ngày {formatDayFull(p.periodEnd)}</p>
      </>
    );
  }
  const elapsed = elapsedPct(target.periodType, target.periodStart, today);
  return (
    <>
      <p className={cn("text-xl font-bold tracking-[-0.01em] tabular-nums", isTimeCritical(p, timing) && "text-destructive")}>
        Còn {count(p.daysLeft)} ngày
      </p>
      <div
        role="img"
        aria-label={`Đã qua ${elapsed}% thời gian của kỳ`}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <span className="block h-full bg-foreground/35" style={{ width: `${elapsed}%` }} />
      </div>
      <p className="-mt-0.5 flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatDayMonth(target.periodStart)}</span>
        <span>{formatDayMonth(p.periodEnd)}</span>
      </p>
    </>
  );
}

/** Dải tóm tắt ở đáy thẻ hero: Tiến độ chung (số lớn + thanh có vạch thời gian) | Thời gian. */
export function TargetSummaryCard({ progress: p, timing, today }: { progress: TargetProgress; timing: TargetTiming; today: string }) {
  const pct = p.overallPct ?? 0;
  const total = p.criteria.length;
  return (
    <section
      aria-label="Tiến độ"
      className="grid border-t lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-2 px-6 py-4">
        <span className={EYEBROW}>Tiến độ chung</span>
        <div className="flex flex-wrap items-baseline gap-2.5 tabular-nums">
          <strong className="text-[34px] font-[750] leading-none tracking-[-0.03em] text-primary-hover">
            {pct}
            <span className="ml-px text-lg font-bold">%</span>
          </strong>
          <span className="text-[13.5px] text-muted-foreground">
            {timing === "upcoming" ? `${total} tiêu chí đã đặt` : `${p.metCount}/${total} tiêu chí đạt`}
          </span>
        </div>
        <TargetProgressBar
          pct={pct}
          tone={targetBarTone(p, today)}
          elapsed={timing === "current" ? elapsedPct(p.target.periodType, p.target.periodStart, today) : null}
          className="h-2.5"
          label={`Tiến độ chung: đạt ${pct}%`}
        />
      </div>
      <div className="flex flex-col gap-2 border-t px-6 py-4 lg:border-l lg:border-t-0">
        <span className={EYEBROW}>Thời gian</span>
        <TimeBlock p={p} timing={timing} today={today} />
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayFull } from "@/lib/ownerPulse";
import { ownerTargetHref, targetTiming, type TargetProgress } from "@/lib/ownerTargets";
import { elapsedPct, periodTitle, targetBarTone } from "@/lib/ownerTargetView";
import { PeriodTile } from "./PeriodTile";
import { TargetProgressBar } from "./TargetProgressBar";
import { TargetScopeLabel } from "./TargetScopeLabel";
import { HAIRLINE, HOVER_RAISE } from "./targetStyles";

interface TargetListRowProps {
  progress: TargetProgress;
  /** Tên đặt tay hoặc tên tự sinh "Tháng 9/2026 · Toàn đơn vị". */
  name: string;
  scopeLabel: string;
  today: string;
}

/**
 * Một chỉ tiêu trên danh sách — thẻ-dòng của bản thiết kế: ô kỳ · tên + khoảng ngày ·
 * phạm vi · số tiêu chí đạt · tiến độ chung (vạch thời gian) · mũi tên. Màn hẹp bỏ cột
 * phạm vi (tên đặt tay thì ghi phạm vi ở dòng phụ); điện thoại xếp tiêu chí + tiến độ xuống dưới.
 */
export function TargetListRow({ progress: p, name, scopeLabel, today }: TargetListRowProps) {
  const { target } = p;
  const timing = targetTiming(target, today);
  const total = target.criteria.length;
  const pct = p.overallPct ?? 0;
  const range = `${formatDayFull(target.periodStart)} – ${formatDayFull(p.periodEnd)}`;

  return (
    <Link
      to={ownerTargetHref(target.id)}
      className={cn(
        "grid grid-cols-[44px_minmax(0,1fr)_14px] items-center gap-x-3.5 gap-y-2 rounded-xl px-3.5 py-3 text-foreground transition-shadow",
        "md:grid-cols-[44px_minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_14px] md:gap-3.5",
        "xl:grid-cols-[52px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_16px] xl:gap-[18px] xl:px-[18px] xl:py-3.5",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        timing === "upcoming" ? cn("bg-card/60", HAIRLINE) : cn("bg-card shadow-card", HOVER_RAISE),
      )}
    >
      <PeriodTile type={target.periodType} start={target.periodStart} muted={timing !== "current"} />

      <div className="min-w-0">
        <b className="block truncate text-[14.5px] font-[650]">{name}</b>
        <small className="mt-0.5 block text-[12.5px] tabular-nums text-muted-foreground">
          {target.name && `${periodTitle(target.periodType, target.periodStart)} · `}
          {range}
          {target.name && <span className="xl:hidden"> · {scopeLabel}</span>}
        </small>
      </div>

      <TargetScopeLabel label={scopeLabel} branch={target.branchId !== null} className="hidden xl:flex" />

      <div className="col-[2/4] md:col-auto">
        <small className="text-[12.5px] text-muted-foreground">
          {timing === "upcoming" ? (
            <>
              <b className="font-[650] text-foreground tabular-nums">{total}</b> tiêu chí
            </>
          ) : (
            <>
              <b className="font-[650] text-foreground tabular-nums">
                {p.metCount}/{total}
              </b>{" "}
              tiêu chí đạt
            </>
          )}
        </small>
      </div>

      {timing === "upcoming" ? (
        <p className="col-[2/4] text-[12.5px] text-muted-foreground md:col-auto">
          Chưa bắt đầu · {total} tiêu chí đã đặt
        </p>
      ) : (
        <div className="col-[2/4] grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2.5 md:col-auto">
          <TargetProgressBar
            pct={pct}
            tone={targetBarTone(p, today)}
            elapsed={timing === "current" ? elapsedPct(target.periodType, target.periodStart, today) : null}
            label={`${name}: đạt ${pct}%`}
          />
          <b className="text-right text-[15px] font-bold tabular-nums">{pct}%</b>
        </div>
      )}

      <ChevronRight
        className="col-[3] row-[1] h-[18px] w-[18px] text-muted-foreground md:col-auto md:row-auto"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

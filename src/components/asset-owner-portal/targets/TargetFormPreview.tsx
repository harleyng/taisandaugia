import { Fragment } from "react";
import { formatDayFull } from "@/lib/ownerPulse";
import { TARGET_METRIC_META, formatMetricValue, periodEndOf, type TargetCriterionForm } from "@/lib/ownerTargets";
import { periodTitle, type TargetSlot } from "@/lib/ownerTargetView";

interface TargetFormPreviewProps {
  slot: TargetSlot;
  name: string;
  scopeLabel: string;
  criteria: TargetCriterionForm[];
  today: string;
}

/** Thẻ xem trước bên phải form: tên · khoảng ngày · phạm vi · trạng thái · mục tiêu từng tiêu chí. */
export function TargetFormPreview({ slot, name, scopeLabel, criteria, today }: TargetFormPreviewProps) {
  const end = periodEndOf(slot.periodType, slot.periodStart);
  const row = "grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[13px]";
  const dd = "m-0 text-right font-semibold tabular-nums text-foreground";

  return (
    <section aria-label="Xem trước chỉ tiêu" className="flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-[18px] shadow-card">
      <div>
        <b className="block text-[14.5px] font-[650] text-foreground">
          {name.trim() || periodTitle(slot.periodType, slot.periodStart)}
        </b>
        <small className="mt-px block text-[12.5px] tabular-nums text-muted-foreground">
          {formatDayFull(slot.periodStart)} – {formatDayFull(end)}
        </small>
      </div>
      <dl className={row}>
        <dt className="text-muted-foreground">Phạm vi</dt>
        <dd className={dd}>{scopeLabel}</dd>
        <dt className="text-muted-foreground">Trạng thái</dt>
        <dd className={dd}>{today < slot.periodStart ? "Sắp tới" : "Đang diễn ra"}</dd>
      </dl>
      <hr className="border-t" />
      <dl className={row}>
        {criteria.map((c, i) => {
          const goal = Number(c.goal || 0);
          return (
            <Fragment key={`${c.metric}-${i}`}>
              <dt className="text-muted-foreground">{TARGET_METRIC_META[c.metric].label}</dt>
              <dd className={dd}>{goal > 0 ? formatMetricValue(c.metric, goal) : "—"}</dd>
            </Fragment>
          );
        })}
      </dl>
    </section>
  );
}

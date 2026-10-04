import { formatDayFull, formatDayMonth } from "@/lib/ownerPulse";
import { cn } from "@/lib/utils";
import { axisTickIndexes, chartCeiling, formatCount, isInWindow, type OrderImpact } from "@/lib/ownerMarketing/orderReport";

// Một chuỗi (lượt xem/ngày); màu chỉ tách GIAI ĐOẠN: trước khi chạy (xám) và khi sàn chạy (xanh chính), có chú thích.
const BEFORE = "bg-muted-foreground/30";
const RUNNING = "bg-primary";

/** Lượt xem tin theo ngày — cột thuần CSS theo bản thiết kế, rê chuột hiện ngày + số lượt. */
export function OrderViewsBars({ impact }: { impact: OrderImpact }) {
  const points = impact.daily.map((d) => ({ ...d, running: isInWindow(d.day, impact) }));
  const top = chartCeiling(Math.max(0, ...points.map((p) => p.views)));
  const ticks = axisTickIndexes(points.length);

  return (
    <div className="flex flex-col gap-2.5 pt-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[13.5px] font-semibold text-foreground">Lượt xem tin theo ngày</p>
        <div className="flex gap-3.5 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[3px]", BEFORE)} />
            Trước khi chạy
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[3px]", RUNNING)} />
            Khi sàn chạy
          </span>
        </div>
      </div>

      <div className="grid h-[170px] grid-cols-[28px_minmax(0,1fr)] gap-x-2" aria-hidden="true">
        <div className="-mt-1.5 flex flex-col justify-between pb-5 text-right text-[11.5px] tabular-nums text-muted-foreground">
          <span>{formatCount(top)}</span>
          <span>{formatCount(top / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-col">
          <div className="pointer-events-none absolute inset-x-0 bottom-5 top-0 flex flex-col justify-between">
            <i className="border-t border-border" />
            <i className="border-t border-border" />
            <i className="border-t border-border" />
          </div>
          <div className="relative grid flex-1 auto-cols-fr grid-flow-col items-end gap-[3px]">
            {points.map((p) => (
              <span
                key={p.day}
                className={cn("group relative min-h-[2px] rounded-t-[3px] hover:brightness-90", p.running ? RUNNING : BEFORE)}
                style={{ height: `${(p.views / top) * 100}%` }}
              >
                <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-[2] hidden -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-foreground px-[7px] py-[3px] text-[11.5px] tabular-nums text-background group-hover:block">
                  {formatDayMonth(p.day)} · {formatCount(p.views)} lượt
                </span>
              </span>
            ))}
          </div>
          <div className="flex h-5 items-end justify-between text-[11.5px] tabular-nums text-muted-foreground">
            {ticks.map((i) => (
              <span key={i}>{formatDayMonth(points[i].day)}</span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Lượt xem tin theo ngày</caption>
        <thead>
          <tr>
            <th scope="col">Ngày</th>
            <th scope="col">Lượt xem</th>
            <th scope="col">Giai đoạn</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <th scope="row">{formatDayFull(p.day)}</th>
              <td>{p.views}</td>
              <td>{p.running ? "Khi sàn chạy" : "Trước khi chạy"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

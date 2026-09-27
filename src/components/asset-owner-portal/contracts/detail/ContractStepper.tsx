import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepperView } from "@/lib/contracts/detailView";

/**
 * Thanh 4 bước dưới đầu trang: đã xong (xanh + ngày), đang ở (viền xanh — hoặc vàng
 * "Đến lượt bạn"; xám "Đã huỷ"), chưa tới. Mobile xếp dọc.
 */
export function ContractStepper({ view, mine }: { view: StepperView; mine: boolean }) {
  const { steps, current, finished, cancelled } = view;
  return (
    <ol className="grid gap-3 border-t px-6 pb-5 pt-[18px] md:auto-cols-fr md:grid-flow-col md:gap-0">
      {steps.map((s, i) => {
        const done = i < current || (finished && i === current);
        const cur = i === current && !finished;
        const note = done ? (s.date ?? "Xong") : cur ? (cancelled ? "Đã huỷ" : mine ? "Đến lượt bạn" : "Đang diễn ra") : "";
        return (
          <li key={s.label} className="relative flex items-center gap-3 md:flex-col md:items-start md:gap-2">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[26px] right-1.5 top-2.5 hidden h-0.5 rounded-full md:block",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-[1] grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-card text-primary-foreground",
                done
                  ? "bg-primary"
                  : cur
                    ? cancelled
                      ? "ring-2 ring-inset ring-muted-foreground/60"
                      : mine
                        ? "shadow-[0_0_0_4px_hsl(var(--warning)/0.15)] ring-2 ring-inset ring-warning"
                        : "shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] ring-2 ring-inset ring-primary"
                    : "ring-2 ring-inset ring-border",
              )}
            >
              {done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
            </span>
            <div>
              <b className={cn("block text-[13px]", done || cur ? "text-foreground" : "font-medium text-muted-foreground", cur ? "font-semibold" : "font-medium")}>
                {s.label}
              </b>
              <small
                className={cn(
                  "mt-0.5 block min-h-[17px] text-xs tabular-nums",
                  cur && !cancelled ? (mine ? "font-semibold text-warning" : "font-semibold text-primary") : "text-muted-foreground",
                )}
              >
                {note}
                <span className="sr-only">{done ? " — đã xong" : cur ? " — bước hiện tại" : " — chưa tới"}</span>
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

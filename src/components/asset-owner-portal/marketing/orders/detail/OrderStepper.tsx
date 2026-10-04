import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_WAITING_TEXT, isQuoteExpired, orderTimeline, type MktOrderTimes } from "@/lib/ownerMarketing/orders";
import { formatStepTime } from "../format";

/** Thanh tiến độ ngang trong hero: đã qua (chấm xanh + giờ), bước đang tới (viền xanh + ai đang làm), chưa tới. */
export function OrderStepper({ order }: { order: MktOrderTimes }) {
  const steps = orderTimeline(order);
  const expired = isQuoteExpired(order);
  return (
    <ol
      aria-label="Tiến độ đơn"
      className="grid gap-3 rounded-xl bg-card/60 px-4 py-3.5 md:grid-flow-col md:auto-cols-fr md:gap-0"
    >
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const hint =
          s.state === "done"
            ? formatStepTime(s.at)
            : s.state === "current"
              ? s.key === "paid" && expired
                ? "Báo giá hết hạn"
                : STEP_WAITING_TEXT[s.key]
              : "";
        return (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className="relative flex flex-col gap-1 pr-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative z-[1] grid h-5 w-5 place-items-center rounded-full text-primary-foreground",
                s.state === "done" && "bg-primary",
                s.state === "current" &&
                  "bg-card shadow-[inset_0_0_0_2px_hsl(var(--primary)),0_0_0_4px_hsl(var(--primary)/0.14)]",
                s.state === "todo" && "bg-card shadow-[inset_0_0_0_1.5px_hsl(var(--border))]",
              )}
            >
              {s.state === "done" && <Check className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-6 right-1 top-[9px] hidden h-0.5 rounded-sm md:block",
                  s.state === "done" ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "mt-1 text-[13px]",
                s.state === "todo" ? "font-medium text-muted-foreground" : "font-semibold text-foreground",
              )}
            >
              {s.label}
            </span>
            <span
              className={cn(
                "min-h-[18px] text-xs tabular-nums",
                s.state === "current" ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {hint}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

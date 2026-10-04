import { Check } from "lucide-react";
import { TDG_FLOW, TDG_STATUS_LABELS, tdgStatusLabel, tdgStepIndex } from "@/lib/valuation/status";

/** Thanh tiến trình một đơn thẩm định giá. */
export function ValuationStatusStepper({ status }: { status: string }) {
  const current = tdgStepIndex(status);

  if (current < 0) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {tdgStatusLabel(status)}
      </span>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Tiến trình thẩm định giá">
      {TDG_FLOW.map((step, i) => {
        const done = i < current || (i === current && step === "completed");
        const active = i === current && !done;
        return (
          <li key={step} className="flex items-center gap-1.5">
            <span
              aria-current={active ? "step" : undefined}
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                done ? "bg-success/10 text-success" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {done && <Check className="h-3 w-3" />}
              {TDG_STATUS_LABELS[step]}
            </span>
            {i < TDG_FLOW.length - 1 && <span className="h-px w-2 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

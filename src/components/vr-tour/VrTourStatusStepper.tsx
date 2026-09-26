import { Check } from "lucide-react";
import { VR_FLOW, VR_STATUS_LABELS, vrStatusLabel, vrStepIndex } from "@/lib/vrTour/status";

/** Thanh tiến trình đơn VR tour theo BR-VR-01. Đơn huỷ / bị thay thế hiện nhãn thay cho thanh. */
export function VrTourStatusStepper({ status }: { status: string }) {
  const current = vrStepIndex(status);

  if (current < 0) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {vrStatusLabel(status)}
      </span>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Tiến trình đơn VR tour">
      {VR_FLOW.map((step, i) => {
        const done = i < current || (i === current && step === "attached");
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
              {VR_STATUS_LABELS[step]}
            </span>
            {i < VR_FLOW.length - 1 && <span className="h-px w-2 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

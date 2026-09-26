import { Check } from "lucide-react";
import { TVDG_FLOW, TVDG_STATUS_LABELS, tvdgStatusLabel, tvdgStepIndex } from "@/lib/auctionConsult/status";

/** Thanh tiến trình một yêu cầu tư vấn đấu giá. */
export function AuctionConsultStatusStepper({ status }: { status: string }) {
  const current = tvdgStepIndex(status);

  if (current < 0) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {tvdgStatusLabel(status)}
      </span>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Tiến trình tư vấn đấu giá">
      {TVDG_FLOW.map((step, i) => {
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
              {TVDG_STATUS_LABELS[step]}
            </span>
            {i < TVDG_FLOW.length - 1 && <span className="h-px w-2 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

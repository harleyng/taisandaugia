import { Check } from "lucide-react";
import { GD_STATUS_LABELS, gdFlow, gdStatusLabel, gdStepIndex } from "@/lib/authentication/status";

/** Thanh tiến trình đơn giám định. "Từ ảnh" không có bước hiện vật. */
export function AuthenticationStatusStepper({ status, method }: { status: string; method: string }) {
  const flow = gdFlow(method);
  const current = gdStepIndex(method, status);

  if (current < 0) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {gdStatusLabel(status)}
      </span>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Tiến trình đơn giám định">
      {flow.map((step, i) => {
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
              {step === "item_pending" && method === "on_site" ? "Đã hẹn" : GD_STATUS_LABELS[step]}
            </span>
            {i < flow.length - 1 && <span className="h-px w-2 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

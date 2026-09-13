import { Check, X } from "lucide-react";
import { SALE_STEPS, saleStepIndex } from "@/lib/saleContracts/stage";
import type { SaleStage } from "@/types/auction-sale-contract";
import { cn } from "@/lib/utils";

/**
 * Thanh tiến trình 4 bước. Huỷ KHÔNG nằm trên thanh — nó cắt ngang, nên hiện
 * bằng một khối riêng thay vì một bước đỏ ở cuối.
 */
export function SaleStageStepper({ stage, cancelReason }: { stage: SaleStage; cancelReason?: string | null }) {
  if (stage === "cancelled") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <X className="h-4 w-4" aria-hidden />
          <span className="font-medium">Hợp đồng đã huỷ</span>
        </div>
        {cancelReason ? (
          <p className="mt-1 text-sm text-muted-foreground">Lý do: {cancelReason}</p>
        ) : null}
      </div>
    );
  }

  const current = saleStepIndex(stage);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {SALE_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-success bg-success text-success-foreground",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {i < SALE_STEPS.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

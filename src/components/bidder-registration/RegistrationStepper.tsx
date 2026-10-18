import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { REGISTRATION_STEPPER } from "@/lib/biddingContracts/registrationSteps";

interface Props {
  /** 0–3 = bước form, 4 = thanh toán. */
  current: number;
  /** Bước đã qua được bấm để quay lại; bước sau chỉ tới bằng nút "Tiếp tục". */
  onSelect: (step: number) => void;
  disabled?: boolean;
}

/** Thanh 5 chặng của trang mua hồ sơ (design `.stp`). */
export function RegistrationStepper({ current, onSelect, disabled }: Props) {
  return (
    <ol className="mb-6 flex gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Các bước mua hồ sơ">
      {REGISTRATION_STEPPER.map((title, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={title} className="min-w-[132px] flex-1">
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={disabled || !done || current === 4}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-left text-[13px] font-medium disabled:cursor-default",
                active ? "text-foreground ring-2 ring-inset ring-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  active ? "bg-primary text-primary-foreground" : done ? "bg-primary/10" : "bg-muted",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} /> : i + 1}
              </span>
              <span>{title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

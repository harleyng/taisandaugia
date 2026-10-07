import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { REGISTRATION_STEPS, type RegistrationStepIndex } from "@/lib/biddingContracts/registrationSteps";

interface Props {
  current: RegistrationStepIndex;
  /** Bước đã qua được bấm để quay lại; bước sau chỉ tới bằng nút "Tiếp tục". */
  onSelect: (step: RegistrationStepIndex) => void;
  disabled?: boolean;
}

/** Thanh 4 bước của trang đăng ký tham gia đấu giá. */
export function RegistrationStepper({ current, onSelect, disabled }: Props) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Các bước đăng ký">
      {REGISTRATION_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => onSelect(i as RegistrationStepIndex)}
              disabled={disabled || !done}
              aria-current={active ? "step" : undefined}
              className="flex w-full flex-col items-center gap-1.5 text-center disabled:cursor-default sm:flex-row sm:text-left"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  done && "bg-primary/10 text-primary",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("text-xs font-medium sm:text-sm", active ? "text-foreground" : "text-muted-foreground")}>
                {step.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

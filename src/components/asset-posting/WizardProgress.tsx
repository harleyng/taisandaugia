import { CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WizardProgressProps {
  step: number; // 1-based
  steps: string[];
}

/** Thanh tiến trình + chỉ báo bước cho wizard (theo pattern OnboardingWizard). */
export function WizardProgress({ step, steps }: WizardProgressProps) {
  const total = steps.length;
  return (
    <div className="space-y-3">
      <Progress value={(step / total) * 100} className="h-1.5" />
      <div className="flex justify-between">
        {steps.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  n < step
                    ? "bg-success border-success text-white"
                    : n === step
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground"
                }`}
              >
                {n < step ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span
                className={`text-[10px] text-center hidden sm:block ${
                  n === step ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

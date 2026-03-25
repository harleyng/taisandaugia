import { WIZARD_STRUCTURE } from "@/constants/wizard.constants";

interface WizardProgressBarProps {
  currentMajorStep: number;
  currentSubStep: number;
  onStepClick?: (majorStep: number) => void;
}

export const WizardProgressBar = ({ 
  currentMajorStep, 
  currentSubStep,
  onStepClick 
}: WizardProgressBarProps) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Labels above stepper */}
      <div className="flex gap-2">
        {WIZARD_STRUCTURE.map((step) => {
          const isCurrent = step.id === currentMajorStep;
          
          return (
            <div
              key={step.id}
              className="flex-1 text-center"
            >
              <span 
                className={`text-xs transition-colors ${
                  isCurrent 
                    ? 'text-foreground font-medium' 
                    : 'text-muted-foreground/40'
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Stepper bar */}
      <div className="flex gap-2">
        {WIZARD_STRUCTURE.map((step) => {
          const isCompleted = step.id < currentMajorStep;
          const isCurrent = step.id === currentMajorStep;
          const isClickable = isCompleted || isCurrent;
          
          return (
            <div
              key={step.id}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ease-out ${
                isClickable ? 'cursor-pointer hover:opacity-80' : ''
              }`}
              style={{
                backgroundColor: isCompleted || isCurrent 
                  ? "hsl(0 0% 0%)" 
                  : "hsl(0 0% 85%)",
                opacity: isCompleted || isCurrent ? 1 : 1,
              }}
              onClick={() => isClickable && onStepClick?.(step.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

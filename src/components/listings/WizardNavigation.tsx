import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  canProceed: boolean;
  isLoading?: boolean;
  isUploading?: boolean;
}

export const WizardNavigation = ({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  canProceed,
  isLoading,
  isUploading,
}: WizardNavigationProps) => {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isFirstStep || isLoading || isUploading}
          className="text-base font-semibold underline hover:no-underline"
        >
          Quay lại
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canProceed || isLoading || isUploading}
            size="lg"
            className="min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {(isLoading || isUploading) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isUploading ? "Đang tải..." : "Gửi tin đăng"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            size="lg"
            className="min-w-[120px] bg-foreground hover:bg-foreground/90 text-background font-semibold"
          >
            Tiếp theo
          </Button>
        )}
      </div>
    </div>
  );
};

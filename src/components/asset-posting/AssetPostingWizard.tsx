import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardProgress } from "./WizardProgress";
import { SuccessScreen } from "./SuccessScreen";
import { Step1AssetType } from "./steps/Step1AssetType";
import { Step2GeneralInfo } from "./steps/Step2GeneralInfo";
import { Step3LegalStatus } from "./steps/Step3LegalStatus";
import { Step4AuctionNeeds } from "./steps/Step4AuctionNeeds";
import { Step5MatchAndSend } from "./steps/Step5MatchAndSend";
import { wizardSchema, wizardDefaults, STEP_FIELDS, missingRequiredDelta, type WizardValues } from "./wizardSchema";

const STEPS = ["Loại tài sản", "Thông tin", "Pháp lý", "Nhu cầu", "Chọn tổ chức"];

interface AssetPostingWizardProps {
  /** Quay về danh sách hồ sơ (sau khi gửi thành công hoặc bấm hủy). */
  onDone?: () => void;
  /** Hủy giữa chừng, quay về danh sách. */
  onCancel?: () => void;
}

/** Wizard 5 bước: đăng tài sản số hóa → gợi ý & chọn tổ chức đấu giá phù hợp. */
export function AssetPostingWizard({ onDone, onCancel }: AssetPostingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [doneOrgName, setDoneOrgName] = useState<string | null>(null);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onTouched",
    defaultValues: wizardDefaults,
  });

  const handleNext = async () => {
    const fields = STEP_FIELDS[step];
    const valid = fields.length ? await form.trigger(fields) : true;
    if (!valid) return;

    if (step === 2) {
      const missing = missingRequiredDelta(form.getValues("childSlug"), form.getValues("deltaFields"));
      if (missing.length) {
        toast.error(`Vui lòng nhập: ${missing.join(", ")}`);
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const resetWizard = () => {
    form.reset(wizardDefaults);
    setStep(1);
    setDoneOrgName(null);
  };

  if (doneOrgName) {
    return (
      <SuccessScreen
        orgName={doneOrgName}
        onViewAssets={() => (onDone ? onDone() : navigate("/chu-tai-san/tai-san"))}
        onPostAnother={resetWizard}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div className="space-y-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách tài sản
          </button>
        )}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Số hoá tài sản đấu giá</h1>
          <p className="text-sm text-muted-foreground">
            Số hóa hồ sơ tài sản và để hệ thống gợi ý tổ chức đấu giá phù hợp. Bước {step}/5 — {STEPS[step - 1]}
          </p>
        </div>
      </div>

      <WizardProgress step={step} steps={STEPS} />

      <Card>
        <CardContent className="pt-6">
          {step === 1 && <Step1AssetType form={form} />}
          {step === 2 && <Step2GeneralInfo form={form} />}
          {step === 3 && <Step3LegalStatus form={form} />}
          {step === 4 && <Step4AuctionNeeds form={form} />}
          {step === 5 && <Step5MatchAndSend form={form} onSubmitted={setDoneOrgName} />}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Trở lại
          </Button>
        )}
        <div className="flex-1" />
        {step < 5 && (
          <Button onClick={handleNext} className="gap-1">
            Tiếp tục
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

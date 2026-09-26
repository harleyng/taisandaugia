import { useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { EVIDENCE_ACCEPT, validateEvidenceFile, type ReportOutcomeForm } from "@/lib/ownerOutcomeReport";
import { OptionalMark, OutcomeFieldError } from "./OutcomeFieldError";

interface OutcomeSoldFieldsProps {
  evidence: File | null;
  onEvidenceChange: (file: File | null) => void;
  disabled?: boolean;
}

/** Phần "Thành": giá trúng, số người tham gia, biên bản (tuỳ chọn). */
export function OutcomeSoldFields({ evidence, onEvidenceChange, disabled }: OutcomeSoldFieldsProps) {
  const { control, register, formState } = useFormContext<ReportOutcomeForm>();
  const errors = formState.errors;
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | null) => {
    if (file) {
      const invalid = validateEvidenceFile(file);
      if (invalid) {
        toast.error(invalid);
        if (fileRef.current) fileRef.current.value = "";
        onEvidenceChange(null);
        return;
      }
    }
    onEvidenceChange(file);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="oc-price">Giá trúng (₫)</Label>
          <Controller
            control={control}
            name="winningPrice"
            render={({ field }) => (
              <NumberInput
                id="oc-price"
                allowDecimal={false}
                className="tabular-nums"
                disabled={disabled}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <OutcomeFieldError msg={errors.winningPrice?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oc-participants">
            Số người tham gia
            <OptionalMark />
          </Label>
          <Input
            id="oc-participants"
            inputMode="numeric"
            className="tabular-nums"
            disabled={disabled}
            {...register("participants")}
          />
          <OutcomeFieldError msg={errors.participants?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="oc-evidence">
          Biên bản đấu giá
          <OptionalMark />
        </Label>
        <Input
          ref={fileRef}
          id="oc-evidence"
          type="file"
          accept={EVIDENCE_ACCEPT}
          disabled={disabled}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <p className="break-all text-xs text-muted-foreground">
          {evidence ? evidence.name : "PDF, JPG hoặc PNG · tối đa 10MB"}
        </p>
      </div>
    </div>
  );
}

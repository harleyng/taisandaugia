import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UNSOLD_REASONS, UNSOLD_REASON_LABEL } from "@/lib/ownerOutcomes";
import { VOID_OUTCOMES, VOID_OUTCOME_LABEL, type ReportOutcomeForm } from "@/lib/ownerOutcomeReport";
import { OutcomeFieldError } from "./OutcomeFieldError";

/** "Đang chọn" tô primary nhạt thay cho nền muted mặc định của Toggle. */
const CHOICE_ON = "data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground";

interface OutcomeNotSoldFieldsProps {
  kind: "unsold" | "void";
  disabled?: boolean;
}

/** Phần "Không thành" (lý do chọn nhanh) và "Hoãn-Huỷ" (hoãn / huỷ / rút + lý do không bắt buộc). */
export function OutcomeNotSoldFields({ kind, disabled }: OutcomeNotSoldFieldsProps) {
  const { control, register, watch, formState } = useFormContext<ReportOutcomeForm>();
  const errors = formState.errors;
  const reason = watch("unsoldReason");

  if (kind === "unsold") {
    return (
      <div className="space-y-2">
        <Label id="oc-reason-label">
          Lý do <span className="text-destructive">*</span>
        </Label>
        <Controller
          control={control}
          name="unsoldReason"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-labelledby="oc-reason-label"
              disabled={disabled}
              value={field.value ?? ""}
              // Bấm lại lựa chọn đang bật trả "" — giữ nguyên thay vì bỏ chọn.
              onValueChange={(v) => v && field.onChange(v)}
              className="flex-wrap justify-start gap-2"
            >
              {UNSOLD_REASONS.map((r) => (
                <ToggleGroupItem key={r} value={r} className={CHOICE_ON}>
                  {UNSOLD_REASON_LABEL[r]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
        <OutcomeFieldError msg={errors.unsoldReason?.message} />
        {reason === "other" && (
          <Input
            aria-label="Lý do khác"
            placeholder="Ghi rõ lý do"
            maxLength={500}
            disabled={disabled}
            {...register("note")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label id="oc-void-label">
          Tình trạng phiên <span className="text-destructive">*</span>
        </Label>
        <Controller
          control={control}
          name="voidOutcome"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-labelledby="oc-void-label"
              disabled={disabled}
              value={field.value}
              onValueChange={(v) => v && field.onChange(v)}
              className="flex-wrap justify-start gap-2"
            >
              {VOID_OUTCOMES.map((o) => (
                <ToggleGroupItem key={o} value={o} className={CHOICE_ON}>
                  {VOID_OUTCOME_LABEL[o]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oc-void-note">Lý do</Label>
        <Input id="oc-void-note" maxLength={500} disabled={disabled} {...register("note")} />
        <OutcomeFieldError msg={errors.note?.message} />
      </div>
    </div>
  );
}

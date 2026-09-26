import { useWatch, type UseFormReturn } from "react-hook-form";
import { Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { REPORT_NOTE_MAX, type ReportNotesForm } from "@/lib/ownerPeriodicReport";

interface ReportNotesCardProps {
  form: UseFormReturn<ReportNotesForm>;
  onSave: () => void;
  saving: boolean;
  canEdit: boolean;
  /** Trang không có nút chính nào khác (người không chốt được) ⇒ "Lưu ghi chú" là nút chính. */
  primary: boolean;
}

function NoteField({
  form,
  name,
  label,
  help,
  disabled,
}: {
  form: UseFormReturn<ReportNotesForm>;
  name: keyof ReportNotesForm;
  label: string;
  help: string;
  disabled: boolean;
}) {
  const value = useWatch({ control: form.control, name }) ?? "";
  const error = form.formState.errors[name]?.message;
  const id = `report-${name}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={4} disabled={disabled} {...form.register(name)} />
      {error ? (
        <OutcomeFieldError msg={error} />
      ) : (
        <p className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>{help}</span>
          <span className="shrink-0 tabular-nums">
            {value.length.toLocaleString("en-US")}/{REPORT_NOTE_MAX.toLocaleString("en-US")}
          </span>
        </p>
      )}
    </div>
  );
}

/** Ghi chú của bản nháp — được đóng băng vào báo cáo lúc chốt. */
export function ReportNotesCard({ form, onSave, saving, canEdit, primary }: ReportNotesCardProps) {
  const dirty = form.formState.isDirty;
  return (
    <SectionCard
      title="Ghi chú gửi kèm"
      icon={NotebookPen}
      actions={
        canEdit && (
          <Button
            size="sm"
            variant={primary ? "default" : "outline"}
            disabled={saving || !dirty}
            onClick={onSave}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dirty ? "Lưu ghi chú" : "Đã lưu"}
          </Button>
        )
      }
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        noValidate
      >
        <NoteField
          form={form}
          name="planNote"
          label="Kế hoạch kỳ tới"
          help="Việc đơn vị sẽ làm: đấu lại, giảm giá, xử lý tồn đọng…"
          disabled={!canEdit || saving}
        />
        <NoteField
          form={form}
          name="notes"
          label="Ghi chú của cán bộ"
          help="Giải trình số liệu, khó khăn cần trụ sở hỗ trợ…"
          disabled={!canEdit || saving}
        />
      </form>
    </SectionCard>
  );
}

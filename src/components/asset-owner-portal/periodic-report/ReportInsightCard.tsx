import { useWatch, type UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OutcomeFieldError } from "@/components/asset-owner-portal/outcomes/OutcomeFieldError";
import { REPORT_NOTE_MAX, type ReportNotesForm } from "@/lib/ownerPeriodicReport";

interface ReportInsightCardProps {
  form: UseFormReturn<ReportNotesForm>;
  /** false ⇒ chỉ đọc (đã chốt, hoặc không có quyền sửa nháp). */
  canEdit: boolean;
  onSave: () => void;
  saving: boolean;
  /** Chỉ đọc: nội dung hiển thị (đã chốt ⇒ bản đóng băng trong payload). */
  readOnly: { notes: string | null; planNote: string | null };
}

const FIELDS: { name: keyof ReportNotesForm; label: string; placeholder: string; rows: number }[] = [
  {
    name: "notes",
    label: "Nhận định & đề xuất",
    placeholder: "Ví dụ: đề xuất giảm giá khởi điểm 10% cho căn hộ ở phiên lần 3…",
    rows: 4,
  },
  {
    name: "planNote",
    label: "Kế hoạch kỳ tới",
    placeholder: "Việc đơn vị sẽ làm: đấu lại, giảm giá, xử lý tồn đọng…",
    rows: 3,
  },
];

function Field({ form, field, disabled }: { form: UseFormReturn<ReportNotesForm>; field: (typeof FIELDS)[number]; disabled: boolean }) {
  const value = useWatch({ control: form.control, name: field.name }) ?? "";
  const error = form.formState.errors[field.name]?.message;
  const id = `report-${field.name}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12.5px] font-medium text-muted-foreground">
        {field.label}
      </Label>
      <Textarea
        id={id}
        rows={field.rows}
        disabled={disabled}
        placeholder={field.placeholder}
        className="rounded-[10px] text-[13.5px]"
        {...form.register(field.name)}
      />
      {error ? (
        <OutcomeFieldError msg={error} />
      ) : (
        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {value.length.toLocaleString("en-US")}/{REPORT_NOTE_MAX.toLocaleString("en-US")}
        </p>
      )}
    </div>
  );
}

/**
 * "Nhận định & đề xuất" (+ "Kế hoạch kỳ tới") — lưu vào bản nháp, đóng băng khi chốt.
 * "Nhận định" là mục bắt buộc trong danh sách "Để chốt báo cáo".
 */
export function ReportInsightCard({ form, canEdit, onSave, saving, readOnly }: ReportInsightCardProps) {
  const dirty = form.formState.isDirty;
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-[18px] shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-foreground">Nhận định & đề xuất</h3>
        {canEdit && (
          <Button size="sm" variant="outline" disabled={saving || !dirty} onClick={onSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dirty ? "Lưu" : "Đã lưu"}
          </Button>
        )}
      </div>
      {canEdit ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          noValidate
        >
          {FIELDS.map((f) => (
            <Field key={f.name} form={form} field={f} disabled={saving} />
          ))}
        </form>
      ) : (
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <p className="text-[12.5px] font-medium text-muted-foreground">{f.label}</p>
              <p className="whitespace-pre-wrap rounded-[10px] bg-muted/60 px-3 py-2.5 text-[13.5px] text-foreground">
                {readOnly[f.name]?.trim() || "Không có."}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleField } from "@/components/admin/marketing/ScheduleField";
import type { AdFormState } from "@/lib/advertising/adForm";
import type { AdStartType, AdEndType } from "@/types/advertising";

interface Props {
  form: AdFormState;
  patch: (p: Partial<AdFormState>) => void;
  /** Vị trí "duy nhất" chỉ có 1 chiến dịch nên không cần thứ tự hiển thị. */
  isUnique?: boolean;
}

export function AdScheduleSection({ form, patch, isUnique }: Props) {
  return (
    <div className="space-y-5">
      {/* Thời gian bắt đầu */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <span className="w-32 shrink-0 text-sm text-muted-foreground pt-1.5">Thời gian bắt đầu:</span>
        <div className="space-y-2">
          <RadioGroup
            value={form.start_type}
            onValueChange={(v) => patch({ start_type: v as AdStartType })}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="immediate" id="start-immediate" />
              <Label htmlFor="start-immediate" className="font-normal">Ngay lập tức</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="scheduled" id="start-scheduled" />
              <Label htmlFor="start-scheduled" className="font-normal">Thời gian cụ thể</Label>
            </div>
          </RadioGroup>
          {form.start_type === "scheduled" && (
            <ScheduleField value={form.start_at} onChange={(iso) => patch({ start_at: iso })} />
          )}
        </div>
      </div>

      {/* Thời gian ngừng */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <span className="w-32 shrink-0 text-sm text-muted-foreground pt-1.5">Thời gian ngừng:</span>
        <div className="space-y-2">
          <RadioGroup
            value={form.end_type}
            onValueChange={(v) => patch({ end_type: v as AdEndType })}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="continuous" id="end-continuous" />
              <Label htmlFor="end-continuous" className="font-normal">Liên tục</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="scheduled" id="end-scheduled" />
              <Label htmlFor="end-scheduled" className="font-normal">Thời gian cụ thể</Label>
            </div>
          </RadioGroup>
          {form.end_type === "scheduled" && (
            <ScheduleField value={form.end_at} onChange={(iso) => patch({ end_at: iso })} />
          )}
        </div>
      </div>

      {/* Thứ tự hiển thị — vị trí "duy nhất" chỉ có 1 chiến dịch nên bỏ qua */}
      {!isUnique && (
        <div className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-sm text-muted-foreground">Thứ tự hiển thị:</span>
          <Select value={String(form.sort_order)} onValueChange={(v) => patch({ sort_order: Number(v) })}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

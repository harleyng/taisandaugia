import type { UseFormReturn } from "react-hook-form";
import { ScheduleField } from "../ScheduleField";
import type { CampaignFormValues } from "@/lib/marketing/campaignSchema";

const OPTIONS = [
  { value: "immediate", label: "Gửi ngay lập tức" },
  { value: "scheduled", label: "Hẹn thời gian cụ thể" },
] as const;

export function ScheduleSection({ form }: { form: UseFormReturn<CampaignFormValues> }) {
  const type = form.watch("schedule_type");

  return (
    <div className="space-y-3">
      {OPTIONS.map((o) => (
        <label key={o.value} className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="radio"
            className="accent-primary h-4 w-4"
            checked={type === o.value}
            onChange={() => form.setValue("schedule_type", o.value)}
          />
          <span className="text-sm text-foreground">{o.label}</span>
        </label>
      ))}

      {type === "scheduled" && (
        <div className="pl-6 pt-1">
          <ScheduleField
            value={form.watch("scheduled_at") ?? ""}
            onChange={(iso) => form.setValue("scheduled_at", iso)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Chiến dịch sẽ ở trạng thái &quot;Lên lịch&quot; và được gửi vào thời điểm đã hẹn.
          </p>
        </div>
      )}
    </div>
  );
}

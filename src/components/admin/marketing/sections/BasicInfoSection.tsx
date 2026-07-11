import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { CampaignFormValues } from "@/lib/marketing/campaignSchema";

export function BasicInfoSection({ form }: { form: UseFormReturn<CampaignFormValues> }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Tên chiến dịch <span className="text-destructive">*</span>
        </Label>
        <Input id="name" placeholder="Nhập tên chiến dịch" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Ghi chú</Label>
        <Textarea
          id="notes"
          rows={2}
          placeholder="Nhập ghi chú (không bắt buộc)"
          className="resize-none"
          {...form.register("notes")}
        />
      </div>
    </div>
  );
}

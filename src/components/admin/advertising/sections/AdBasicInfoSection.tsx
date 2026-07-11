import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/hooks/useCustomers";
import type { AdFormState } from "@/lib/advertising/adForm";

interface Props {
  form: AdFormState;
  patch: (p: Partial<AdFormState>) => void;
}

export function AdBasicInfoSection({ form, patch }: Props) {
  const { data: customers } = useCustomers();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>
          Tên chiến dịch <span className="text-destructive">*</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Nhập tên chiến dịch"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Khách hàng (tuỳ chọn)</Label>
        <Select
          value={form.customer_id || "none"}
          onValueChange={(v) => patch({ customer_id: v === "none" ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Không gắn khách hàng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Không gắn khách hàng</SelectItem>
            {customers?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.code ? ` (${c.code})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

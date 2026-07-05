import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DeltaFieldDescriptor } from "@/constants/asset-delta-fields";

interface DeltaFieldInputProps {
  descriptor: DeltaFieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Render generic một trường delta theo descriptor.type. */
export function DeltaFieldInput({ descriptor, value, onChange }: DeltaFieldInputProps) {
  const { key, label, type, options, unit, required, placeholder } = descriptor;
  const id = `delta-${key}`;

  const labelNode = (
    <Label htmlFor={id} className="text-sm">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
  );

  if (type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
        {labelNode}
        <Switch id={id} checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="space-y-1.5">
        {labelNode}
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[72px]"
        />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div className="space-y-1.5">
        {labelNode}
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Chọn..." />
          </SelectTrigger>
          <SelectContent>
            {options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // text | number
  return (
    <div className="space-y-1.5">
      {labelNode}
      <div className="relative">
        <Input
          id={id}
          type={type === "number" ? "number" : "text"}
          inputMode={type === "number" ? "decimal" : undefined}
          value={(value as string | number) ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
          className={unit ? "pr-12" : undefined}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

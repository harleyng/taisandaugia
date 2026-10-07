import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
  inputMode?: "numeric" | "email" | "tel";
  placeholder?: string;
  className?: string;
}

/** Ô nhập bắt buộc (có * đỏ) của form đăng ký — form giữ state, ô chỉ hiển thị. */
export function RegField({ id, label, value, onChange, error, disabled, inputMode, placeholder, className }: Props) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

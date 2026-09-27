import { Input } from "@/components/ui/input";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";

interface Props {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Ô nhập tiền VND — nhóm nghìn bằng dấu phẩy khi gõ (5,000,000 ₫). */
export function VndInput({ id, value, onChange, disabled }: Props) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        value={value ? groupNumber(value) : ""}
        placeholder="0"
        className="pr-7 tabular-nums"
        disabled={disabled}
        onChange={(e) => onChange(parseNumber(e.target.value))}
      />
      <span className="pointer-events-none absolute right-2.5 top-2.5 text-sm text-muted-foreground">₫</span>
    </div>
  );
}

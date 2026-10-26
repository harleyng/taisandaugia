import { Input } from "@/components/ui/input";
import { groupNumber } from "@/lib/advertising/slug";

interface PlanNumberInputProps {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Cho phép phần thập phân (diện tích m²); tiền thì không. */
  decimals?: boolean;
  "aria-describedby"?: string;
}

/**
 * Ô nhập số có tách nhóm 3 chữ số bằng dấu PHẨY ngay khi gõ — luật tiền của dự
 * án áp cho cả hiển thị lẫn ô nhập (feedback_money_formatting). Diện tích dùng
 * cùng ô này với `decimals` để giữ phần thập phân.
 */
export function PlanNumberInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  decimals = false,
  ...rest
}: PlanNumberInputProps) {
  const display = (() => {
    if (value === null) return "";
    if (!decimals) return groupNumber(value);
    const [int, frac] = String(value).split(".");
    return frac ? `${groupNumber(Number(int))}.${frac}` : groupNumber(value);
  })();

  const handle = (raw: string) => {
    const cleaned = decimals ? raw.replace(/[^\d.]/g, "") : raw.replace(/[^\d]/g, "");
    if (!cleaned) return onChange(null);
    // Giữ nguyên dấu chấm đang gõ ("120." → 120) thay vì nhảy về rỗng.
    const n = Number(cleaned.replace(/\.(?=.*\.)/g, ""));
    onChange(Number.isFinite(n) ? n : null);
  };

  return (
    <Input
      id={id}
      inputMode="decimal"
      value={display}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => handle(e.target.value)}
      className="tabular-nums"
      {...rest}
    />
  );
}

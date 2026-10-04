import type { ReactNode } from "react";
import { Field } from "../../fields";
import { INPUT_BASE, borderClass } from "../../fieldStyles";

interface DateFieldProps {
  label: string;
  req?: boolean;
  help?: ReactNode;
  /** yyyy-mm-dd, "" = chưa nhập. */
  value: string;
  onChange: (v: string) => void;
  err?: string;
  disabled?: boolean;
}

/** Ô ngày (input date gốc của trình duyệt) cùng khung với TextField của wizard. */
export function DateField({ label, req, help, value, onChange, err, disabled }: DateFieldProps) {
  return (
    <Field label={label} req={req} help={help} err={err}>
      <input
        type="date"
        className={`${INPUT_BASE} ${borderClass(err, !!value && !err)}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
      />
    </Field>
  );
}

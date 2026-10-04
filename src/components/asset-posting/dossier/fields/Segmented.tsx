export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Lý do khoá — hiện ngay dưới nhóm nút khi lựa chọn bị khoá. */
  hint?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T | "";
  onChange: (v: T) => void;
  ariaLabel: string;
}

/** Nhóm nút chọn một (kiểu SegYesNo của wizard) — xuống dòng được trên màn hẹp. */
export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-[3px] rounded-[10px] border border-border bg-muted/60 p-[3px]"
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.disabled ? o.hint : undefined}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

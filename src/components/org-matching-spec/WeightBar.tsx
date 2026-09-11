/**
 * Thanh tỷ trọng 5 tiêu chí.
 *
 * Năm sắc độ là MỘT màu --primary ở năm mức mờ, không phải năm màu mới: thứ tự
 * đậm → nhạt trùng với thứ tự tỷ trọng lớn → nhỏ, nên bản thân sắc độ cũng nói
 * đúng một điều mà con số đã nói.
 */
const SHADES = [
  "bg-primary text-primary-foreground",
  "bg-primary/80 text-primary-foreground",
  "bg-primary/60 text-primary-foreground",
  "bg-primary/40 text-foreground",
  "bg-primary/25 text-foreground",
];

interface Props {
  bars: { label: string; weight: number }[];
  alt: string;
}

export function WeightBar({ bars, alt }: Props) {
  return (
    <>
      <div role="img" aria-label={alt} className="mb-2.5 flex h-9 overflow-hidden rounded-lg border border-border">
        {bars.map((bar, i) => (
          <div
            key={bar.label}
            style={{ width: `${bar.weight}%` }}
            className={`flex items-center justify-center font-mono text-[10.5px] font-bold ${SHADES[i]}`}
          >
            {bar.weight}
          </div>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
        {bars.map((bar) => (
          <span key={bar.label}>
            {bar.label} {bar.weight}
          </span>
        ))}
      </div>
    </>
  );
}

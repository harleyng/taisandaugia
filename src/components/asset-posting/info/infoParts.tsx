import type { ReactNode } from "react";
import { AlertCircle, ChevronDown, Sparkles } from "lucide-react";
import type { DeltaFieldDescriptor } from "@/constants/asset-delta-fields";
import { confidenceLabel, type ExtractedField } from "@/lib/aiMediaExtraction";

// Atoms của bước 2 "Thông tin tài sản" — port `.v3-*` của thiết kế So Hoa Tai San v3.
// Màu AI dùng thang violet của Tailwind (thiết kế tách AI khỏi màu thương hiệu);
// mọi màu còn lại đi qua token.

/** Khối mục có id `sec-<id>` để rail trái / footer cuộn tới. */
export function InfoSection({
  id,
  title,
  ds,
  right,
  children,
}: {
  id: string;
  title: string;
  /** Chú thích mờ cạnh tiêu đề, vd tên loại tài sản. */
  ds?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={`sec-${id}`}
      className="scroll-mt-4 rounded-xl border border-border bg-card px-6 py-[22px] transition-shadow duration-300"
    >
      <div className="mb-[18px] flex items-center gap-2.5">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
        {ds && <span className="text-[13px] text-muted-foreground">{ds}</span>}
        {right && <span className="ml-auto whitespace-nowrap text-[12.5px]">{right}</span>}
      </div>
      {children}
    </section>
  );
}

/** Nhãn "Đã xong" / đếm tệp ở góc phải tiêu đề mục. */
export function SectionTag({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return <span className={ok ? "font-semibold text-success" : "text-muted-foreground"}>{children}</span>;
}

export function InfoError({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[5px] text-[12.5px] font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {children}
    </div>
  );
}

export function InfoField({
  label,
  req,
  help,
  err,
  ai,
  className = "",
  children,
}: {
  label: string;
  req?: boolean;
  help?: ReactNode;
  err?: string | null;
  /** Giá trị hiện tại do AI điền (chưa sửa tay) ⇒ nhãn "AI" + viền tím. */
  ai?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`group/f flex min-w-0 flex-col gap-1.5 ${className}`} data-state={err ? "bad" : ai ? "ai" : undefined}>
      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground/85">
        <span>
          {label}
          {req && <span className="ml-0.5 text-destructive">*</span>}
        </span>
        {ai && (
          <span className="rounded-[5px] bg-violet-50 px-1.5 py-px text-[10.5px] font-bold tracking-wide text-violet-600">
            AI
          </span>
        )}
      </label>
      {children}
      {err ? <InfoError>{err}</InfoError> : help ? <div className="text-[12.5px] text-muted-foreground">{help}</div> : null}
    </div>
  );
}

// Viền theo trạng thái ô cha (data-state trên InfoField): lỗi đỏ, AI tím.
const CONTROL =
  "w-full rounded-lg border border-input bg-card px-3 py-[9px] text-sm text-foreground outline-none transition " +
  "placeholder:text-muted-foreground/70 focus:border-primary focus:ring-[3px] focus:ring-primary/15 " +
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground " +
  "group-data-[state=bad]/f:border-destructive group-data-[state=bad]/f:bg-destructive/[0.03] " +
  "group-data-[state=ai]/f:border-violet-300 group-data-[state=ai]/f:bg-violet-50/40";

export function InfoInput({
  value,
  onChange,
  placeholder,
  unit,
  num,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  num?: boolean;
}) {
  return (
    <div className="relative flex">
      <input
        type="text"
        className={`${CONTROL} ${unit ? "pr-11" : ""}`}
        inputMode={num ? "numeric" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(num ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
}

export function InfoTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="relative flex">
      <textarea
        rows={rows}
        className={`${CONTROL} resize-y leading-relaxed`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function InfoSelect({
  value,
  onChange,
  options,
  placeholder = "Chọn",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex">
      <select
        className={`${CONTROL} appearance-none pr-[34px]`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lbl = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/**
 * Gợi ý AI một dòng ngay dưới ô: "Gợi ý: <giá trị>  Bỏ qua  [Dùng]".
 * Độ tin cậy + căn cứ nằm ở tooltip để dòng gợi ý giữ gọn như thiết kế.
 */
export function InfoSuggestion({
  field,
  label,
  hasValue,
  onUse,
  onSkip,
}: {
  field: ExtractedField;
  /** Nhãn hiển thị thay cho field.display (vd mô tả dài cắt ngắn). */
  label?: string;
  /** Ô đã có dữ liệu — dùng gợi ý là ghi đè. */
  hasValue?: boolean;
  onUse: () => void;
  onSkip: () => void;
}) {
  const conf = confidenceLabel(field.confidence);
  const tip = [
    `${conf.text} · ${Math.round(field.confidence * 100)}%`,
    field.evidence,
    hasValue ? "Dùng gợi ý này sẽ ghi đè giá trị bạn đã nhập." : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <div
      className="flex items-center gap-2 rounded-[9px] border border-violet-100 bg-violet-50 py-1.5 pl-2.5 pr-1.5 text-[12.5px] text-violet-950"
      title={tip}
    >
      <Sparkles className="h-[13px] w-[13px] shrink-0 text-violet-600" />
      <span className="min-w-0 flex-1 truncate">
        Gợi ý: <b className="font-semibold">{label ?? field.display}</b>
      </span>
      <button
        type="button"
        onClick={onSkip}
        className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-violet-600 transition hover:bg-violet-100"
      >
        Bỏ qua
      </button>
      <button
        type="button"
        onClick={onUse}
        className="rounded-md bg-violet-600 px-2 py-1 text-[12.5px] font-semibold text-white transition hover:bg-violet-700"
      >
        Dùng
      </button>
    </div>
  );
}

/** Một thông số theo loại tài sản (registry asset-delta-fields). */
export function InfoDelta({
  d,
  value,
  onChange,
  err,
  ai,
  suggestion,
}: {
  d: DeltaFieldDescriptor;
  value: unknown;
  onChange: (v: string) => void;
  err?: string | null;
  ai?: boolean;
  suggestion?: ReactNode;
}) {
  const val = value == null ? "" : String(value);
  return (
    <InfoField label={d.label} req={d.required} err={err} ai={ai} className={d.type === "textarea" ? "sm:col-span-2" : ""}>
      {d.type === "select" ? (
        <InfoSelect value={val} onChange={onChange} options={d.options ?? []} />
      ) : d.type === "textarea" ? (
        <InfoTextarea value={val} onChange={onChange} placeholder={d.placeholder} />
      ) : (
        <InfoInput
          value={val}
          onChange={onChange}
          unit={d.unit}
          num={d.type === "number"}
          placeholder={d.placeholder || (d.type === "number" ? "0" : "")}
        />
      )}
      {suggestion}
    </InfoField>
  );
}

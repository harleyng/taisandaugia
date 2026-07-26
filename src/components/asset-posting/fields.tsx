import { useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown } from "lucide-react";
import type { DeltaFieldDescriptor } from "@/constants/asset-delta-fields";
import { filled } from "./wizardSchema";

// Atoms cho wizard số hoá — port từ thiết kế "So Hoa Tai San" sang Tailwind token.

// ─── Field wrapper ────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  req?: boolean;
  help?: ReactNode;
  err?: string;
  unit?: string;
  ok?: boolean;
  children: ReactNode;
}

export function Field({ label, req, help, err, unit, ok, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-[13.5px] font-semibold text-foreground">
        {label}
        {req && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {help && <p className="text-xs text-muted-foreground -mt-0.5">{help}</p>}
      <div className="relative flex items-center">
        {children}
        {unit && (
          <span className="pointer-events-none absolute right-3 text-xs font-semibold text-muted-foreground">{unit}</span>
        )}
        {!unit && ok && <Check className="absolute right-3 h-4 w-4 text-success" />}
      </div>
      {err && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </div>
      )}
    </div>
  );
}

const INPUT_BASE =
  "w-full bg-background border-[1.5px] rounded-[10px] px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-[3px] focus:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed";

const borderClass = (err?: string, ok?: boolean) =>
  err ? "border-destructive bg-destructive/5" : ok ? "border-success/50" : "border-input";

interface TextFieldProps {
  label: string;
  req?: boolean;
  help?: ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  err?: string;
  unit?: string;
  type?: "text" | "number";
  rows?: number;
}

export function TextField({ label, req, help, placeholder, value, onChange, err, unit, type = "text", rows }: TextFieldProps) {
  const ok = filled(value) && !err;
  return (
    <Field label={label} req={req} help={help} err={err} unit={unit} ok={ok}>
      {rows ? (
        <textarea
          className={`${INPUT_BASE} ${borderClass(err, ok)} min-h-[86px] resize-y leading-relaxed`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight: rows * 22 }}
        />
      ) : (
        <input
          className={`${INPUT_BASE} ${borderClass(err, ok)} ${unit ? "pr-14" : ""}`}
          type="text"
          inputMode={type === "number" ? "numeric" : undefined}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
        />
      )}
    </Field>
  );
}

interface SelectFieldProps {
  label: string;
  req?: boolean;
  help?: ReactNode;
  options: { value: string; label: string }[] | string[];
  value: string;
  onChange: (v: string) => void;
  err?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField({ label, req, help, options, value, onChange, err, placeholder = "Chọn", disabled }: SelectFieldProps) {
  const ok = filled(value) && !err;
  return (
    <Field label={label} req={req} help={help} err={err} ok={ok}>
      <div className="relative w-full">
        <select
          className={`${INPUT_BASE} ${borderClass(err, ok)} appearance-none pr-9`}
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
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    </Field>
  );
}

export function DeltaField({
  d,
  value,
  onChange,
  err,
}: {
  d: DeltaFieldDescriptor;
  value: unknown;
  onChange: (v: string) => void;
  err?: string;
}) {
  const val = value == null ? "" : String(value);
  if (d.type === "select")
    return <SelectField label={d.label} req={d.required} options={d.options ?? []} value={val} onChange={onChange} err={err} />;
  if (d.type === "textarea")
    return <TextField label={d.label} req={d.required} rows={3} value={val} onChange={onChange} err={err} placeholder={d.placeholder} />;
  return (
    <TextField
      label={d.label}
      req={d.required}
      type={d.type === "number" ? "number" : "text"}
      unit={d.unit}
      value={val}
      onChange={onChange}
      err={err}
      placeholder={d.placeholder || (d.type === "number" ? "0" : "")}
    />
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────
export function Group({
  icon,
  title,
  desc,
  right,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/20">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
        </div>
        <div className="flex-1" />
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function OptionalGroup({
  icon,
  title,
  desc,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc?: ReactNode;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/10">
        <span className="w-7 h-7 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:bg-primary/5 rounded-lg px-2 py-1.5 transition"
        >
          {open ? "Thu gọn" : `Mở ${count} mục tùy chọn`}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

// ─── Segmented Không / Có ─────────────────────────────────────────────────────
export function SegYesNo({ value, onChange }: { value: string; onChange: (v: "yes" | "no") => void }) {
  return (
    <div className="inline-flex bg-muted/60 border border-border rounded-[10px] p-[3px] gap-[3px]">
      <button
        type="button"
        onClick={() => onChange("no")}
        className={`px-[18px] py-1.5 rounded-lg text-[13.5px] font-semibold transition ${
          value === "no" ? "bg-card text-success shadow-sm" : "text-muted-foreground"
        }`}
      >
        Không
      </button>
      <button
        type="button"
        onClick={() => onChange("yes")}
        className={`px-[18px] py-1.5 rounded-lg text-[13.5px] font-semibold transition ${
          value === "yes" ? "bg-card text-warning shadow-sm" : "text-muted-foreground"
        }`}
      >
        Có
      </button>
    </div>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────
export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`w-[42px] h-6 rounded-full p-[3px] shrink-0 transition ${on ? "bg-primary" : "bg-input"}`}
    >
      <span className={`block w-[18px] h-[18px] rounded-full bg-white transition-transform ${on ? "translate-x-[18px]" : ""}`} />
    </button>
  );
}

// ─── Wide radio (phương án dạng hàng) ─────────────────────────────────────────
export function WideRadio({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex gap-3 items-start text-left border-[1.5px] rounded-xl p-3.5 transition ${
        on ? "border-primary bg-primary/5" : "border-border hover:border-primary"
      }`}
    >
      <span
        className={`w-[18px] h-[18px] rounded-full border-[1.5px] mt-0.5 grid place-items-center shrink-0 bg-background ${
          on ? "border-primary" : "border-input"
        }`}
      >
        {on && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 min-w-0">{children}</span>
    </button>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({ tone = "muted", children }: { tone?: "muted" | "req" | "ok"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-success/10 text-success border-success/30"
      : tone === "req"
      ? "bg-primary/5 text-primary border-primary/20"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${cls}`}>
      {children}
    </span>
  );
}

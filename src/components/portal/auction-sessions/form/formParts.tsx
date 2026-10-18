import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

/** Thẻ một nhóm trường, đầu thẻ có số thứ tự tròn (design `.sec`). */
export function FormSection({
  no,
  title,
  description,
  children,
}: {
  no: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card px-[22px] pb-[22px] pt-5 shadow-card">
      <header className="flex items-start gap-3">
        <span className="mt-px grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-foreground text-[12.5px] font-bold text-background">
          {no}
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-px text-[13px] text-muted-foreground [text-wrap:pretty]">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

interface SuffixNumberInputProps
  extends Omit<ComponentPropsWithoutRef<typeof NumberInput>, "value" | "onChange" | "allowDecimal"> {
  unit: string;
  value: string | undefined;
  onChange: (v: string) => void;
  invalid?: boolean;
}

/**
 * Ô số có đơn vị mờ bên phải ("phút", "đ", "người"…) — design `.sfx`. Chuyển ref +
 * id/aria mà FormControl gắn vào xuống ô nhập để nhãn và thông báo lỗi trỏ đúng.
 */
export const SuffixNumberInput = forwardRef<HTMLInputElement, SuffixNumberInputProps>(
  ({ unit, value, onChange, invalid, className, ...rest }, ref) => (
    <div className="relative">
      <NumberInput
        ref={ref}
        value={value ?? ""}
        onChange={onChange}
        allowDecimal={false}
        inputMode="numeric"
        className={cn("pr-14", invalid && "border-destructive", className)}
        {...rest}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12.5px] text-muted-foreground">
        {unit}
      </span>
    </div>
  ),
);
SuffixNumberInput.displayName = "SuffixNumberInput";

/** Nhãn trường nhỏ kiểu design (13px đậm, * đỏ cho trường bắt buộc). */
export function Req() {
  return <span className="text-destructive"> *</span>;
}

import type { ReactNode } from "react";

interface TargetFormSectionProps {
  no: number;
  title: ReactNode;
  children: ReactNode;
}

/** Một khối đánh số của form đặt chỉ tiêu (thẻ trắng, số tròn đen + tiêu đề). */
export function TargetFormSection({ no, title, children }: TargetFormSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card px-[22px] py-5 shadow-card">
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background"
        >
          {no}
        </span>
        <h2 className="text-[15px] font-[650] text-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}

/** Nhãn ô nhập của form (13px đậm). */
export const FIELD_LABEL = "text-[13px] font-semibold text-foreground";
/** Dòng gợi ý / lỗi dưới ô nhập. */
export const FIELD_HINT = "text-[12.5px] text-muted-foreground";
export const FIELD_ERROR = "text-[12.5px] font-medium text-destructive";

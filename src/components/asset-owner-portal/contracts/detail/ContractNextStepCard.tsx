import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { NextStepView, TermNoteTone, TermsView } from "@/lib/contracts/detailView";

const NOTE_TONE: Record<TermNoteTone, string> = {
  ok: "text-primary",
  muted: "text-muted-foreground",
  warn: "text-warning",
};

interface ContractNextStepCardProps {
  next: NextStepView;
  terms: TermsView;
  /** Nút thao tác chính (phải). */
  actions?: ReactNode;
  /** Liên kết huỷ (trái, đỏ). */
  cancel?: ReactNode;
  /** Nội dung chen giữa mô tả và bảng (cảnh báo…). */
  children?: ReactNode;
}

/**
 * Thẻ chính cột trái: việc tiếp theo (tiêu đề + "Việc của bạn" / chú thích + một câu) →
 * bảng điều khoản / lịch thu / phạm vi → hàng nút (huỷ bên trái, thao tác bên phải).
 */
export function ContractNextStepCard({ next, terms, actions, cancel, children }: ContractNextStepCardProps) {
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-1 pt-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{next.headline}</h2>
        {next.mine ? (
          <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">Việc của bạn</span>
        ) : (
          next.aux && <span className="text-[13px] tabular-nums text-muted-foreground">{next.aux}</span>
        )}
      </div>
      {next.description && (
        <p className="max-w-[680px] text-pretty px-[22px] text-[13.5px] text-muted-foreground">{next.description}</p>
      )}
      {children && <div className="px-[22px] pt-3">{children}</div>}

      <div className="mt-2.5 px-[22px] pb-1 pt-2">
        <p className="pb-0.5 pt-1 text-[11.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">{terms.label}</p>
        {terms.rows.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-[13px]",
              i > 0 && (r.total ? "border-t border-foreground" : "border-t"),
            )}
          >
            <div>
              <b className={cn("block text-[13.5px]", r.total ? "font-bold" : "font-semibold", r.dim && "font-medium text-muted-foreground")}>
                {r.title}
              </b>
              {r.sub && <small className="mt-px block text-[12.5px] text-muted-foreground">{r.sub}</small>}
            </div>
            <div
              className={cn(
                "whitespace-nowrap text-right tabular-nums",
                r.total ? "font-bold" : "font-semibold",
                r.dim && "font-medium text-muted-foreground",
              )}
            >
              {r.value}
              {r.note && <small className={cn("block text-xs font-semibold", NOTE_TONE[r.note.tone])}>{r.note.text}</small>}
            </div>
          </div>
        ))}
      </div>

      {actions || cancel ? (
        <div className="mt-2 flex flex-wrap items-center gap-2.5 border-t px-[22px] pb-[18px] pt-3.5">
          {cancel}
          <span className="flex-1" />
          {actions}
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </section>
  );
}

import { Fragment, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Requirement } from "../wizardSchema";
import { jumpToSection, sectionOfKey } from "../info/infoSections";

interface WizardFooterProps {
  step: number;
  onBack: () => void;
  onExit: () => void;
  onNext: () => void;
  /** Mục bắt buộc còn thiếu của bước hiện tại. */
  stepMissing: Requirement[];
  /** Nút chính của bước cuối (Hoàn tất…) — bước 1–4 là "Tiếp tục". */
  finishButton: ReactNode;
}

const BTN = "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-4 text-sm font-semibold transition";

/**
 * Thanh dưới cố định (thiết kế v3) — cùng lưới 2 cột với nội dung để nút thẳng
 * mép phải khối nội dung. Liệt kê tối đa 3 mục còn thiếu; bấm để cuộn tới (bước 2).
 */
export function WizardFooter({ step, onBack, onExit, onNext, stepMissing, finishButton }: WizardFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[46] bg-card shadow-[0_-1px_0_hsl(var(--border))]">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-4 py-2.5 sm:px-6 md:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <div className="hidden md:block" />
        <div className="flex min-w-0 items-center gap-3">
          {step > 1 ? (
            <button type="button" onClick={onBack} className={`${BTN} border border-border bg-card text-muted-foreground hover:border-input hover:text-foreground`}>
              <ChevronLeft className="h-[15px] w-[15px]" /> Quay lại
            </button>
          ) : (
            <button type="button" onClick={onExit} className={`${BTN} border border-border bg-card text-muted-foreground hover:border-input hover:text-foreground`}>
              <ArrowLeft className="h-[15px] w-[15px]" /> Thoát
            </button>
          )}
          <div className="flex-1" />
          {step < 5 && stepMissing.length > 0 && (
            <div className="hidden min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground sm:flex">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
              <span className="whitespace-nowrap">Còn thiếu</span>
              {stepMissing.slice(0, 3).map((m, i) => {
                const sec = step === 2 ? sectionOfKey(m.key) : undefined;
                return (
                  <Fragment key={m.key}>
                    {i > 0 && <span>·</span>}
                    <button
                      type="button"
                      onClick={() => sec && jumpToSection(sec)}
                      className="truncate font-medium underline decoration-input underline-offset-[3px] transition hover:text-primary"
                    >
                      {m.label}
                    </button>
                  </Fragment>
                );
              })}
              {stepMissing.length > 3 && <span>+{stepMissing.length - 3}</span>}
            </div>
          )}
          {step < 5 ? (
            <button type="button" onClick={onNext} className={`${BTN} bg-primary text-primary-foreground hover:bg-primary/90`}>
              Tiếp tục <ChevronRight className="h-[15px] w-[15px]" />
            </button>
          ) : (
            finishButton
          )}
        </div>
      </div>
    </div>
  );
}

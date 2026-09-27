import { Fragment } from "react";
import { Check } from "lucide-react";
import type { Requirement } from "../wizardSchema";
import { jumpToSection, sectionState, type InfoSection } from "../info/infoSections";
import { WIZARD_STEPS } from "./wizardSteps";


interface WizardNavProps {
  step: number;
  go: (n: number) => void;
  reqs: Requirement[];
  /** Mục con của bước 2 — hiện dưới bước "Thông tin" khi đang ở bước đó. */
  sections: InfoSection[];
}

/** Rail dọc bên trái (thiết kế v3): 5 bước, bước 2 xổ danh sách mục để cuộn tới. Ẩn dưới md. */
export function WizardNav({ step, go, reqs, sections }: WizardNavProps) {
  return (
    <nav className="sticky top-8 hidden flex-col md:flex">
      {WIZARD_STEPS.map((s) => {
        const rs = reqs.filter((r) => r.step === s.n);
        const active = step === s.n;
        const done = !active && rs.length > 0 && rs.every((r) => r.ok);
        return (
          <Fragment key={s.n}>
            <button
              type="button"
              onClick={() => go(s.n)}
              className={`flex items-center gap-3 rounded-[10px] border px-2.5 py-[9px] text-left text-sm transition ${
                active
                  ? "border-border bg-card font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-card"
              }`}
            >
              <span
                className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] text-[11.5px] font-bold ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-success bg-success text-white"
                      : "border-input bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-[13px] w-[13px]" strokeWidth={2.5} /> : s.n}
              </span>
              {s.label}
            </button>
            {s.n === 2 && active && (
              <div className="mb-2.5 ml-5 mt-1.5 flex flex-col border-l-[1.5px] border-border pl-3">
                {sections.map((x) => {
                  const state = sectionState(x);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => jumpToSection(x.id)}
                      className="flex items-center gap-2 rounded-[7px] px-2 py-[5px] text-left text-[13px] text-muted-foreground transition hover:bg-card hover:text-foreground"
                    >
                      <span
                        className={`h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] ${
                          state === "ok" ? "border-success bg-success" : "border-input"
                        }`}
                      />
                      {x.label}
                    </button>
                  );
                })}
              </div>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

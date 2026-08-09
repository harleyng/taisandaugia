import { CheckCircle2, Circle } from "lucide-react";
import type { KYCFormData, SectionStatus } from "./sectionStatus";

interface ReviewPanelProps {
  form: KYCFormData;
  status: SectionStatus;
  onJump?: (id: "a" | "b" | "c" | "d") => void;
}

const SECTIONS: { id: "a" | "b" | "c" | "d"; label: string }[] = [
  { id: "a", label: "Công ty đấu giá" },
  { id: "b", label: "Chức danh" },
  { id: "c", label: "Định danh người đăng ký" },
  { id: "d", label: "Giấy tờ pháp lý" },
];

const ProgressRing = ({ progress }: { progress: number }) => {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(progress, 1));
  const done = progress >= 1;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4.5" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={done ? "#16a34a" : "hsl(152 60% 26%)"}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x="28"
        y="33"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="currentColor"
      >
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
};

export const ReviewPanel = ({ status, onJump }: ReviewPanelProps) => {
  const sectionDone: Record<string, boolean> = {
    a: status.a.done,
    b: status.b.done,
    c: status.c.done,
    d: status.d.done,
  };
  const remaining = SECTIONS.filter((s) => !sectionDone[s.id]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ProgressRing progress={status.progress} />
        <div>
          <p className="font-semibold text-sm text-foreground">Hồ sơ KYC</p>
          <p className="text-xs text-muted-foreground">
            {remaining === 0 ? "Sẵn sàng nộp hồ sơ" : `Còn ${remaining} mục cần hoàn thiện`}
          </p>
        </div>
      </div>

      <div className="space-y-0.5">
        {SECTIONS.map(({ id, label }) => {
          const done = sectionDone[id];
          return (
            <button
              key={id}
              onClick={() => onJump?.(id)}
              className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              )}
              <span
                className={`text-xs flex-1 ${
                  done
                    ? "line-through text-muted-foreground"
                    : "font-medium text-foreground"
                }`}
              >
                {label}
              </span>
              {!done && (
                <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">
                  →
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

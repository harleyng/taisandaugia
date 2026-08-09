import { CheckCircle2, Circle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTION_META, type AdSection, type AdSectionStatus } from "@/lib/advertising/adStatus";
import { formatVnd } from "@/lib/advertising/slug";
import type { AdPosition } from "@/types/advertising";

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
      <text x="28" y="33" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
};

interface Props {
  status: AdSectionStatus;
  position?: AdPosition | null;
  onJump: (id: AdSection) => void;
}

export function AdReviewPanel({ status, position, onJump }: Props) {
  const doneMap: Record<AdSection, boolean> = {
    basic: status.basic.done,
    content: status.content.done,
    schedule: status.schedule.done,
  };
  const remaining = SECTION_META.filter((s) => !doneMap[s.id]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ProgressRing progress={status.progress} />
        <div>
          <p className="font-semibold text-sm text-foreground">Chiến dịch quảng cáo</p>
          <p className="text-xs text-muted-foreground">
            {remaining === 0 ? "Sẵn sàng đăng" : `Còn ${remaining} mục cần hoàn thiện`}
          </p>
        </div>
      </div>

      <div className="space-y-0.5">
        {SECTION_META.map(({ id, label }) => {
          const done = doneMap[id];
          return (
            <button
              key={id}
              onClick={() => onJump(id)}
              className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              )}
              <span className={cn("text-xs flex-1", done ? "line-through text-muted-foreground" : "font-medium text-foreground")}>
                {label}
              </span>
              {!done && <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">→</span>}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2.5">
        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          {position ? (
            <>
              <p className="text-sm font-semibold text-foreground">{position.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {position.page?.name ?? ""} ·{" "}
                {position.placement_type === "unique" ? "Vị trí duy nhất" : "Vị trí slide"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Giá: {formatVnd(position.price)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa chọn vị trí hiển thị</p>
          )}
        </div>
      </div>
    </div>
  );
}

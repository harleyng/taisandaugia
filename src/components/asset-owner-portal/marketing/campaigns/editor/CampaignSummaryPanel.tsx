import { AlertTriangle, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { EDITOR_SECTIONS, type EditorSection } from "@/lib/ownerMarketing/campaigns";
import { cn } from "@/lib/utils";

interface CampaignSummaryPanelProps {
  done: Record<EditorSection, boolean>;
  progress: number;
  onJump: (s: EditorSection) => void;
  rejectedReason: string | null;
}

const STEPS = [
  "Bạn soạn và gửi duyệt.",
  "Người có quyền Duyệt (thường là Trưởng đơn vị) xem và duyệt — người soạn không tự duyệt.",
  "Duyệt xong, sàn tạo link Hồ sơ online cho từng tài sản × kênh và ghép sẵn vào nội dung.",
  "Bạn sao chép / tải tư liệu, gửi qua kênh của đơn vị rồi đánh dấu “Đã gửi”.",
];

/** Cột phải dính của trình soạn: tiến độ, nhảy tới mục, quy trình duyệt hai người. */
export function CampaignSummaryPanel({ done, progress, onJump, rejectedReason }: CampaignSummaryPanelProps) {
  const remaining = EDITOR_SECTIONS.filter((s) => !done[s.id]).length;
  return (
    <div className="space-y-4 rounded-2xl bg-card p-4 shadow-card sm:p-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Chiến dịch</p>
          <p className="text-xs tabular-nums text-muted-foreground">{Math.round(progress * 100)}%</p>
        </div>
        <Progress value={progress * 100} className="h-1.5" aria-label="Tiến độ soạn chiến dịch" />
        <p className="text-xs text-muted-foreground">
          {remaining === 0 ? "Sẵn sàng gửi duyệt" : `Còn ${remaining} mục cần hoàn thiện`}
        </p>
      </div>

      <ul className="space-y-0.5">
        {EDITOR_SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onJump(id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
            >
              {done[id] ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={1.5} />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
              )}
              <span className={cn("flex-1 text-xs", done[id] ? "text-muted-foreground" : "font-medium text-foreground")}>
                {label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {rejectedReason && (
        <div className="flex gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-foreground">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="font-semibold">Bị từ chối</p>
            <p className="mt-0.5 break-words text-muted-foreground">{rejectedReason}</p>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl bg-muted/40 px-3 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />
          Duyệt hai người
        </p>
        <ol className="list-decimal space-y-1 pl-4 text-[11.5px] text-muted-foreground">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  collectIssues,
  downloadIssueRows,
  type ClassifiedImport,
  type ImportIssue,
} from "@/lib/marketing/importClassify";

function Chip({
  tone,
  icon: Icon,
  n,
  label,
}: {
  tone: "success" | "danger";
  icon: typeof CheckCircle2;
  n: number;
  label: string;
}) {
  const cls =
    n === 0
      ? "border-border bg-muted/30 text-muted-foreground"
      : tone === "success"
        ? "border-success/30 bg-success/10 text-success"
        : "border-destructive/30 bg-destructive/[0.08] text-destructive";
  return (
    <div className={cn("flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2", cls)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-base font-bold tabular-nums">{n.toLocaleString("vi-VN")}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ReasonTag({ reason, tone }: { reason: string; tone: "danger" | "warning" }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-1.5 py-px text-[11px] font-medium",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/[0.08] text-destructive"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {reason}
    </span>
  );
}

interface Props {
  res: ClassifiedImport;
  onConfirm: () => void;
}

/**
 * Báo cáo kết quả import: số sẽ thêm / số dòng bị bỏ, kèm danh sách gộp
 * (lỗi + trùng + chưa cho phép) theo dòng và nút tải file các dòng lỗi.
 */
export function ImportReport({ res, onConfirm }: Props) {
  const [showErr, setShowErr] = useState(true);
  const issues: ImportIssue[] = collectIssues(res);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        <Chip tone="success" icon={CheckCircle2} n={res.valid.length} label="sẽ thêm" />
        <Chip tone="danger" icon={AlertCircle} n={issues.length} label="dòng bị bỏ" />
      </div>

      {issues.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowErr((s) => !s)}
            className="flex w-full items-center gap-2 bg-muted/40 px-2.5 py-2 text-xs font-semibold text-foreground"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            {issues.length.toLocaleString("vi-VN")} dòng bị bỏ qua
            <ChevronDown
              className={cn(
                "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
                showErr && "rotate-180",
              )}
            />
          </button>
          {showErr && (
            <>
              <div className="max-h-44 divide-y divide-border overflow-y-auto border-t border-border">
                {issues.map((r, i) => (
                  <div
                    key={`${r.row}-${i}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-[42px] text-muted-foreground">Dòng {r.row}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                      {r.raw || "(trống)"}
                    </span>
                    <ReasonTag reason={r.reason} tone={r.tone} />
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => downloadIssueRows(issues)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Download className="h-3 w-3" /> Tải file các dòng lỗi
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <Button className="w-full" disabled={res.valid.length === 0} onClick={onConfirm}>
        {res.valid.length > 0
          ? `Thêm ${res.valid.length.toLocaleString("vi-VN")} email vào danh sách`
          : "Không có email hợp lệ để thêm"}
      </Button>
    </div>
  );
}

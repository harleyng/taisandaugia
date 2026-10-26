import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BASELINE_DIFF_GROUPS,
  BASELINE_DIFF_GROUP_LABELS,
  baselineDiffHasChanges,
  baselineDiffSummary,
  type BaselineDiff,
  type BaselineDiffGroup,
} from "@/lib/auctionPlan/diff";

/** Màu chỉ nằm ở nhãn nhóm, không tô cả khối (§A8.4). */
const GROUP_TONE: Record<BaselineDiffGroup, string> = {
  added: "text-primary",
  dropped: "text-destructive",
  movedQuarter: "text-warning",
  valueShift: "text-warning",
  other: "text-muted-foreground",
};

const GROUP_HINT: Record<BaselineDiffGroup, string> = {
  added: "tài sản mới so với bản mốc",
  dropped: "tài sản đã bỏ khỏi kế hoạch",
  movedQuarter: "tài sản dời sang quý khác",
  valueShift: "tài sản lệch giá trị khởi điểm quá 10%",
  other: "tài sản sửa thông tin khác (không cần duyệt lại)",
};

interface PlanDiffSummaryProps {
  diff: BaselineDiff | null | undefined;
  /** Câu hiện khi không có gì đổi. */
  emptyText?: string;
  className?: string;
}

/**
 * "Thêm 3 · Bỏ 1 · Dời quý 2" + danh sách mã tài sản mở ra được.
 *
 * Dùng chung cho tab "Phê duyệt & lịch sử" (so hai bản mốc, tính ở client bằng
 * `diffBaselines`) và hộp thoại "Trình bản điều chỉnh" (số của server qua
 * `auction_plan_baseline_diff`) — hai nguồn, một cách đọc.
 */
export function PlanDiffSummary({ diff, emptyText, className }: PlanDiffSummaryProps) {
  const [open, setOpen] = useState(false);
  const summary = baselineDiffSummary(diff);
  const changed = baselineDiffHasChanges(diff);

  if (!diff || !changed) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyText ?? "Không thay đổi so với bản mốc đã duyệt."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-foreground"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        )}
        <span>{summary}</span>
      </button>

      {open && (
        <dl className="space-y-1.5 rounded-xl bg-muted/40 px-3 py-2.5">
          {BASELINE_DIFF_GROUPS.filter((g) => diff[g].length > 0).map((g) => (
            <div key={g} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className={cn("shrink-0 text-xs font-medium", GROUP_TONE[g])}>
                {BASELINE_DIFF_GROUP_LABELS[g]} ({diff[g].length} {GROUP_HINT[g]})
              </dt>
              <dd className="min-w-0 text-xs tabular-nums text-foreground">{diff[g].join(", ")}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

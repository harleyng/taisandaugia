import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { docLabel } from "@/lib/legalConsult/paths";
import { ITEM_STATUS_LABELS } from "@/lib/legalConsult/status";
import type { ChecklistDraftItem, ChecklistItemStatus } from "@/types/legalConsult";

const STATUS_OPTIONS: { value: ChecklistItemStatus; on: string }[] = [
  { value: "sufficient", on: "border-success bg-success/10 text-success" },
  { value: "missing", on: "border-destructive bg-destructive/10 text-destructive" },
  { value: "needs_clarification", on: "border-warning bg-warning/15 text-warning" },
];

interface ChecklistItemEditorProps {
  index: number;
  item: ChecklistDraftItem;
  submittedDocs: string[];
  /** Mục đang có lỗi khi kiểm lúc hoàn tất. */
  invalid: boolean;
  onChange: (patch: Partial<ChecklistDraftItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}

/** Một mục checklist: tên, Đủ / Thiếu / Cần làm rõ, việc người bán cần làm, ghi chú, tệp liên quan. */
export function ChecklistItemEditor({
  index,
  item,
  submittedDocs,
  invalid,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: ChecklistItemEditorProps) {
  const needsAction = !!item.status && item.status !== "sufficient";
  const toggleDoc = (path: string, on: boolean) =>
    onChange({ doc_paths: on ? [...item.doc_paths, path] : item.doc_paths.filter((p) => p !== path) });

  return (
    <li className={`space-y-2.5 rounded-xl border p-3 ${invalid ? "border-destructive/60 bg-destructive/5" : "border-border"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-2 w-5 shrink-0 text-xs font-semibold text-muted-foreground">{index + 1}.</span>
        <Input
          value={item.label}
          maxLength={300}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label={`Tên mục ${index + 1}`}
          className="flex-1"
        />
        <div className="flex shrink-0 items-center">
          <Button type="button" size="icon" variant="ghost" disabled={isFirst} onClick={() => onMove(-1)} aria-label="Lên">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" disabled={isLast} onClick={() => onMove(1)} aria-label="Xuống">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="Xoá mục">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-7" role="radiogroup" aria-label="Kết luận mục">
        {STATUS_OPTIONS.map((o) => {
          const on = item.status === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ status: on ? null : o.value })}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                on ? o.on : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {ITEM_STATUS_LABELS[o.value]}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 pl-7">
        {needsAction && (
          <Textarea
            rows={2}
            maxLength={2000}
            value={item.required_action}
            placeholder="Người bán cần bổ sung / làm rõ gì? (bắt buộc)"
            onChange={(e) => onChange({ required_action: e.target.value })}
            className={item.required_action.trim().length < 5 ? "border-warning" : undefined}
          />
        )}
        <Textarea
          rows={1}
          maxLength={2000}
          value={item.expert_note}
          placeholder="Nhận xét của chuyên gia (tuỳ chọn)"
          onChange={(e) => onChange({ expert_note: e.target.value })}
        />
        {submittedDocs.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {submittedDocs.map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox checked={item.doc_paths.includes(p)} onCheckedChange={(v) => toggleDoc(p, v === true)} />
                {docLabel(p)}
              </label>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

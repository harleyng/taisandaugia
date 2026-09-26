import { useEffect, useMemo, useState } from "react";
import { FileCheck2, Loader2, Plus, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLegalConsultItems } from "@/hooks/useLegalConsultations";
import { useSaveLegalConsultChecklist } from "@/hooks/useAdminLegalConsultations";
import { initialDraft, MAX_CHECKLIST_ITEMS, validateChecklist } from "@/lib/legalConsult/checklist";
import type { ChecklistDraftItem, LegalConsultation } from "@/types/legalConsult";
import { ChecklistItemEditor } from "./ChecklistItemEditor";
import { CompleteLegalConsultDialog } from "./CompleteLegalConsultDialog";

/**
 * Soạn checklist khi lần tư vấn đang rà soát: nạp mẫu theo nhóm tài sản (hoặc bản nháp
 * đã lưu), chấm từng mục, thêm / xoá / sắp xếp, lưu nháp, hoàn tất.
 */
export function ChecklistEditor({ row, canUpdate }: { row: LegalConsultation; canUpdate: boolean }) {
  const { data: saved, isLoading } = useLegalConsultItems(row.id);
  const save = useSaveLegalConsultChecklist();
  const [draft, setDraft] = useState<ChecklistDraftItem[] | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  // Nạp một lần khi dữ liệu về — không ghi đè nháp đang soạn mỗi lần refetch.
  useEffect(() => {
    if (saved && draft === null) setDraft(initialDraft(saved, row.parent_slug));
  }, [saved, draft, row.parent_slug]);

  const items = useMemo(() => draft ?? [], [draft]);
  const invalidIdx = useMemo(
    () => new Set(validateChecklist(items, true).flatMap((i) => ("index" in i ? [i.index] : []))),
    [items],
  );
  const draftIssues = validateChecklist(items, false);

  if (isLoading || draft === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải checklist…
      </div>
    );
  }

  const update = (idx: number, patch: Partial<ChecklistDraftItem>) =>
    setDraft((cur) => (cur ?? []).map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => setDraft((cur) => (cur ?? []).filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) =>
    setDraft((cur) => {
      const next = [...(cur ?? [])];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return next;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  const add = () =>
    setDraft((cur) => [
      ...(cur ?? []),
      { template_key: null, label: "", status: null, expert_note: "", required_action: "", doc_paths: [] },
    ]);

  if (!canUpdate) {
    return <p className="text-sm text-muted-foreground">Đang rà soát — cần quyền cập nhật để soạn checklist.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((it, i) => (
          <ChecklistItemEditor
            key={i}
            index={i}
            item={it}
            submittedDocs={row.submitted_doc_paths}
            invalid={showIssues && invalidIdx.has(i)}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
            onMove={(dir) => move(i, dir)}
            isFirst={i === 0}
            isLast={i === items.length - 1}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={items.length >= MAX_CHECKLIST_ITEMS}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Thêm mục
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDraft(initialDraft([], row.parent_slug))}
          title="Bỏ nháp hiện tại, nạp lại mẫu theo nhóm tài sản"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Nạp lại mẫu
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={save.isPending || draftIssues.length > 0}
          onClick={() => save.mutate({ id: row.id, items })}
        >
          {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Lưu nháp
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setShowIssues(true);
            setCompleteOpen(true);
          }}
        >
          <FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> Hoàn tất & gửi kết quả
        </Button>
      </div>

      <CompleteLegalConsultDialog
        row={row}
        items={items}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onCompleted={() => setDraft(null)}
      />
    </div>
  );
}

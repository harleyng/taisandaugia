import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompleteLegalConsult } from "@/hooks/useAdminLegalConsultations";
import { countByStatus, issueMessage, validateChecklist } from "@/lib/legalConsult/checklist";
import type { ChecklistDraftItem, LegalConsultation } from "@/types/legalConsult";

/**
 * Hoàn tất THAY chuyên gia: gửi checklist + nhận định chung. Server gán phiên bản, đặt kết
 * quả cũ thành "Phiên bản cũ" và ghi hoa hồng. KHÔNG đổi trạng thái hồ sơ (BR-CNS-01).
 */
export function CompleteLegalConsultDialog({
  row,
  items,
  open,
  onOpenChange,
  onCompleted,
}: {
  row: LegalConsultation;
  items: ChecklistDraftItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted: () => void;
}) {
  const complete = useCompleteLegalConsult();
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (open) setSummary(row.summary ?? "");
  }, [open, row.summary]);

  const issues = useMemo(() => validateChecklist(items, true), [items]);
  const counts = countByStatus(items);
  const valid = issues.length === 0 && summary.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={(v) => !complete.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hoàn tất tư vấn · {row.code}</DialogTitle>
          <DialogDescription>
            Người bán sẽ thấy checklist và nhận định chung. Kết quả được lưu thành một phiên bản mới, không sửa được sau khi
            gửi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-success/10 p-2 text-success">
              <span className="block text-lg font-bold">{counts.sufficient}</span> Đủ
            </div>
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <span className="block text-lg font-bold">{counts.missing}</span> Thiếu
            </div>
            <div className="rounded-lg bg-warning/15 p-2 text-warning">
              <span className="block text-lg font-bold">{counts.needs_clarification}</span> Cần làm rõ
            </div>
          </div>

          {issues.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {issues.slice(0, 6).map((i, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {issueMessage(i)}
                </li>
              ))}
              {issues.length > 6 && <li>… và {issues.length - 6} lỗi khác</li>}
            </ul>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tvpl-summary">Nhận định chung</Label>
            <Textarea
              id="tvpl-summary"
              rows={4}
              maxLength={4000}
              value={summary}
              placeholder="VD: Hồ sơ cơ bản hợp lệ; cần bổ sung văn bản đồng ý của đồng sở hữu trước khi ký hợp đồng dịch vụ đấu giá."
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={complete.isPending}>
            Quay lại
          </Button>
          <Button
            disabled={!valid || complete.isPending}
            onClick={() =>
              complete.mutate(
                { id: row.id, items, summary: summary.trim() },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    onCompleted();
                  },
                },
              )
            }
          >
            {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi kết quả cho người bán
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCitableClauses } from "@/hooks/useCitableClauses";
import { useResolveCaseEscalation } from "@/hooks/useCaseEscalations";
import { citationBasis } from "@/lib/caseQa/citations";
import { ESCALATION_STATUS_LABELS } from "@/lib/caseQa/labels";
import type { EscalationStatus } from "@/types/case-qa";
import type { CaseEscalation } from "@/types/case-chat";

interface Props {
  escalation: CaseEscalation;
  onClose: () => void;
}

export function ResolveEscalationDialog({ escalation, onClose }: Props) {
  const resolve = useResolveCaseEscalation();
  const { data: clauses = [] } = useCitableClauses(escalation.session_id);
  const [status, setStatus] = useState<EscalationStatus>(escalation.status === "open" ? "dismissed" : "open");
  const [note, setNote] = useState(escalation.resolution_note ?? "");
  const [clauseId, setClauseId] = useState(escalation.resolved_clause_id ?? "");

  const options: EscalationStatus[] = escalation.status === "open" ? ["added_to_case", "dismissed"] : ["open"];
  const valid = status !== "added_to_case" || !!clauseId;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cập nhật câu hỏi chuyển tiếp</DialogTitle>
          <DialogDescription className="line-clamp-2">“{escalation.question}”</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={status} onValueChange={(v) => setStatus(v as EscalationStatus)} className="space-y-2">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm text-foreground">
                <RadioGroupItem value={o} />
                {o === "open" ? "Mở lại" : ESCALATION_STATUS_LABELS[o]}
              </label>
            ))}
          </RadioGroup>

          {status === "added_to_case" && (
            <div className="space-y-1.5">
              <Label>Điều khoản đã bổ sung (phải đã xác nhận)</Label>
              {clauses.length === 0 ? (
                <p className="text-xs text-muted-foreground">Phiên chưa có điều khoản đã xác nhận nào.</p>
              ) : (
                <Select value={clauseId} onValueChange={setClauseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn điều khoản" />
                  </SelectTrigger>
                  <SelectContent>
                    {clauses.map((c) => (
                      <SelectItem key={c.clause_id} value={c.clause_id}>
                        {citationBasis(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="resolve-note">Ghi chú</Label>
            <Textarea id="resolve-note" value={note} rows={3} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resolve.isPending}>
            Huỷ
          </Button>
          <Button
            disabled={!valid || resolve.isPending}
            className="gap-1.5"
            onClick={() =>
              resolve.mutate({ escalation, status, note, clauseId: clauseId || null }, { onSuccess: onClose })
            }
          >
            {resolve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

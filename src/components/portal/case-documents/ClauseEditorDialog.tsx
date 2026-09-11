import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useSaveCaseClause } from "@/hooks/useCaseDocuments";
import { hasPlaceholder } from "@/lib/caseQa/placeholders";
import { cn } from "@/lib/utils";
import type { CaseClause, CaseDocument } from "@/types/case-chat";
import { TopicPicker } from "./TopicPicker";

interface Props {
  doc: CaseDocument;
  clause: CaseClause | null;
  nextSortOrder: number;
  onClose: () => void;
}

const MAX_TOPICS = 6;

export function ClauseEditorDialog({ doc, clause, nextSortOrder, onClose }: Props) {
  const save = useSaveCaseClause();
  const [clauseRef, setClauseRef] = useState(clause?.clause_ref ?? "");
  const [heading, setHeading] = useState(clause?.heading ?? "");
  const [body, setBody] = useState(clause?.body ?? "");
  const [topics, setTopics] = useState<string[]>(clause?.topics ?? []);

  const refOk = clauseRef.trim().length >= 1 && clauseRef.trim().length <= 40;
  const bodyOk = body.trim().length >= 10 && body.trim().length <= 4000;
  const placeholder = hasPlaceholder(body);
  const valid = refOk && bodyOk;

  const submit = (confirm: boolean) =>
    save.mutate(
      {
        doc,
        clause: {
          id: clause?.id,
          clause_ref: clauseRef,
          heading,
          body,
          topics,
          sort_order: clause?.sort_order ?? nextSortOrder,
        },
        confirm,
      },
      { onSuccess: onClose },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{clause ? "Sửa điều khoản" : "Thêm điều khoản"}</DialogTitle>
          <DialogDescription>
            Chép NGUYÊN VĂN từ tài liệu gốc. AI chỉ trích dẫn đúng câu chữ ở đây, không diễn giải thêm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {clause?.status === "confirmed" && (
            <InfoBox variant="amber" className="text-xs">
              Sửa nội dung sẽ đưa điều khoản về nháp — AI ngừng trích dẫn cho tới khi xác nhận lại.
            </InfoBox>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="clause-ref">Số hiệu</Label>
              <Input id="clause-ref" value={clauseRef} maxLength={40} placeholder="Điều 5" onChange={(e) => setClauseRef(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="clause-heading">Tiêu đề</Label>
              <Input
                id="clause-heading"
                value={heading}
                maxLength={200}
                placeholder="Khoản tiền đặt trước"
                onChange={(e) => setHeading(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clause-body">Nội dung</Label>
            <Textarea id="clause-body" value={body} rows={7} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
            <p className={cn("text-xs", placeholder ? "text-amber-700" : "text-muted-foreground")}>
              {placeholder
                ? "Còn chỗ [[CẦN NHẬP]] — điền nội dung thật trước khi xác nhận."
                : `${body.trim().length}/4.000 ký tự · tối thiểu 10`}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Chủ đề người mua hay hỏi (tối đa {MAX_TOPICS})</Label>
            <TopicPicker value={topics} onChange={setTopics} max={MAX_TOPICS} />
            <p className="text-xs text-muted-foreground">Điều khoản không gắn chủ đề sẽ không được dùng để trả lời tự động.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Huỷ
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={!valid || save.isPending}>
            Lưu nháp
          </Button>
          <Button onClick={() => submit(true)} disabled={!valid || placeholder || save.isPending} className="gap-1.5">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu &amp; xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { TopicPicker } from "@/components/portal/case-documents/TopicPicker";
import { useAddClarificationClause, useResolveCaseEscalation } from "@/hooks/useCaseEscalations";
import { hasPlaceholder } from "@/lib/caseQa/placeholders";
import { isCaseTopic } from "@/lib/caseQa/topics";
import type { CaseEscalation } from "@/types/case-chat";

interface Props {
  escalation: CaseEscalation;
  onClose: () => void;
}

/**
 * Bù lỗ hổng tài liệu từ một câu hỏi chuyển tiếp: thêm điều khoản vào tài liệu
 * "Giải đáp bổ sung của tổ chức" — lần sau AI trích dẫn được, và trích dẫn nói
 * đúng nguồn (không giả là quy chế / thông báo).
 */
export function AddClarificationDialog({ escalation, onClose }: Props) {
  const add = useAddClarificationClause();
  const resolve = useResolveCaseEscalation();
  const [clauseRef, setClauseRef] = useState("Giải đáp");
  const [heading, setHeading] = useState(escalation.question.slice(0, 200));
  const [body, setBody] = useState("");
  const [topics, setTopics] = useState<string[]>(escalation.detected_topics.filter(isCaseTopic));
  const [confirm, setConfirm] = useState(true);

  const valid = clauseRef.trim().length >= 1 && body.trim().length >= 10 && !hasPlaceholder(body);
  const busy = add.isPending || resolve.isPending;

  const submit = () =>
    add.mutate(
      { escalation, clauseRef, heading, body, topics, confirm },
      {
        onSuccess: ({ clauseId }) => {
          // Đã xác nhận ⇒ lỗ hổng tài liệu đã bù xong, đóng luôn dòng sổ.
          if (confirm) {
            resolve.mutate({ escalation, status: "added_to_case", note: "Đã thêm giải đáp bổ sung.", clauseId });
          }
          onClose();
        },
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bổ sung vào tài liệu phiên</DialogTitle>
          <DialogDescription>
            {escalation.auction_sessions ? `${escalation.auction_sessions.code} · ${escalation.auction_sessions.title}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <InfoBox variant="muted" className="text-sm">
            <span className="text-muted-foreground">Người mua hỏi: </span>“{escalation.question}”
          </InfoBox>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="clar-ref">Số hiệu</Label>
              <Input id="clar-ref" value={clauseRef} maxLength={40} onChange={(e) => setClauseRef(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="clar-heading">Tiêu đề</Label>
              <Input id="clar-heading" value={heading} maxLength={200} onChange={(e) => setHeading(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clar-body">Nội dung giải đáp chính thức của tổ chức</Label>
            <Textarea id="clar-body" value={body} rows={5} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              AI sẽ trích NGUYÊN VĂN đoạn này, ghi nguồn “Giải đáp bổ sung của tổ chức”. Chỉ viết điều tổ chức chịu trách
              nhiệm.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Chủ đề</Label>
            <TopicPicker value={topics} onChange={setTopics} />
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
            Xác nhận ngay — AI dùng được cho câu hỏi sau và câu hỏi này được đánh dấu đã bổ sung.
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!valid || busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Thêm giải đáp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

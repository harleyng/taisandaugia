import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useCitableClauses } from "@/hooks/useCitableClauses";
import { useSendStaffReply } from "@/hooks/useOrgChat";
import { citationBasis } from "@/lib/caseQa/citations";
import type { ChatThreadMessage } from "@/types/case-chat";

interface Props {
  conversationId: string;
  /** Câu hỏi đang chờ gần nhất — trả lời gắn vào câu này. */
  awaiting: ChatThreadMessage | null;
  sessionId: string | null;
}

const MAX_CLAUSES = 3;

export function StaffReplyComposer({ conversationId, awaiting, sessionId }: Props) {
  const [body, setBody] = useState("");
  const [clauseIds, setClauseIds] = useState<string[]>([]);
  const { data: clauses = [] } = useCitableClauses(sessionId);
  const send = useSendStaffReply();

  const toggle = (id: string) =>
    setClauseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_CLAUSES ? prev : [...prev, id],
    );

  const submit = () =>
    send.mutate(
      { conversationId, body, inReplyTo: awaiting?.id ?? null, clauseIds },
      {
        onSuccess: () => {
          setBody("");
          setClauseIds([]);
        },
      },
    );

  return (
    <div className="space-y-2 border-t border-border p-4">
      {awaiting && (
        <p className="line-clamp-1 text-xs text-muted-foreground">Trả lời câu: “{awaiting.body}”</p>
      )}
      <Textarea
        value={body}
        rows={3}
        maxLength={3500}
        placeholder="Nhập câu trả lời của chuyên viên…"
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={clauses.length === 0}>
              <Paperclip className="h-4 w-4" />
              Đính kèm điều khoản{clauseIds.length ? ` (${clauseIds.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96 p-0">
            <div className="max-h-72 space-y-1 overflow-y-auto p-2">
              {clauses.map((c) => (
                <label key={c.clause_id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted">
                  <Checkbox
                    checked={clauseIds.includes(c.clause_id)}
                    onCheckedChange={() => toggle(c.clause_id)}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5 text-xs">
                    <span className="block font-medium text-foreground">{citationBasis(c)}</span>
                    <span className="line-clamp-2 block text-muted-foreground">{c.body}</span>
                  </span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button size="sm" className="gap-1.5" onClick={submit} disabled={!body.trim() || send.isPending}>
          <Send className="h-4 w-4" />
          Gửi trả lời
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {clauseIds.length
          ? "Server tự nối dòng “Căn cứ” của điều khoản đính kèm vào cuối câu trả lời."
          : "Không đính kèm điều khoản ⇒ gửi dưới nhãn “Chuyên viên trả lời”, không có trích dẫn."}
      </p>
    </div>
  );
}

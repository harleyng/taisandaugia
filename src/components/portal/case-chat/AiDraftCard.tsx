import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitationQuote } from "@/components/case-qa/CitationQuote";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { useDiscardChatDraft, useSendChatDraft } from "@/hooks/useOrgChat";
import { confidenceTier } from "@/lib/caseQa/labels";
import { cn } from "@/lib/utils";
import type { ChatChannel } from "@/types/case-qa";
import type { ChatThreadMessage } from "@/types/case-chat";

const TIER_CLASS = {
  high: "border-primary/30 bg-primary/10 text-primary",
  mid: "border-border bg-muted text-foreground",
  low: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

interface Props {
  draft: ChatThreadMessage;
  channel: ChatChannel;
}

/** Nháp AI chờ duyệt: câu trả lời do SERVER dựng từ trích dẫn đã kiểm, dán Zalo được. */
export function AiDraftCard({ draft, channel }: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const send = useSendChatDraft();
  const discard = useDiscardChatDraft();
  const tier = confidenceTier(draft.confidence);
  const busy = send.isPending || discard.isPending;
  const edited = editing && body.trim() !== draft.body.trim();

  return (
    <div className="ml-auto max-w-[92%] space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Nháp AI · chờ duyệt</p>
          <Badge variant="outline" className={cn("text-[11px]", TIER_CLASS[tier.tone])}>
            {tier.label} · {Math.round((draft.confidence ?? 0) * 100)}%
          </Badge>
        </div>
        <CopyTextButton text={editing ? body : draft.body} label="Sao chép cho Zalo" />
      </div>

      {editing ? (
        <Textarea value={body} rows={8} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
      ) : (
        <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm text-foreground">{draft.body}</p>
      )}

      <div className="space-y-2">
        {draft.citations.map((c) => (
          <CitationQuote key={c.clause_id} citation={c} />
        ))}
      </div>

      {editing && (
        <p className="text-xs text-amber-700">
          Bản đã sửa gửi dưới nhãn “Chuyên viên trả lời”. Giữ nguyên đoạn trích và dòng “Căn cứ” nếu vẫn dựa trên tài liệu
          phiên.
        </p>
      )}
      {channel === "zalo" && (
        <p className="text-[11px] text-muted-foreground">
          Kênh Zalo đang giả lập: “Duyệt &amp; gửi” chỉ ghi nhận đã trả lời — hãy dán nội dung vào Zalo.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => discard.mutate(draft.id)}>
          Bỏ nháp
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            setEditing((v) => !v);
            setBody(draft.body);
          }}
        >
          {editing ? "Huỷ sửa" : "Sửa"}
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={busy || body.trim().length === 0}
          onClick={() => send.mutate({ draftId: draft.id, editedBody: edited ? body : undefined })}
        >
          <Send className="h-4 w-4" />
          {edited ? "Gửi bản đã sửa" : "Duyệt & gửi"}
        </Button>
      </div>
    </div>
  );
}

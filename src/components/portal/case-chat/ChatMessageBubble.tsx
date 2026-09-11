import { formatShortDateTime } from "@/lib/caseQa/formatVn";
import { AUTHOR_KIND_LABELS, QA_STATE_LABELS } from "@/lib/caseQa/labels";
import { cn } from "@/lib/utils";
import type { QaState } from "@/types/case-qa";
import type { ChatThreadMessage } from "@/types/case-chat";

const QA_STATE_CLASS: Record<QaState, string> = {
  pending: "bg-muted text-muted-foreground",
  draft_ready: "bg-muted text-foreground",
  escalated: "bg-amber-50 text-amber-800",
  auto_answered: "bg-primary/10 text-primary",
  staff_answered: "bg-primary/10 text-primary",
};

/** Tin nhắn đã có (câu hỏi, câu trả lời đã gửi, tin chờ tự động). Bản nháp AI dùng AiDraftCard. */
export function ChatMessageBubble({ message }: { message: ChatThreadMessage }) {
  const inbound = message.direction === "inbound";
  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2.5",
          inbound
            ? "bg-muted text-foreground"
            : message.author_kind === "system"
              ? "border border-dashed border-border bg-background text-muted-foreground"
              : "bg-primary/10 text-foreground",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="font-medium">{AUTHOR_KIND_LABELS[message.author_kind]}</span>
          {inbound && message.auction_sessions?.code && <span>· {message.auction_sessions.code}</span>}
          <span>· {formatShortDateTime(message.sent_at ?? message.created_at)}</span>
          {inbound && message.qa_state && (
            <span className={cn("rounded-full px-1.5 py-0.5", QA_STATE_CLASS[message.qa_state])}>
              {QA_STATE_LABELS[message.qa_state]}
            </span>
          )}
        </div>
        <p className="whitespace-pre-line text-sm">{message.body}</p>
      </div>
    </div>
  );
}

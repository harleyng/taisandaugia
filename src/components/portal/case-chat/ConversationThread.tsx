import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatThread, useSetConversationStatus } from "@/hooks/useOrgChat";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import type { ChatThreadMessage } from "@/types/case-chat";
import { AiDraftCard } from "./AiDraftCard";
import { ChannelBadge } from "./ChannelBadge";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { EscalationNotice } from "./EscalationNotice";
import { StaffReplyComposer } from "./StaffReplyComposer";

const isAnswer = (m: ChatThreadMessage) =>
  m.delivery_status === "sent" && (m.author_kind === "ai" || m.author_kind === "staff");

export function ConversationThread({ conversationId }: { conversationId: string }) {
  const { data: thread, isLoading } = useChatThread(conversationId);
  const canReply = useHasOrgPermission("hoi-dap", "update");
  const setStatus = useSetConversationStatus();

  if (isLoading) {
    return (
      <Card className="space-y-3 rounded-2xl p-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </Card>
    );
  }
  if (!thread) {
    return <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">Không tìm thấy hội thoại.</Card>;
  }

  const { conversation, messages } = thread;
  const visible = messages.filter((m) => m.delivery_status !== "discarded");
  const repliesOf = (id: string) => visible.filter((m) => m.in_reply_to === id);
  // Câu hỏi + các trả lời của nó đi thành một khối; trả lời không gắn câu hỏi đứng riêng.
  const blocks = visible.filter((m) => m.direction === "inbound" || !m.in_reply_to);
  const pending = visible.filter(
    (m) => m.direction === "inbound" && m.qa_state !== "auto_answered" && m.qa_state !== "staff_answered" && !repliesOf(m.id).some(isAnswer),
  );
  const awaiting = pending.at(-1) ?? null;
  const lastInbound = [...visible].reverse().find((m) => m.direction === "inbound");
  const session = lastInbound?.auction_sessions;

  return (
    <Card className="flex min-h-[480px] flex-col rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{conversation.contact_name}</p>
            <ChannelBadge channel={conversation.channel} simulated={conversation.is_simulated} />
            {conversation.status === "resolved" && (
              <Badge variant="outline" className="text-[11px]">
                Đã đóng
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {conversation.contact_phone ?? "Không có số điện thoại"}
            {session && ` · ${session.code ?? ""} – ${session.title}`}
          </p>
        </div>
        {canReply && (
          <Button
            variant="outline"
            size="sm"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate({ conversationId, status: conversation.status === "open" ? "resolved" : "open" })
            }
          >
            {conversation.status === "open" ? "Đóng hội thoại" : "Mở lại"}
          </Button>
        )}
      </div>

      <div className="max-h-[60vh] flex-1 space-y-5 overflow-y-auto p-4">
        {blocks.map((m) => {
          if (m.direction === "outbound") return <ChatMessageBubble key={m.id} message={m} />;
          const replies = repliesOf(m.id);
          const drafts = replies.filter((r) => r.delivery_status === "draft");
          const sent = replies.filter((r) => r.delivery_status === "sent");
          const answered = sent.some(isAnswer);
          return (
            <div key={m.id} className="space-y-2">
              <ChatMessageBubble message={m} />
              {sent.map((r) => (
                <ChatMessageBubble key={r.id} message={r} />
              ))}
              {canReply && drafts.map((d) => <AiDraftCard key={d.id} draft={d} channel={conversation.channel} />)}
              {!answered && drafts.length === 0 && (m.qa_state === "escalated" || m.qa_state === "pending") && (
                <EscalationNotice message={m} canRetry={canReply} />
              )}
            </div>
          );
        })}
      </div>

      {canReply && (
        <StaffReplyComposer
          key={conversationId}
          conversationId={conversationId}
          awaiting={awaiting}
          sessionId={awaiting?.session_id ?? lastInbound?.session_id ?? null}
        />
      )}
    </Card>
  );
}

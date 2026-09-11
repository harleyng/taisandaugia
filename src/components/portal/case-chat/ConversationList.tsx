import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDateTime } from "@/lib/caseQa/formatVn";
import { cn } from "@/lib/utils";
import type { InboxRow } from "@/types/case-chat";
import { ChannelBadge } from "./ChannelBadge";

interface Props {
  rows: InboxRow[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  isLoading: boolean;
  emptyText: string;
}

export function ConversationList({ rows, selectedId, onSelect, isLoading, emptyText }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <Inbox className="h-8 w-8" />
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
      {rows.map((r) => (
        <li key={r.conversation_id}>
          <button
            type="button"
            onClick={() => onSelect(r.conversation_id)}
            className={cn(
              "w-full space-y-1 rounded-xl p-3 text-left transition-colors",
              selectedId === r.conversation_id ? "bg-primary/10" : "hover:bg-muted",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{r.contact_name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatShortDateTime(r.last_message_at)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ChannelBadge channel={r.channel} simulated={r.is_simulated} />
              {r.session_code && <span className="font-mono text-[11px] text-muted-foreground">{r.session_code}</span>}
              {r.status === "resolved" && <span className="text-[11px] text-muted-foreground">· Đã đóng</span>}
            </div>
            {r.last_preview && <p className="line-clamp-2 text-xs text-muted-foreground">{r.last_preview}</p>}
            {(r.awaiting_reply > 0 || r.pending_drafts > 0 || r.open_escalations > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
                {r.awaiting_reply > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">
                    Chờ trả lời {r.awaiting_reply}
                  </span>
                )}
                {r.pending_drafts > 0 && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-foreground">Nháp {r.pending_drafts}</span>
                )}
                {r.open_escalations > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                    Chuyển tiếp {r.open_escalations}
                  </span>
                )}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

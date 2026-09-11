import { CalendarClock, Layers, Users } from "lucide-react";
import { SessionStateBadge } from "@/components/auction-sessions/SessionStateBadge";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { OrgSessionListRow } from "@/types/auction-session";

export function OrgSessionRow({ session, onOpen }: { session: OrgSessionListRow; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-semibold text-foreground">{session.title}</p>
          <p className="font-mono text-xs text-muted-foreground">{session.code}</p>
        </div>
        <SessionStateBadge session={session} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDateTime(session.starts_at)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}
        </span>
        <span>
          <b className="font-semibold text-foreground">{session.item_count}</b> tài sản
        </span>
        {session.max_registrants != null && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Tối đa {session.max_registrants} người
          </span>
        )}
      </div>

      {session.status === "cancelled" && session.cancelled_reason && (
        <p className="mt-2 text-xs text-destructive">Lý do huỷ: {session.cancelled_reason}</p>
      )}
    </button>
  );
}

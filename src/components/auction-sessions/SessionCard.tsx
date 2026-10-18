import { memo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Gavel, Globe, MapPin, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import { cardDateLabel, seatsLeftLabel, sessionListBadge, type ListBadgeTone } from "@/lib/auctionSessions/listBadge";
import type { PublicSessionSummary } from "@/types/auction-session";

interface Props {
  session: PublicSessionSummary;
  /** Hồ sơ đã bán + đang giữ chỗ — có thì nhãn đang nhận hồ sơ kèm "còn N suất". */
  seatsTaken?: number;
}

const LIST_BADGE_TONE: Record<ListBadgeTone, string> = {
  open: "bg-[hsl(var(--tier-std-hover))] text-primary",
  soon: "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]",
  upcoming: "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-fg))]",
  live: "bg-destructive text-destructive-foreground",
  done: "bg-background text-success",
  cancelled: "bg-destructive text-destructive-foreground",
};

/** Thẻ một PHIÊN (khác AuctionCard là thẻ một TÀI SẢN) — design 979d4c55 "San - Phien Dau Gia". */
export const SessionCard = memo(function SessionCard({ session, seatsTaken }: Props) {
  const lots = session.auction_session_items ?? [];
  const cover = lots.find((l) => l.image_url)?.image_url ?? null;
  const priced = lots.filter((l) => l.starting_price != null);
  const totalStart = priced.reduce((sum, l) => sum + (l.starting_price ?? 0), 0);
  const badge = sessionListBadge(session);
  const seats = badge.tone === "open" ? seatsLeftLabel(session.max_registrants, seatsTaken) : null;
  const ended = badge.tone === "done";
  const online = session.auction_format === "truc_tuyen";

  return (
    <Link
      to={`/sessions/${session.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-card text-foreground shadow-card transition-shadow hover:shadow-lg",
        session.status === "cancelled" && "opacity-[.85]",
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={session.title}
            loading="lazy"
            className={cn("h-full w-full object-cover", session.status === "cancelled" && "grayscale")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Gavel className="h-10 w-10" />
          </div>
        )}
        <span
          className={cn(
            "absolute left-3 top-3 inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold shadow-sm",
            LIST_BADGE_TONE[badge.tone],
          )}
        >
          {badge.label}
          {seats && ` · ${seats}`}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3.5">
        <h3 className="line-clamp-2 min-h-[42px] text-[15px] font-semibold leading-snug">{session.title}</h3>
        <ul className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(110px,max-content))] gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
          <li className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="h-[15px] w-[15px] shrink-0 opacity-80" strokeWidth={1.8} />
            <span className="whitespace-nowrap">
              {ended ? "Đã đấu" : session.status === "cancelled" ? "Dự kiến" : "Đấu giá"}{" "}
              <b className="font-semibold text-foreground">{cardDateLabel(session.starts_at)}</b>
            </span>
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            {online ? (
              <Globe className="h-[15px] w-[15px] shrink-0 opacity-80" strokeWidth={1.8} />
            ) : (
              <MapPin className="h-[15px] w-[15px] shrink-0 opacity-80" strokeWidth={1.8} />
            )}
            <span className="whitespace-nowrap">{online ? "Trực tuyến" : (session.province ?? "Trực tiếp")}</span>
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            <Tag className="h-[15px] w-[15px] shrink-0 opacity-80" strokeWidth={1.8} />
            <span className="whitespace-nowrap">
              {priced.length > 0 && (
                <>
                  <b className="text-[15px] font-semibold text-foreground">{formatMoneyShort(totalStart)}</b> ·{" "}
                </>
              )}
              {lots.length} tài sản
            </span>
          </li>
        </ul>
      </div>
    </Link>
  );
});

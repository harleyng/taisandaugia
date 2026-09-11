import { memo } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarClock, Gavel, Layers, MapPin, Users } from "lucide-react";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatVnd } from "@/lib/advertising/slug";
import type { PublicSessionSummary } from "@/types/auction-session";
import { SessionStateBadge } from "./SessionStateBadge";

interface Props {
  session: PublicSessionSummary;
  /** Ẩn tên tổ chức — dùng trong tab phiên của chính trang tổ chức. */
  hideOrg?: boolean;
}

/** Card một PHIÊN (khác AuctionCard là card một TÀI SẢN). */
export const SessionCard = memo(function SessionCard({ session, hideOrg }: Props) {
  const lots = session.auction_session_items ?? [];
  const cover = lots.find((l) => l.image_url)?.image_url ?? null;
  const priced = lots.filter((l) => l.starting_price != null);
  const totalStart = priced.reduce((sum, l) => sum + (l.starting_price ?? 0), 0);

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] bg-muted">
        {cover ? (
          <img src={cover} alt={session.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Gavel className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <SessionStateBadge session={session} />
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground">
          {lots.length} tài sản
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-mono text-xs text-muted-foreground">{session.code}</p>
        <h3 className="line-clamp-2 font-semibold text-foreground group-hover:text-primary">{session.title}</h3>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 shrink-0" />
            {formatDateTime(session.starts_at)}
          </p>
          <p className="flex flex-wrap items-center gap-1.5">
            <Layers className="h-4 w-4 shrink-0" />
            {AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}
            {session.province && (
              <>
                <span aria-hidden>·</span>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {session.province}
              </>
            )}
          </p>
          {session.max_registrants != null && (
            <p className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" />
              Tối đa {session.max_registrants} người đăng ký
            </p>
          )}
          {!hideOrg && session.auction_organizations && (
            <p className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{session.auction_organizations.name}</span>
            </p>
          )}
        </div>

        {priced.length > 0 && (
          <div className="mt-auto border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Tổng giá khởi điểm
              {priced.length < lots.length && ` (${priced.length}/${lots.length} tài sản)`}
            </p>
            <p className="text-lg font-bold text-primary">{formatVnd(totalStart)}</p>
          </div>
        )}
      </div>
    </Link>
  );
});

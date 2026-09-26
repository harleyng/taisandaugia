import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionStatusBadge } from "@/components/shared/SessionStatusBadge";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";
import { formatMoneyShort } from "@/utils/money";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { format, parseISO, isValid } from "date-fns";
import type { AuctionSessionStatus } from "@/components/AuctionCard";

interface UpcomingAuctionsBlockProps {
  listings: ListingRow[];
  loading: boolean;
}

function formatAuctionTime(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = parseISO(raw);
    if (isValid(d)) return format(d, "HH:mm, dd/MM/yyyy");
  } catch {
    // fallback: try treating as date only
  }
  // raw might be "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return format(parseISO(raw), "dd/MM/yyyy");
  }
  return raw;
}

export function UpcomingAuctionsBlock({ listings, loading }: UpcomingAuctionsBlockProps) {
  const navigate = useNavigate();

  const nowIso = new Date().toISOString();

  const upcoming = listings
    .filter((r) => r.auctionTime && r.auctionTime >= nowIso)
    .sort((a, b) => (a.auctionTime ?? "").localeCompare(b.auctionTime ?? ""))
    .slice(0, 5);

  return (
    <SectionCard title="Cuộc đấu giá sắp tới" icon={CalendarClock} viewAllHref="/chu-tai-san/tai-san">
      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="Không có cuộc đấu giá sắp tới" />
      ) : (
        <div className="space-y-2">
          {upcoming.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/listings/${item.id}`)}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <CalendarClock className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {formatAuctionTime(item.auctionTime)} · {formatMoneyShort(item.price)}
                </p>
              </div>

              {/* Status */}
              {(item.sessionStatus === "registration_open" ||
                item.sessionStatus === "upcoming" ||
                item.sessionStatus === "ongoing" ||
                item.sessionStatus === "ended") && (
                <SessionStatusBadge
                  status={item.sessionStatus as AuctionSessionStatus}
                  className="text-[10px] px-1.5 py-0.5 shrink-0"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

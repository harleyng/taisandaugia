import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SessionStatusBadge } from "@/components/shared/SessionStatusBadge";
import type { AuctionSessionStatus } from "@/components/AuctionCard";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";
import { calendarDayLabel, sessionTimeOf, type CalendarDay } from "@/lib/ownerOverview";
import { formatMoneyShort } from "@/utils/money";

const BADGE_STATUSES: readonly string[] = ["registration_open", "upcoming", "ongoing", "ended"];

interface AuctionCalendarBlockProps {
  days: CalendarDay<ListingRow>[];
  today: string;
  loading: boolean;
  className?: string;
}

function SessionRow({ item }: { item: ListingRow }) {
  const navigate = useNavigate();
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/listings/${item.id}`)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {sessionTimeOf(item.auctionTime) ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{item.title}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {item.price > 0 ? `Giá KĐ ${formatMoneyShort(item.price)}` : "Chưa có giá khởi điểm"}
          </p>
        </div>
        {BADGE_STATUSES.includes(item.sessionStatus) && (
          <SessionStatusBadge
            status={item.sessionStatus as AuctionSessionStatus}
            className="shrink-0 px-1.5 py-0.5 text-[10px]"
          />
        )}
      </button>
    </li>
  );
}

/** Lịch đấu giá 7 ngày tới, gom theo ngày — hôm nay nền xanh nhạt, ngày khác nền xám. */
export function AuctionCalendarBlock({ days, today, loading, className }: AuctionCalendarBlockProps) {
  return (
    <SectionCard title="Lịch đấu giá 7 ngày" icon={CalendarClock} viewAllHref="/chu-tai-san/tai-san" className={className}>
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="Không có phiên nào trong 7 ngày tới." />
      ) : (
        <div className="space-y-2">
          {days.map((d) => {
            const label = calendarDayLabel(d.day, today);
            return (
              <section
                key={d.day}
                aria-label={`${label.title} ${label.date}`}
                className={cn("rounded-xl p-2.5", d.isToday ? "bg-primary/5" : "bg-muted/50")}
              >
                <p className="mb-1 flex items-baseline gap-2 px-2 text-xs">
                  <span className={cn("font-semibold", d.isToday ? "text-primary" : "text-foreground")}>
                    {label.title}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{label.date}</span>
                  {d.items.length > 0 && (
                    <span className="ml-auto tabular-nums text-muted-foreground">{d.items.length} phiên</span>
                  )}
                </p>
                {d.items.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Không có phiên hôm nay.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {d.items.map((item) => (
                      <SessionRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

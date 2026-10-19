import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuctionLink } from "@/components/shared/AuctionLink";
import { AdminAuctionSessionsTable } from "@/components/admin/auction-sessions/AdminAuctionSessionsTable";
import { useAdminAuctionSessions } from "@/hooks/useAdminAuctionMonitor";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { AUCTION_LINKS } from "@/lib/auctionPlatform";
import {
  countByTab,
  matchesMonitorSearch,
  monitorStateOf,
  MONITOR_TABS,
  type MonitorTab,
} from "@/lib/auctionMonitor/monitor";
import { cn } from "@/lib/utils";

const DEFAULTS: { tab: MonitorTab; q: string } = { tab: "tat-ca", q: "" };
const ALLOWED = { tab: MONITOR_TABS.map((t) => t.key) } as const;

/**
 * Phiên đấu giá — giám sát CHỈ ĐỌC mọi phiên trên sàn đấu giá trực tuyến (kể cả nháp /
 * đã huỷ mà trang công khai của sàn không hiện). Điều hành thuộc về tổ chức trên sàn.
 */
export default function AdminAuctionSessionsPage() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useAdminAuctionSessions();
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);

  // "Bây giờ" chốt theo lần tải — trạng thái theo giờ đổi cùng nhịp làm mới danh sách.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [dataUpdatedAt]);
  const counts = useMemo(() => countByTab(rows, now), [rows, now]);
  const visible = useMemo(
    () =>
      rows.filter((r) => (f.tab === "tat-ca" || monitorStateOf(r, now) === f.tab) && matchesMonitorSearch(r, f.q)),
    [rows, now, f.tab, f.q],
  );

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Phiên đấu giá</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Giám sát phiên trên sàn đấu giá trực tuyến (chỉ xem) — tổ chức đấu giá điều hành phiên trên sàn
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Làm mới
          </Button>
          <AuctionLink
            to={AUCTION_LINKS.sessions}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            Mở sàn đấu giá
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </AuctionLink>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={f.q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Tìm theo mã, tên phiên, tổ chức…"
            aria-label="Tìm phiên đấu giá"
            className="h-9 w-72 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trạng thái phiên">
          {MONITOR_TABS.map((t) => {
            const active = f.tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter("tab", t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold",
                    active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">Không tải được danh sách phiên đấu giá.</div>
        ) : (
          <AdminAuctionSessionsTable rows={visible} now={now} onOpen={(r) => navigate(`/admin/phien-dau-gia/${r.id}`)} />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Tự làm mới mỗi 30 giây. Hiển thị tối đa 500 phiên gần nhất theo giờ đấu.
      </p>
    </div>
  );
}

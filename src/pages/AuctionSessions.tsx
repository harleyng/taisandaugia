import { useMemo, useState } from "react";
import { Building2, Gavel, Layers, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionCard } from "@/components/auction-sessions/SessionCard";
import { SessionFilterBar } from "@/components/auction-sessions/SessionFilterBar";
import { EMPTY_SESSION_FILTERS, hasActiveSessionFilters, type SessionFilters } from "@/lib/auctionSessions/filters";
import { usePublicAuctionSessions } from "@/hooks/usePublicAuctionSessions";
import { sessionPhaseOf } from "@/lib/auctionSessions/phase";

/** /sessions — lịch phiên đấu giá do các tổ chức công bố trên toàn sàn. */
export default function AuctionSessions() {
  const [includeEnded, setIncludeEnded] = useState(false);
  const [filters, setFilters] = useState<SessionFilters>(EMPTY_SESSION_FILTERS);
  const { data: sessions = [], isLoading, error, refetch } = usePublicAuctionSessions(includeEnded);

  const provinces = useMemo(
    () =>
      [...new Set(sessions.map((s) => s.province).filter((p): p is string => !!p))].sort((a, b) =>
        a.localeCompare(b, "vi"),
      ),
    [sessions],
  );

  const visible = useMemo(() => {
    const now = new Date();
    const q = filters.q.trim().toLowerCase();
    const rows = sessions
      .map((s) => ({ s, phase: sessionPhaseOf(s, now) }))
      .filter(({ s, phase }) => {
        if (q && ![s.title, s.code, s.auction_organizations?.name].some((v) => v?.toLowerCase().includes(q))) {
          return false;
        }
        if (filters.province !== "all" && s.province !== filters.province) return false;
        if (filters.format !== "all" && s.auction_format !== filters.format) return false;
        if (filters.phase !== "all" && phase !== filters.phase) return false;
        return true;
      });
    // Chưa kết thúc: gần nhất trước. Đã kết thúc: dồn xuống cuối, mới nhất trước.
    rows.sort((a, b) => {
      const aEnded = a.phase === "ended";
      if (aEnded !== (b.phase === "ended")) return aEnded ? 1 : -1;
      const diff = Date.parse(a.s.starts_at) - Date.parse(b.s.starts_at);
      return aEnded ? -diff : diff;
    });
    return rows.map((r) => r.s);
  }, [sessions, filters]);

  const stats = useMemo(
    () => ({
      sessions: visible.length,
      lots: visible.reduce((n, s) => n + (s.auction_session_items?.length ?? 0), 0),
      orgs: new Set(visible.map((s) => s.auction_org_id).filter(Boolean)).size,
    }),
    [visible],
  );

  const toggleIncludeEnded = (value: boolean) => {
    setIncludeEnded(value);
    if (!value && filters.phase === "ended") setFilters((f) => ({ ...f, phase: "all" }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container flex-1 px-4 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Phiên đấu giá sắp diễn ra</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lịch phiên do các tổ chức đấu giá công bố trên sàn — mỗi phiên gồm một hoặc nhiều tài sản.
          </p>
        </div>

        <SessionFilterBar
          filters={filters}
          onChange={setFilters}
          provinces={provinces}
          includeEnded={includeEnded}
          onIncludeEndedChange={toggleIncludeEnded}
        />

        {!isLoading && !error && (
          <div className="mb-6 grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
            {[
              { icon: Gavel, label: "Phiên", value: stats.sessions },
              { icon: Layers, label: "Tài sản", value: stats.lots },
              { icon: Building2, label: "Tổ chức đấu giá", value: stats.orgs },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="hidden h-5 w-5 text-primary sm:block" />
                <div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[360px] rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="space-y-3 rounded-2xl p-10 text-center">
            <p className="font-semibold text-foreground">Không tải được danh sách phiên</p>
            <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </Button>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="space-y-3 rounded-2xl p-12 text-center">
            <Gavel className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              {sessions.length === 0 ? "Chưa có phiên nào sắp diễn ra" : "Không có phiên nào phù hợp"}
            </p>
            {hasActiveSessionFilters(filters) ? (
              <Button variant="outline" onClick={() => setFilters(EMPTY_SESSION_FILTERS)}>
                Đặt lại bộ lọc
              </Button>
            ) : (
              !includeEnded && (
                <Button variant="outline" onClick={() => toggleIncludeEnded(true)}>
                  Xem cả phiên đã kết thúc
                </Button>
              )
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

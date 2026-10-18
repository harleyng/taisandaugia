import { useMemo, useState } from "react";
import { Gavel, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionCard } from "@/components/auction-sessions/SessionCard";
import { SessionFilterBar } from "@/components/auction-sessions/SessionFilterBar";
import { EMPTY_SESSION_FILTERS, hasActiveSessionFilters, type SessionFilters } from "@/lib/auctionSessions/filters";
import { sessionListBadge } from "@/lib/auctionSessions/listBadge";
import { usePublicAuctionSessions } from "@/hooks/usePublicAuctionSessions";
import { useSessionSeatCounts } from "@/hooks/usePublicSessionPage";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4";

/**
 * /sessions — lịch phiên đấu giá do các tổ chức công bố trên toàn sàn
 * (design 979d4c55 "San - Phien Dau Gia - De xuat"). Gồm cả phiên đã kết thúc,
 * dồn xuống cuối; phiên huỷ không lên danh sách (query chỉ lấy 'published').
 */
export default function AuctionSessions() {
  const [filters, setFilters] = useState<SessionFilters>(EMPTY_SESSION_FILTERS);
  const { data: sessions = [], isLoading, error, refetch } = usePublicAuctionSessions(true);

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
      .map((s) => ({ s, tone: sessionListBadge(s, now).tone }))
      .filter(({ s, tone }) => {
        if (q && ![s.title, s.code, s.auction_organizations?.name].some((v) => v?.toLowerCase().includes(q))) {
          return false;
        }
        if (filters.province !== "all" && s.province !== filters.province) return false;
        if (filters.format !== "all" && s.auction_format !== filters.format) return false;
        if (filters.phase !== "all" && tone !== filters.phase) return false;
        return true;
      });
    // Chưa kết thúc: gần nhất trước. Đã kết thúc: dồn xuống cuối, mới nhất trước.
    rows.sort((a, b) => {
      const aEnded = a.tone === "done";
      if (aEnded !== (b.tone === "done")) return aEnded ? 1 : -1;
      const diff = Date.parse(a.s.starts_at) - Date.parse(b.s.starts_at);
      return aEnded ? -diff : diff;
    });
    return rows.map((r) => r.s);
  }, [sessions, filters]);

  // "còn N suất" chỉ cho phiên đang nhận hồ sơ có trần — một RPC gộp cho cả trang.
  const seatIds = useMemo(
    () =>
      visible
        .filter((s) => s.max_registrants != null && sessionListBadge(s).tone === "open")
        .map((s) => s.id)
        .sort(),
    [visible],
  );
  const { data: seats } = useSessionSeatCounts(seatIds);

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <Header />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-20 pt-6">
        <h1 className="text-[28px] font-bold leading-tight text-foreground">Phiên đấu giá sắp diễn ra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tài sản do tổ chức đấu giá được cấp phép công bố, kèm đủ hồ sơ pháp lý và giá khởi điểm minh bạch. Mua hồ
          sơ, nộp đặt trước và trả giá ngay trên sàn.
        </p>

        <SessionFilterBar filters={filters} onChange={setFilters} provinces={provinces} />

        {isLoading ? (
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px] rounded-2xl bg-card" />
            ))}
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-2xl bg-card p-10 text-center">
            <p className="font-semibold text-foreground">Không tải được danh sách phiên</p>
            <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="space-y-3 rounded-2xl bg-card p-12 text-center">
            <Gavel className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              {sessions.length === 0 ? "Chưa có phiên nào được công bố" : "Không có phiên nào phù hợp"}
            </p>
            {hasActiveSessionFilters(filters) && (
              <Button variant="outline" onClick={() => setFilters(EMPTY_SESSION_FILTERS)}>
                Đặt lại bộ lọc
              </Button>
            )}
          </div>
        ) : (
          <div className={GRID}>
            {visible.map((s) => (
              <SessionCard key={s.id} session={s} seatsTaken={seats?.get(s.id)} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

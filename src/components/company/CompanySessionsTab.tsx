import { useMemo } from "react";
import { Gavel } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionCard } from "@/components/auction-sessions/SessionCard";
import { usePublicOrgSessions } from "@/hooks/usePublicAuctionSessions";
import { sessionPhaseOf } from "@/lib/auctionSessions/phase";
import type { PublicSessionSummary } from "@/types/auction-session";

/** Tab "Phiên đấu giá" của trang tổ chức: sắp / đang diễn ra trước, đã kết thúc sau. */
export function CompanySessionsTab({ auctionOrgId }: { auctionOrgId: string }) {
  const { data: sessions = [], isLoading, error } = usePublicOrgSessions(auctionOrgId);

  const { active, ended } = useMemo(() => {
    const now = new Date();
    const activeRows: PublicSessionSummary[] = [];
    const endedRows: PublicSessionSummary[] = [];
    for (const s of sessions) (sessionPhaseOf(s, now) === "ended" ? endedRows : activeRows).push(s);
    // Server trả mới nhất trước — đúng cho nhóm đã kết thúc; nhóm còn lại phiên gần nhất lên đầu.
    activeRows.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    return { active: activeRows, ended: endedRows };
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[360px] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
        Không tải được danh sách phiên đấu giá.
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="space-y-2 rounded-2xl border-dashed p-12 text-center">
        <Gavel className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Tổ chức chưa công bố phiên đấu giá nào.</p>
      </Card>
    );
  }

  const section = (title: string, rows: PublicSessionSummary[]) =>
    rows.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          {title} ({rows.length})
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((s) => (
            <SessionCard key={s.id} session={s} hideOrg />
          ))}
        </div>
      </section>
    );

  return (
    <div className="space-y-8">
      {section("Sắp & đang diễn ra", active)}
      {section("Đã kết thúc", ended)}
    </div>
  );
}

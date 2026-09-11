import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Building2, ChevronRight, Gavel } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoBox } from "@/components/shared/InfoBox";
import { SessionLotList } from "@/components/auction-sessions/SessionLotList";
import { SessionStateBadge } from "@/components/auction-sessions/SessionStateBadge";
import { SessionTimeline } from "@/components/auction-sessions/SessionTimeline";
import { SessionQaLinkCard } from "@/components/case-qa/SessionQaLinkCard";
import { SessionContractCard } from "@/components/auction-sessions/SessionContractCard";
import { usePublicAuctionSession } from "@/hooks/usePublicAuctionSessions";
import { formatVnd } from "@/lib/advertising/slug";

/** /sessions/:id — chi tiết một phiên đấu giá đã công bố (hoặc đã huỷ). */
export default function AuctionSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, error } = usePublicAuctionSession(id);

  const lots = session?.auction_session_items ?? [];
  const priced = lots.filter((l) => l.starting_price != null);
  const totalStart = priced.reduce((sum, l) => sum + (l.starting_price ?? 0), 0);
  const org = session?.auction_organizations ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container flex-1 px-4 py-6">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/sessions" className="transition-colors hover:text-foreground">
            Phiên đấu giá
          </Link>
          {session && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="max-w-[280px] truncate font-medium text-foreground">{session.title}</span>
            </>
          )}
        </nav>

        {isLoading ? (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
            </div>
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : error || !session ? (
          <div className="py-16 text-center">
            <Gavel className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-bold text-foreground">Không tìm thấy phiên đấu giá</h2>
            <p className="text-sm text-muted-foreground">Phiên có thể chưa được công bố hoặc đã bị gỡ.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/sessions")}>
              Xem các phiên khác
            </Button>
          </div>
        ) : (
          <>
            {session.status === "cancelled" && (
              <InfoBox variant="amber" className="mb-6 flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Phiên đã bị huỷ</p>
                  {session.cancelled_reason && <p className="text-sm">Lý do: {session.cancelled_reason}</p>}
                </div>
              </InfoBox>
            )}

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card className="rounded-2xl p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <SessionStateBadge session={session} />
                    <span className="font-mono text-xs text-muted-foreground">{session.code}</span>
                  </div>
                  <h1 className="mt-3 text-2xl font-bold text-foreground">{session.title}</h1>
                  {session.description && (
                    <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{session.description}</p>
                  )}
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Số tài sản</p>
                      <p className="text-lg font-bold text-foreground">{lots.length}</p>
                    </div>
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">
                        Tổng giá khởi điểm
                        {priced.length > 0 && priced.length < lots.length && ` (${priced.length}/${lots.length})`}
                      </p>
                      <p className="text-lg font-bold text-primary">{priced.length ? formatVnd(totalStart) : "—"}</p>
                    </div>
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs text-muted-foreground">Người đăng ký tối đa</p>
                      <p className="text-lg font-bold text-foreground">{session.max_registrants ?? "—"}</p>
                    </div>
                  </div>
                </Card>

                <section>
                  <h2 className="mb-3 text-lg font-bold text-foreground">Danh sách tài sản ({lots.length})</h2>
                  <SessionLotList lots={lots} />
                </section>
              </div>

              <aside className="order-first space-y-4 lg:sticky lg:top-4 lg:order-none lg:self-start">
                <SessionTimeline session={session} />
                <SessionContractCard session={session} />
                {session.status === "published" && <SessionQaLinkCard sessionId={session.id} />}
                {org && (
                  <Card className="flex items-center gap-3 rounded-2xl p-4">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Tổ chức đấu giá</p>
                      <p className="truncate font-semibold text-foreground">{org.name}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/auction-org/${org.id}`)}>
                      Xem tổ chức
                    </Button>
                  </Card>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

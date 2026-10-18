import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Gavel } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionResultsCard } from "@/components/auction-sessions/SessionResultsCard";
import { SessionActionCard } from "@/components/auction-sessions/detail/SessionActionCard";
import { SessionDocumentsCard } from "@/components/auction-sessions/detail/SessionDocumentsCard";
import { SessionHero } from "@/components/auction-sessions/detail/SessionHero";
import { SessionLotsCard } from "@/components/auction-sessions/detail/SessionLotsCard";
import { SessionOrgCard } from "@/components/auction-sessions/detail/SessionOrgCard";
import { SessionQaCard } from "@/components/auction-sessions/detail/SessionQaCard";
import { SessionRulesCard } from "@/components/auction-sessions/detail/SessionRulesCard";
import { SessionScheduleCard } from "@/components/auction-sessions/detail/SessionScheduleCard";
import { Note } from "@/components/auction-sessions/detail/ui";
import { usePublicAuctionSession } from "@/hooks/usePublicAuctionSessions";
import { usePublicSessionDocuments } from "@/hooks/usePublicSessionPage";
import { useSessionLot3dModels } from "@/hooks/useAsset3dScans";
import { useSessionLotVrTours } from "@/hooks/useVrTourOrders";
import { useSessionLotAuthentications } from "@/hooks/useAuthenticationOrders";

/**
 * /sessions/:id — chi tiết một phiên đã công bố (hoặc đã huỷ), theo design
 * 979d4c55 "San - Phien Dau Gia - De xuat": cột trái thông tin phiên, cột phải
 * dính (sticky) gồm thẻ hành động 5 bước của người mua + tổ chức + hỏi đáp.
 * Dưới 1024px cột phải tách ra: thẻ hành động lên đầu, tổ chức + hỏi đáp xuống cuối.
 */
export default function AuctionSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, error } = usePublicAuctionSession(id);
  const ready = session ? id : null;
  // Chỉ model đã được admin duyệt cùng hồ sơ (RPC tự lọc) — nhãn "3D" + nút xem trên lô.
  const { data: lot3dModels } = useSessionLot3dModels(ready);
  // VR tour đã gắn lô sau khi admin duyệt (BR-VR-02).
  const { data: lotVrTours } = useSessionLotVrTours(ready);
  const { data: lotAuthentications } = useSessionLotAuthentications(ready);
  const { data: documents = [] } = usePublicSessionDocuments(ready);

  const cancelled = session?.status === "cancelled";

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <Header />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-20 pt-6">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Trang chủ
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/sessions" className="hover:text-foreground">
            Phiên đấu giá
          </Link>
          {session && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="max-w-[320px] truncate font-medium text-foreground">{session.title}</span>
            </>
          )}
        </nav>

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <Skeleton className="h-[520px] rounded-2xl bg-card" />
              <Skeleton className="h-36 rounded-2xl bg-card" />
            </div>
            <Skeleton className="h-80 rounded-2xl bg-card" />
          </div>
        ) : error || !session ? (
          <div className="rounded-2xl bg-card py-16 text-center">
            <Gavel className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-bold text-foreground">Không tìm thấy phiên đấu giá</h2>
            <p className="text-sm text-muted-foreground">Phiên có thể chưa được công bố hoặc đã bị gỡ.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/sessions")}>
              Xem các phiên khác
            </Button>
          </div>
        ) : (
          <>
            {cancelled && (
              <div className="mb-6">
                <Note tone="amber">
                  <b>Phiên đã bị huỷ</b>
                  {session.cancelled_reason && (
                    <>
                      <br />
                      Lý do: {session.cancelled_reason}
                    </>
                  )}
                </Note>
              </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-6">
                <SessionHero session={session} />
                <SessionScheduleCard session={session} />
                <SessionResultsCard session={session} />
                <SessionLotsCard
                  lots={session.auction_session_items ?? []}
                  models={lot3dModels}
                  vrTours={lotVrTours}
                  authentications={lotAuthentications}
                />
                <SessionRulesCard session={session} />
                <SessionDocumentsCard documents={documents} />
              </div>

              {/* lg+: một cột dính. Dưới lg: `contents` để thẻ hành động lên đầu, phần còn lại xuống cuối. */}
              <div className="contents lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-32px)] lg:flex-col lg:gap-4 lg:overflow-auto lg:rounded-2xl lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
                <div className="order-first lg:order-none">
                  <SessionActionCard session={session} />
                </div>
                <div className="order-last flex flex-col gap-4 lg:order-none">
                  {session.auction_organizations && <SessionOrgCard org={session.auction_organizations} />}
                  {!cancelled && <SessionQaCard session={session} />}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

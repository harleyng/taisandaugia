import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Gavel } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { usePublicAuctionSession } from "@/hooks/usePublicAuctionSessions";
import { useMyBidderStatus } from "@/hooks/useMyBidderStatus";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { roomGateOf } from "@/lib/bidding/roomAccess";
import { BiddingMethodNotice } from "@/components/bidding-room/BiddingMethodNotice";
import { BiddingRoom } from "@/components/bidding-room/BiddingRoom";
import { EligibilityGate } from "@/components/bidding-room/EligibilityGate";

/**
 * /sessions/:id/dau-gia — phòng đấu giá trực tuyến của một phiên.
 *
 * Trang này CHỈ làm vỏ + cổng; mọi thứ trực tiếp nằm trong <BiddingRoom> để
 * kênh realtime không mở cho người bị chặn (xem chú thích ở đó).
 *
 * KHÔNG bọc <ProtectedRoute>: nó Navigate thẳng sang /auth, trong khi nếp của
 * các trang phiên là mở AuthDialog ngay tại chỗ.
 */
export default function AuctionBiddingRoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { openAuthDialog } = useAuthDialog();

  const { data: session, isLoading, error } = usePublicAuctionSession(id);
  const bidder = useMyBidderStatus(id);

  const gate = roomGateOf({
    sessionLoading: isLoading,
    session: error ? null : session ?? null,
    bidderLoading: bidder.loading,
    eligible: bidder.eligible,
    reason: bidder.reason,
    forfeited: bidder.contract?.deposit_status === "forfeited",
    bidderNo: bidder.bidderNo,
    now: new Date(),
  });

  // Ẩn danh thì mở luôn hộp thoại đăng nhập một lần, ngoài thẻ cổng phía sau.
  const prompted = useRef(false);
  useEffect(() => {
    if (gate.kind === "blocked" && gate.reason === "login_required" && !prompted.current) {
      prompted.current = true;
      openAuthDialog();
    }
  }, [gate, openAuthDialog]);

  const sessionPath = `/sessions/${id}`;

  const notice = (title: string, body: string) => (
    <Card className="mx-auto max-w-xl rounded-2xl p-8 text-center">
      <Gavel className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="mb-2 text-xl font-bold text-foreground">{title}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{body}</p>
      <Button variant="outline" onClick={() => navigate(sessionPath)}>
        Về trang phiên
      </Button>
    </Card>
  );

  const body = () => {
    switch (gate.kind) {
      case "loading":
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        );

      case "not_found":
        return (
          <div className="py-16 text-center">
            <Gavel className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-bold text-foreground">Không tìm thấy phiên đấu giá</h2>
            <p className="text-sm text-muted-foreground">Phiên có thể chưa được công bố hoặc đã bị gỡ.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/sessions")}>
              Xem các phiên khác
            </Button>
          </div>
        );

      case "cancelled":
        return notice("Phiên đấu giá đã huỷ", session?.cancelled_reason || "Phiên này đã bị huỷ nên không còn trả giá được.");

      case "not_online":
        return (
          <div className="mx-auto max-w-xl space-y-4">
            {notice(
              "Phiên này không đấu giá trực tuyến",
              "Phiên được tổ chức trực tiếp tại địa điểm đã công bố. Xem thời gian và địa điểm ở trang phiên.",
            )}
          </div>
        );

      case "method_unsupported":
        return (
          <div className="mx-auto max-w-xl space-y-4">
            {notice("Hình thức trả giá chưa hỗ trợ", "Sàn hiện chỉ đấu giá trực tuyến theo hình thức trả giá lên.")}
            <BiddingMethodNotice />
          </div>
        );

      case "not_started":
        return notice(
          "Phòng đấu giá chưa mở",
          `Phiên bắt đầu lúc ${formatDateTime(gate.startsAt)}. Hãy quay lại đúng giờ để trả giá.`,
        );

      case "blocked":
        return <EligibilityGate sessionId={id!} reason={gate.reason} />;

      case "view_only":
      case "open":
        return session && bidder.contract && bidder.bidderNo != null && userId ? (
          <BiddingRoom
            session={session}
            contract={bidder.contract}
            bidderNo={bidder.bidderNo}
            noBid={gate.kind === "view_only" ? gate.reason : null}
            userId={userId}
          />
        ) : null;
    }
  };

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
              <Link to={sessionPath} className="max-w-[240px] truncate transition-colors hover:text-foreground">
                {session.title}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Phòng đấu giá</span>
            </>
          )}
        </nav>

        {session && (
          <div className="mb-6 space-y-1">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => navigate(sessionPath)}>
              <ArrowLeft className="h-4 w-4" />
              Về trang phiên
            </Button>
            <p className="font-mono text-xs text-muted-foreground">{session.code}</p>
            <h1 className="text-2xl font-bold text-foreground">Phòng đấu giá · {session.title}</h1>
          </div>
        )}

        {body()}
      </main>

      <Footer />
    </div>
  );
}

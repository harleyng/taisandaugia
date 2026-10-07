import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, FileSignature, Gavel } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RegistrationSessionAside } from "@/components/bidder-registration/RegistrationSessionAside";
import { RegistrationWizard } from "@/components/bidder-registration/RegistrationWizard";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicAuctionSession } from "@/hooks/usePublicAuctionSessions";
import { useMySessionContract, useSessionContractSummary } from "@/hooks/useBiddingContracts";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { contractCtaState, type ContractCta } from "@/lib/biddingContracts/ctaState";
import { MY_CONTRACTS_PATH } from "@/lib/biddingContracts/paths";

/** Vì sao không đăng ký được lúc này (mọi trạng thái trừ "available"). */
function blockedCopy(cta: ContractCta): { text: string; mine?: boolean } {
  switch (cta.kind) {
    case "paid":
      return { text: "Bạn đã có hồ sơ tham gia phiên này.", mine: true };
    case "pending":
      return { text: "Bạn có hồ sơ đang chờ thanh toán cho phiên này. Tiếp tục thanh toán ở trang phiên." };
    case "not_open_yet":
      return { text: `Phiên mở bán hồ sơ từ ${formatDateTime(cta.opensAt)}.` };
    case "full":
      return { text: "Phiên đã đủ số người đăng ký." };
    case "closed":
      return { text: "Đã hết thời gian bán hồ sơ cho phiên này." };
    case "cancelled_session":
      return { text: "Phiên đấu giá đã bị huỷ." };
    default:
      return { text: "Tổ chức chưa mở bán hồ sơ trực tuyến cho phiên này. Vui lòng liên hệ trực tiếp tổ chức đấu giá." };
  }
}

/** /sessions/:id/dang-ky — đăng ký tham gia đấu giá (mua hồ sơ) 4 bước. Cần đăng nhập. */
export default function BidderRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { data: session, isLoading, error } = usePublicAuctionSession(id);
  const { data: summary, isLoading: summaryLoading } = useSessionContractSummary(session ? id : undefined);
  const { data: contract, isLoading: contractLoading } = useMySessionContract(session ? id : undefined);

  const cta = session ? contractCtaState({ session, contract: contract ?? null, summary: summary ?? null, userId }) : null;

  // Đã vào form thì giữ form: giữ chỗ thành công đổi cta sang "pending" trước khi kịp chuyển sang VNPay.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (cta?.kind === "available") setEntered(true);
  }, [cta?.kind]);
  const showWizard = entered || cta?.kind === "available";

  const loading = isLoading || (!!session && (summaryLoading || contractLoading));
  const sessionPath = `/sessions/${id}`;

  const body = () => {
    if (loading) {
      return (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[480px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      );
    }
    if (error || !session || !cta) {
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
    }
    if (!showWizard) {
      const copy = blockedCopy(cta);
      return (
        <Card className="mx-auto max-w-xl space-y-4 rounded-2xl p-6 text-center">
          <FileSignature className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-foreground">{copy.text}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(sessionPath)}>
              Về trang phiên
            </Button>
            {copy.mine && <Button onClick={() => navigate(MY_CONTRACTS_PATH)}>Xem hồ sơ của tôi</Button>}
          </div>
        </Card>
      );
    }
    return (
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RegistrationWizard session={session} />
        </div>
        <div className="lg:sticky lg:top-24">
          <RegistrationSessionAside session={session} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container flex-1 px-4 py-6">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/sessions" className="transition-colors hover:text-foreground">
            Phiên đấu giá
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={sessionPath} className="max-w-[240px] truncate transition-colors hover:text-foreground">
            {session?.title ?? "Phiên"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Đăng ký tham gia</span>
        </nav>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Đăng ký tham gia đấu giá</h1>
        {body()}
      </main>
      <Footer />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileSignature, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyerPageShell, PageTitle } from "@/components/buyer-contracts/BuyerPageShell";
import { Crumbs } from "@/components/buyer-contracts/ui";
import { RegistrationDone } from "@/components/bidder-registration/RegistrationDone";
import { RegistrationWizard } from "@/components/bidder-registration/RegistrationWizard";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicAuctionSession } from "@/hooks/usePublicAuctionSessions";
import { useMySessionContract, useSessionContractSummary } from "@/hooks/useBiddingContracts";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { contractCtaState, type ContractCta } from "@/lib/biddingContracts/ctaState";
import { myContractPath } from "@/lib/biddingContracts/paths";

/** Vì sao không mua hồ sơ được lúc này (mọi trạng thái trừ "available" / "pending"). */
function blockedCopy(cta: ContractCta): { text: string; mine?: boolean } {
  switch (cta.kind) {
    case "paid":
      return { text: "Bạn đã có hồ sơ tham gia phiên này.", mine: true };
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

/**
 * /sessions/:id/dang-ky — mua hồ sơ tham gia (design "San - Ho So Tham Gia").
 * `?ho-so=<id>` = VNPay vừa quay về ⇒ màn "Đã mua hồ sơ tham gia". Cần đăng nhập.
 */
export default function BidderRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { data: session, isLoading, error } = usePublicAuctionSession(id);
  const { data: summary, isLoading: summaryLoading } = useSessionContractSummary(session ? id : undefined);
  const { data: contract, isLoading: contractLoading } = useMySessionContract(session ? id : undefined);

  const cta = session ? contractCtaState({ session, contract: contract ?? null, summary: summary ?? null, userId }) : null;

  // Đã vào form thì giữ form: giữ suất thành công đổi cta sang "pending" ngay trong lượt.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (cta?.kind === "available" || cta?.kind === "pending") setEntered(true);
  }, [cta?.kind]);

  const loading = isLoading || (!!session && (summaryLoading || contractLoading));
  const justPaid = !!contract && contract.status === "paid" && params.get("ho-so") === contract.id;
  const showWizard = !justPaid && (entered || cta?.kind === "available" || cta?.kind === "pending");

  const crumbs = [
    { label: "Phiên đấu giá", to: "/sessions" },
    { label: session?.code ?? session?.title ?? "Phiên", to: `/sessions/${id}` },
    { label: "Mua hồ sơ" },
  ];

  const body = () => {
    if (loading) {
      return (
        <>
          <Skeleton className="mb-6 h-12 rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-[480px] rounded-2xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </>
      );
    }
    if (error || !session || !cta) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card py-16 text-center">
          <Gavel className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">Không tìm thấy phiên đấu giá</h2>
          <p className="text-sm text-muted-foreground">Phiên có thể chưa được công bố hoặc đã bị gỡ.</p>
          <Button variant="secondary" onClick={() => navigate("/sessions")}>
            Xem các phiên khác
          </Button>
        </div>
      );
    }
    if (justPaid) return <RegistrationDone contract={contract!} session={session} />;
    if (!showWizard) {
      const copy = blockedCopy(cta);
      return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center">
          <FileSignature className="h-10 w-10 text-muted-foreground" />
          <p className="text-foreground">{copy.text}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/sessions/${id}`)}>
              Về trang phiên
            </Button>
            {copy.mine && contract && <Button onClick={() => navigate(myContractPath(contract.code))}>Xem hồ sơ của tôi</Button>}
          </div>
        </div>
      );
    }
    return (
      <RegistrationWizard
        session={session}
        summary={summary ?? null}
        pending={contract?.status === "pending_payment" ? contract : null}
      />
    );
  };

  return (
    <BuyerPageShell>
      <Crumbs items={crumbs} />
      {!justPaid && <PageTitle title="Mua hồ sơ tham gia" sub={session?.title} />}
      {body()}
    </BuyerPageShell>
  );
}

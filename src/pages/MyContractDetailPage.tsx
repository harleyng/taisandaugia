import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyerPageShell, TwoColumn } from "@/components/buyer-contracts/BuyerPageShell";
import { OrgContactCard } from "@/components/buyer-contracts/OrgContactCard";
import { Crumbs, DocLine } from "@/components/buyer-contracts/ui";
import { ContractHero } from "@/components/buyer-contracts/detail/ContractHero";
import { ContractNextCard } from "@/components/buyer-contracts/detail/ContractNextCard";
import {
  DepositSection,
  DocumentsSection,
  HistorySection,
  RegistrantSection,
} from "@/components/buyer-contracts/detail/ContractSections";
import { useMyContractByCode } from "@/hooks/useBuyerContracts";
import { useMyWonLots } from "@/hooks/useBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { MY_CONTRACTS_PATH } from "@/lib/biddingContracts/paths";

/** /ho-so-cua-toi/:code — chi tiết một hồ sơ tham gia của người mua. */
export default function MyContractDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: c, isLoading } = useMyContractByCode(code);
  const { data: wonLots = [] } = useMyWonLots(c?.status === "paid" ? [c.id] : []);
  const now = new Date();

  if (isLoading) {
    return (
      <BuyerPageShell>
        <Skeleton className="mb-6 h-44 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </BuyerPageShell>
    );
  }

  if (!c) {
    return (
      <BuyerPageShell>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center">
          <FileSignature className="h-10 w-10 text-muted-foreground" />
          <p className="text-foreground">Không tìm thấy hồ sơ {code}.</p>
          <Button variant="secondary" onClick={() => navigate(MY_CONTRACTS_PATH)}>
            Về Hồ sơ đấu giá
          </Button>
        </div>
      </BuyerPageShell>
    );
  }

  const s = c.auction_sessions;
  const org = s?.auction_organizations;
  const paid = c.status !== "pending_payment";

  return (
    <BuyerPageShell>
      <Crumbs items={[{ label: "Hồ sơ đấu giá", to: MY_CONTRACTS_PATH }, { label: c.code }]} />
      <ContractHero contract={c} wonCount={wonLots.length} now={now} />
      <TwoColumn
        main={
          <>
            <RegistrantSection contract={c} />
            <DocumentsSection contract={c} />
            {paid && <DepositSection contract={c} />}
            <HistorySection contract={c} />
          </>
        }
        aside={
          <>
            <ContractNextCard contract={c} wonLots={wonLots} now={now} openResubmit={params.get("bo-sung") === "1"} />
            {c.paid_at && (
              <section className="rounded-2xl bg-card p-4">
                <DocLine
                  ext="VNPay"
                  title="Phí hồ sơ đã thanh toán"
                  sub={`${formatVnd(c.fee_amount)} · ${formatDateTime(c.paid_at)}${c.payment_txn_ref ? ` · mã GD ${c.payment_txn_ref}` : ""}`}
                />
              </section>
            )}
            {s && <OrgContactCard name={org?.name} phone={org?.phone} address={org?.address} logoUrl={org?.logo_url} sessionId={s.id} />}
          </>
        }
      />
    </BuyerPageShell>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { useOrgBiddingContracts } from "@/hooks/useOrgBiddingContracts";
import { expectedDeposit, nextBidderNo } from "@/lib/biddingContracts/filters";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { ContractWithSession } from "@/types/bidding-contract";
import { AssignBidderNoDialog } from "./AssignBidderNoDialog";
import { BiddingContractsTable } from "./BiddingContractsTable";
import { ContractDepositDialog } from "./ContractDepositDialog";

interface Props {
  session: AuctionSessionWithItems;
  canUpdate: boolean;
}

/** Hồ sơ tham gia của MỘT phiên, trong /portal/phien-dau-gia/:id. */
export function SessionContractsCard({ session, canUpdate }: Props) {
  const navigate = useNavigate();
  const { data = [], isLoading } = useOrgBiddingContracts();
  const rows = useMemo(() => data.filter((r) => r.session_id === session.id), [data, session.id]);
  const [depositFor, setDepositFor] = useState<ContractWithSession | null>(null);
  const [bidderFor, setBidderFor] = useState<ContractWithSession | null>(null);

  const count = session.max_registrants != null ? `${rows.length}/${session.max_registrants}` : String(rows.length);

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Hồ sơ tham gia ({count})</h2>
          <p className="text-xs text-muted-foreground">
            Người mua đã thanh toán tiền hồ sơ qua sàn. Xác nhận tiền đặt trước rồi cấp số báo danh.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate(`/portal/ho-so-tham-gia?session=${session.id}`)}
        >
          Xem tất cả
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {session.status === "cancelled" && (
        <InfoBox variant="amber" className="text-sm">
          Phiên đã huỷ — chỉ ghi nhận hoàn trả tiền đặt trước cho người đã nộp.
        </InfoBox>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải hồ sơ…
        </div>
      ) : (
        <BiddingContractsTable
          rows={rows}
          canUpdate={canUpdate}
          onDeposit={setDepositFor}
          onBidderNo={setBidderFor}
          emptyText={
            session.dossier_fee
              ? "Chưa có người mua hồ sơ phiên này."
              : "Phiên chưa đặt giá bán hồ sơ nên người mua chưa mua được qua sàn."
          }
        />
      )}

      {canUpdate && (
        <>
          <ContractDepositDialog
            contract={depositFor}
            expected={expectedDeposit(session.auction_session_items)}
            onOpenChange={(open) => !open && setDepositFor(null)}
          />
          <AssignBidderNoDialog
            contract={bidderFor}
            suggested={nextBidderNo(rows)}
            onOpenChange={(open) => !open && setBidderFor(null)}
          />
        </>
      )}
    </Card>
  );
}

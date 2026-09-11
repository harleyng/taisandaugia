import { useNavigate } from "react-router-dom";
import { FileSignature, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { VneidVerifiedBadge } from "@/components/vneid/VneidButton";
import { useCancelBiddingContract, useMyBiddingContracts, useStartBiddingContract } from "@/hooks/useBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { identityDefaults, identityToRpcArgs } from "@/lib/biddingContracts/identityForm";
import { contractCheckoutPath, formatBidderNo } from "@/lib/biddingContracts/paths";
import { CONTRACT_STATUS_LABELS, type ContractWithSession } from "@/types/bidding-contract";

/** /profile?tab=auction-contracts — hồ sơ tham gia đấu giá của tôi. */
export const BiddingContractsTab = () => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useMyBiddingContracts();
  const start = useStartBiddingContract();
  const cancel = useCancelBiddingContract();
  const contracts = data.filter((c) => c.status !== "cancelled");
  const busy = start.isPending || cancel.isPending;

  const continuePayment = (c: ContractWithSession) =>
    start.mutate(identityToRpcArgs(c.session_id, { ...identityDefaults({ last: c }), consent: true }), {
      onSuccess: (r) => navigate(contractCheckoutPath(r.contract_id, c.session_id)),
    });

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-lg font-bold text-foreground">Hồ sơ đấu giá</h2>
        <p className="text-sm text-muted-foreground">
          Hồ sơ tham gia các phiên đấu giá bạn đã mua. Số báo danh được cấp sau khi tổ chức xác nhận tiền đặt trước.
        </p>
      </Card>

      {isLoading ? (
        <Card className="flex items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      ) : contracts.length === 0 ? (
        <Card className="space-y-3 p-10 text-center">
          <FileSignature className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Bạn chưa mua hồ sơ tham gia phiên đấu giá nào.</p>
          <Button variant="outline" onClick={() => navigate("/sessions")}>
            Xem các phiên đấu giá
          </Button>
        </Card>
      ) : (
        contracts.map((c) => {
          const s = c.auction_sessions;
          return (
            <Card key={c.id} className="space-y-3 rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{c.code}</span>
                    <Badge variant={c.status === "paid" ? "default" : "outline"}>{CONTRACT_STATUS_LABELS[c.status]}</Badge>
                    {s?.status === "cancelled" && <Badge variant="destructive">Phiên đã huỷ</Badge>}
                    {c.identity_source === "vneid" && <VneidVerifiedBadge />}
                  </div>
                  {s && (
                    <button
                      type="button"
                      className="mt-1 text-left font-medium text-foreground hover:text-primary"
                      onClick={() => navigate(`/sessions/${s.id}`)}
                    >
                      {s.title}
                    </button>
                  )}
                  {s && <p className="text-xs text-muted-foreground">Đấu giá: {formatDateTime(s.starts_at)}</p>}
                </div>
                <span className="text-lg font-bold text-primary">{formatVnd(c.fee_amount)}</span>
              </div>

              {c.status === "paid" ? (
                <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Số báo danh</p>
                    <p className="font-semibold text-foreground">{formatBidderNo(c.bidder_no) ?? "Chưa cấp"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tiền đặt trước</p>
                    <DepositStatusBadge status={c.deposit_status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Thanh toán lúc</p>
                    <p className="text-foreground">{formatDateTime(c.paid_at)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => continuePayment(c)} disabled={busy}>
                    Tiếp tục thanh toán
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancel.mutate(c.id)} disabled={busy}>
                    Huỷ hồ sơ
                  </Button>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
};

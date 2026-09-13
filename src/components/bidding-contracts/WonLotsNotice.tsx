import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/shared/InfoBox";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { useMySaleContracts } from "@/hooks/useSaleContracts";
import { saleContractPath } from "@/lib/saleContracts/files";
import { saleStageOf } from "@/lib/saleContracts/stage";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { LOT_PAYMENT_STATUS_LABELS } from "@/types/auction-bidding";
import type { MyWonLot } from "@/hooks/useBiddingContracts";

/**
 * Thông báo trúng đấu giá trên hồ sơ của người mua, kèm hạn thanh toán.
 *
 * Khi tổ chức đã lập hợp đồng mua bán cho lô, đây là LỐI VÀO của người trúng:
 * trạng thái thanh toán khi đó do sổ tiền của hợp đồng quyết định, nên hiện
 * giai đoạn hợp đồng thay vì cờ `payment_status` của lô.
 */
export function WonLotsNotice({ lots }: { lots: MyWonLot[] }) {
  const navigate = useNavigate();
  const { data: saleContracts = [] } = useMySaleContracts();

  if (lots.length === 0) return null;

  const byLot = new Map(
    saleContracts.filter((c) => c.status !== "cancelled").map((c) => [c.lot_id, c]),
  );

  return (
    <InfoBox variant="success" className="space-y-3 text-sm">
      {lots.map((l) => {
        const contract = byLot.get(l.lot_id);
        return (
          <div key={l.lot_id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p>
                <strong>Bạn đã trúng đấu giá lô {l.auction_session_items?.lot_no ?? "—"}</strong>
                {l.auction_session_items?.title ? ` · ${l.auction_session_items.title}` : ""}
                {l.winning_amount != null && ` — giá trúng ${formatVnd(l.winning_amount)}`}.
                {l.payment_due_at && ` Hạn thanh toán ${formatDateTime(l.payment_due_at)}.`}
              </p>
              {!contract ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tổ chức đấu giá sẽ gửi hợp đồng mua bán tài sản cho bạn.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {contract ? (
                <>
                  <SaleStageBadge stage={saleStageOf(contract)} />
                  <Button type="button" size="sm" onClick={() => navigate(saleContractPath(contract.id))}>
                    Xem hợp đồng
                  </Button>
                </>
              ) : (
                l.payment_status && (
                  <Badge
                    variant={
                      l.payment_status === "paid"
                        ? "default"
                        : l.payment_status === "defaulted"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {LOT_PAYMENT_STATUS_LABELS[l.payment_status]}
                  </Badge>
                )
              )}
            </div>
          </div>
        );
      })}
    </InfoBox>
  );
}

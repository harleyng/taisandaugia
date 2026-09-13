import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { useLotBids } from "@/hooks/useLotBids";
import type { LotBid } from "@/types/auction-bidding";

/**
 * Diễn biến trả giá của lô — CÔNG KHAI theo số báo danh, không có danh tính.
 *
 * Dựng từ auction_bids (anon đọc được), KHÔNG dùng auction_lot_events: bảng
 * nhật ký chỉ tổ chức mới đọc.
 *
 * Query này không có realtime riêng — kênh trong useLotStates đánh thức nó, nên
 * màn nào dùng component này cũng phải đang mount useLotStates cùng phiên.
 */

interface Props {
  sessionId: string;
  lotId: string;
  myBidderNo: number;
  myContractId: string;
  /** state?.current_bid_id — server chỉ cho rút ĐÚNG lượt này. */
  leadingBidId: string | null;
  canWithdraw: boolean;
  onWithdraw: (bid: LotBid) => void;
}

export function BidHistory({
  sessionId,
  lotId,
  myBidderNo,
  myContractId,
  leadingBidId,
  canWithdraw,
  onWithdraw,
}: Props) {
  const { data: bids, isLoading } = useLotBids(sessionId, lotId);

  return (
    <Card className="rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-bold text-foreground">Diễn biến trả giá</h2>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : !bids?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có lượt trả giá nào. Lượt đầu tiên phải đúng bằng giá khởi điểm.
        </p>
      ) : (
        <ul className="space-y-2">
          {bids.map((bid) => {
            const mine = bid.bidder_no === myBidderNo;
            const withdrawn = bid.withdrawn_at != null;
            // Quyền rút xét theo HỒ SƠ, không theo số báo danh hiển thị.
            const showWithdraw = canWithdraw && !withdrawn && bid.id === leadingBidId && bid.contract_id === myContractId;

            return (
              <li
                key={bid.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3",
                  mine ? "border-primary/30 bg-primary/5" : "border-border",
                  withdrawn && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className={cn("font-semibold tabular-nums text-foreground", withdrawn && "line-through")}>
                    {formatVnd(bid.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Số báo danh {formatBidderNo(bid.bidder_no)}
                    {mine && <span className="ml-1 font-semibold text-primary">(Bạn)</span>}
                    {" · "}
                    {new Date(bid.placed_at).toLocaleTimeString("vi-VN")}
                    {withdrawn && <span className="ml-1 font-medium text-destructive">· Đã rút</span>}
                  </p>
                </div>
                {showWithdraw && (
                  <Button variant="outline" size="sm" onClick={() => onWithdraw(bid)}>
                    Rút lại giá
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { clockText } from "@/lib/bidding/roomView";
import type { LotPhase } from "@/lib/bidding/lotPhase";
import type { BiddingMethod } from "@/lib/bidding/methods";
import type { LotBid } from "@/types/auction-bidding";
import { RoomPill } from "./RoomPill";

/**
 * "Diễn biến trả giá" (design `.feed`) — CÔNG KHAI theo số báo danh.
 *
 * Dựng từ auction_bids (anon đọc được), KHÔNG dùng auction_lot_events: bảng
 * nhật ký chỉ tổ chức mới đọc. Dữ liệu do BiddingRoom tải (useLotBids) vì thẻ
 * thông báo cũng cần biết mình đã từng trả giá ở lô này chưa.
 */

interface Props {
  bids: LotBid[] | undefined;
  loading: boolean;
  phase: LotPhase;
  startingPrice: number | null;
  myBidderNo: number;
  myContractId: string;
  /** state?.current_bid_id — server chỉ cho rút ĐÚNG lượt này. */
  leadingBidId: string | null;
  canWithdraw: boolean;
  onWithdraw: (bid: LotBid) => void;
  method: BiddingMethod;
}

const EMPTY_TEXT: Record<BiddingMethod, (start: string) => string> = {
  ascending: (start) => `Lượt đầu tiên phải đúng bằng giá khởi điểm ${start}.`,
  descending: () => "Giá tự giảm theo nhịp — người đầu tiên chấp nhận giá sẽ trúng.",
  sealed: () => "Phiếu kín được công bố khi hết giờ nhận phiếu.",
};

export function BidFeed({
  bids,
  loading,
  phase,
  startingPrice,
  myBidderNo,
  myContractId,
  leadingBidId,
  canWithdraw,
  onWithdraw,
  method,
}: Props) {
  // Lượt mới đến sau lần tải đầu thì nháy nền một nhịp.
  const seen = useRef<Set<string> | null>(null);
  const fresh = (id: string) => seen.current != null && !seen.current.has(id);
  useEffect(() => {
    if (bids) seen.current = new Set([...(seen.current ?? []), ...bids.map((b) => b.id)]);
  }, [bids]);

  return (
    <aside className="flex flex-col rounded-[14px] bg-card shadow-card md:col-start-2 xl:sticky xl:top-[76px] xl:col-start-auto xl:max-h-[calc(100vh-92px)]">
      <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5 text-[13px] font-bold text-foreground">
        Diễn biến trả giá
        {bids && bids.length > 0 && <span className="text-xs font-medium text-muted-foreground">{bids.length} lượt</span>}
      </div>

      {loading ? (
        <div className="space-y-2 px-4 pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !bids?.length ? (
        <p className="px-4 py-7 text-center text-[13px] text-muted-foreground">
          Chưa có lượt trả giá nào.
          <br />
          {EMPTY_TEXT[method](formatMoneyFull(startingPrice))}
        </p>
      ) : (
        <ul className="flex-1 overflow-auto px-2 pb-2">
          {bids.map((bid) => {
            const mine = bid.bidder_no === myBidderNo;
            const lead = bid.id === leadingBidId;
            const withdrawn = bid.withdrawn_at != null;
            // Quyền rút xét theo HỒ SƠ, không theo số báo danh hiển thị.
            const showWithdraw = canWithdraw && lead && !withdrawn && bid.contract_id === myContractId;

            return (
              <li
                key={bid.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 border-b border-border px-2 py-2.5 last:border-0",
                  mine && "rounded-lg border-transparent bg-primary/5",
                  fresh(bid.id) && "animate-room-bid-in",
                )}
              >
                <span className="whitespace-nowrap rounded-md bg-primary/10 px-[7px] py-0.5 font-mono text-xs font-bold text-primary">
                  {formatBidderNo(bid.bidder_no)}
                </span>
                <span className="flex items-center gap-1">
                  {mine && <b className="text-xs text-primary">Bạn</b>}
                  {lead && phase !== "withdrawn" && (
                    <RoomPill tone="live" className="px-[7px] py-0 text-[10.5px]">
                      {phase === "closed" ? "Trúng" : "Dẫn đầu"}
                    </RoomPill>
                  )}
                </span>
                <span
                  className={cn(
                    "text-right font-bold tabular-nums text-foreground",
                    lead && "text-primary",
                    withdrawn && "text-muted-foreground line-through",
                  )}
                >
                  {formatMoneyFull(bid.amount)}
                </span>
                <span className="col-start-2 col-end-4 flex justify-between gap-2 text-[11.5px] text-muted-foreground">
                  <span className="tabular-nums">
                    {clockText(bid.placed_at)}
                    {withdrawn && <span className="text-destructive"> · Đã rút</span>}
                  </span>
                  {showWithdraw && (
                    <button
                      type="button"
                      onClick={() => onWithdraw(bid)}
                      className="py-0.5 text-xs font-semibold text-destructive hover:underline"
                    >
                      Rút lại giá
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

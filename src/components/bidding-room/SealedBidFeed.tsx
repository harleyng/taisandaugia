import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { clockText } from "@/lib/bidding/roomView";
import { groupByRound, roundLabel } from "@/lib/bidding/sealed";
import { useSealedBids } from "@/hooks/useMethodBids";
import type { LotState } from "@/types/auction-bidding";

/**
 * "Diễn biến" của lô bỏ phiếu kín CHƯA đóng. RLS trả phiếu của mình + các vòng đã
 * công bố (khi bằng giá / sang vòng phụ) — vòng đang mở chỉ thấy số phiếu, không
 * thấy giá. Lô đã đóng thì phiếu được chép sang auction_bids ⇒ BidFeed thường hiện.
 */

interface Props {
  sessionId: string;
  lotId: string;
  state: LotState | null;
  myBidderNo: number;
}

export function SealedBidFeed({ sessionId, lotId, state, myBidderNo }: Props) {
  const { data: bids, isLoading } = useSealedBids(sessionId, lotId);
  const round = state?.round_no ?? 1;
  const tied = new Set(state?.status === "tied" ? (state.tied_bidder_nos ?? []) : []);
  const groups = groupByRound(bids ?? []);
  const currentOpen = state?.status === "open" || state?.status === "paused";

  return (
    <aside className="flex flex-col rounded-[14px] bg-card shadow-card md:col-start-2 xl:sticky xl:top-[76px] xl:col-start-auto xl:max-h-[calc(100vh-92px)]">
      <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5 text-[13px] font-bold text-foreground">
        Phiếu giá kín
        <span className="text-xs font-medium text-muted-foreground">{state?.bid_count ?? 0} phiếu</span>
      </div>

      {currentOpen && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 flex-none" />
          {roundLabel(round)}: {state?.round_bid_count ?? 0} phiếu đã nộp — giá công bố khi hết giờ.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 px-4 pb-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="px-4 py-7 text-center text-[13px] text-muted-foreground">Chưa có phiếu nào được công bố.</p>
      ) : (
        <div className="flex-1 overflow-auto px-2 pb-2">
          {groups.map((g) => (
            <div key={g.roundNo}>
              <div className="px-2 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {roundLabel(g.roundNo)}
                {g.roundNo === round && currentOpen && " · phiếu của bạn"}
              </div>
              <ul>
                {g.bids.map((bid) => {
                  const mine = bid.bidder_no === myBidderNo;
                  const isTie = g.roundNo === round && tied.has(bid.bidder_no);
                  return (
                    <li
                      key={bid.id}
                      className={cn(
                        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 border-b border-border px-2 py-2.5 last:border-0",
                        mine && "rounded-lg border-transparent bg-primary/5",
                      )}
                    >
                      <span className="whitespace-nowrap rounded-md bg-primary/10 px-[7px] py-0.5 font-mono text-xs font-bold text-primary">
                        {formatBidderNo(bid.bidder_no)}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        {mine && <b className="text-xs text-primary">Bạn</b>}
                        {isTie && <b className="text-xs text-[hsl(var(--tier-warn-strong))]">Bằng giá</b>}
                        <span className="tabular-nums">{clockText(bid.placed_at)}</span>
                      </span>
                      <span className={cn("text-right font-bold tabular-nums text-foreground", isTie && "text-primary")}>
                        {formatMoneyFull(bid.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { formatCountdown } from "@/lib/bidding/countdown";
import { lotPhaseOf, remainingMs } from "@/lib/bidding/lotPhase";
import { isLivePhase, roomDisplayPrice } from "@/lib/bidding/roomView";
import type { BiddingMethod } from "@/lib/bidding/methods";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import { LotPhasePills } from "./RoomPill";

/** Cột trái "Tài sản trong phiên" — chọn tài sản để xem / trả giá. Mobile: cuộn ngang. */

interface Props {
  lots: AuctionSessionItem[];
  stateByLot: Map<string, LotState>;
  now: Date;
  clockReady: boolean;
  selectedLotId: string;
  nextLotId: string | null;
  onSelect: (lot: AuctionSessionItem) => void;
  myBidderNo: number;
  method: BiddingMethod;
  dropSeconds: number;
}

export function LotRail({
  lots,
  stateByLot,
  now,
  clockReady,
  selectedLotId,
  nextLotId,
  onSelect,
  myBidderNo,
  method,
  dropSeconds,
}: Props) {
  return (
    <aside className="rounded-[14px] bg-card shadow-card">
      <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3.5 text-[13px] font-bold text-foreground">
        Tài sản trong phiên <span className="text-xs font-medium text-muted-foreground">{lots.length}</span>
      </div>
      <div className="flex gap-0.5 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-2">
        {lots.map((lot) => {
          const state = stateByLot.get(lot.id) ?? null;
          const phase = lotPhaseOf(state, now);
          const on = lot.id === selectedLotId;
          const next = lot.id === nextLotId;
          // "Dẫn đầu" chỉ có ở trả giá lên; hai phương thức kia chỉ báo khi đã trúng.
          const leadingMe =
            state?.leading_bidder_no === myBidderNo &&
            state?.current_bid_id != null &&
            (method === "ascending" || phase === "closed");
          const countdown = isLivePhase(phase) && clockReady ? formatCountdown(remainingMs(state, now)) : null;

          return (
            <button
              key={lot.id}
              type="button"
              onClick={() => onSelect(lot)}
              aria-current={on}
              className={cn(
                "relative grid min-w-[220px] grid-cols-[28px_minmax(0,1fr)] gap-2.5 rounded-[10px] border border-border px-2 py-2.5 text-left md:min-w-0 md:border-0",
                on ? "bg-primary/10" : "hover:bg-muted",
              )}
            >
              {on && (
                <span className="absolute -left-2 bottom-2.5 top-2.5 hidden w-[3px] rounded-r-[3px] bg-primary md:block" />
              )}
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground",
                  next && "text-primary shadow-[inset_0_0_0_1.5px_hsl(var(--primary))]",
                  on && "bg-primary text-primary-foreground",
                )}
              >
                {lot.lot_no}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-1 text-[13px] font-semibold text-foreground">{lot.title}</span>
                <span className="mt-[3px] block text-[13px] font-bold tabular-nums text-primary">
                  {formatMoneyFull(roomDisplayPrice(lot, state, method, dropSeconds, now))}
                </span>
                <span className="mt-[5px] flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <LotPhasePills phase={phase} withExtension={false} className="px-2 py-px text-[11px]" />
                  {countdown && <span className="tabular-nums">{countdown.text}</span>}
                  {phase === "pending" && next && <span className="text-[11px] font-bold text-primary">Tiếp theo</span>}
                  {leadingMe && phase !== "withdrawn" && (
                    <span className="text-[11px] font-bold text-success">
                      · {phase === "closed" ? "Bạn trúng" : "Bạn dẫn đầu"}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

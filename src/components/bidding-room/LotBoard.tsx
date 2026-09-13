import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatCountdown } from "@/lib/bidding/countdown";
import { lotPhaseOf, remainingMs } from "@/lib/bidding/lotPhase";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import { LotPhaseBadge } from "./LotPhaseBadge";

/** Danh sách lô của phiên — chọn lô để trả giá. */

interface Props {
  lots: AuctionSessionItem[];
  stateByLot: Map<string, LotState>;
  now: Date;
  clockReady: boolean;
  selectedLotId: string | null;
  onSelect: (lot: AuctionSessionItem) => void;
  myBidderNo: number;
}

export function LotBoard({ lots, stateByLot, now, clockReady, selectedLotId, onSelect, myBidderNo }: Props) {
  return (
    <Card className="rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-bold text-foreground">Các lô trong phiên ({lots.length})</h2>
      <div className="space-y-2">
        {lots.map((lot) => {
          const state = stateByLot.get(lot.id) ?? null;
          const phase = lotPhaseOf(state, now);
          const leading = state?.leading_bidder_no != null && state.leading_bidder_no === myBidderNo;
          // Lô tạm dừng: ends_at chưa được cộng bù nên đếm ngược lúc này là sai.
          const countdown = phase === "paused" || !clockReady ? null : formatCountdown(remainingMs(state, now));
          const selected = lot.id === selectedLotId;

          return (
            <button
              key={lot.id}
              type="button"
              onClick={() => onSelect(lot)}
              aria-current={selected}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Lô {lot.lot_no}</p>
                <LotPhaseBadge phase={phase} extensionCount={state?.extension_count ?? 0} />
              </div>
              <p className="mb-1.5 line-clamp-2 text-sm font-medium text-foreground">{lot.title}</p>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span className="text-sm font-bold text-primary">
                  {formatVnd(state?.current_price ?? lot.starting_price)}
                </span>
                {countdown && <span className="text-xs text-muted-foreground">{countdown.text}</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {state?.current_price == null ? "Giá khởi điểm" : `${state.bid_count} lượt trả giá`}
                </span>
                {leading && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                    Bạn đang dẫn đầu
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

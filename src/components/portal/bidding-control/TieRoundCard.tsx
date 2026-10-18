import { Button } from "@/components/ui/button";
import { BidderNoChip } from "@/components/portal/auction-sessions/DetailCard";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import type { LotAction } from "@/lib/bidding/controlAccess";
import { clockText } from "@/lib/bidding/roomView";
import { groupByRound, roundLabel } from "@/lib/bidding/sealed";
import { useSealedBids } from "@/hooks/useMethodBids";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Sân khấu khi lô bỏ phiếu kín BẰNG GIÁ (status 'tied'): giá bằng nhau, các số báo
 * danh vào vòng phụ và phiếu của vòng vừa công bố. Tổ chức mở vòng phụ (chỉ những
 * người bằng giá, giá ≥ tie_amount) hoặc rút tài sản. Mở được cả sau giờ kết thúc
 * phiên — xem controlAccess.lotActionsFor.
 */

const BTN = "h-8 rounded-lg px-[11px] text-[12.5px] font-semibold";

interface Props {
  sessionId: string;
  lot: AuctionSessionItem;
  state: LotState | null;
  total: number;
  busy: boolean;
  openTieRound: LotAction;
  withdraw: LotAction;
  onOpenTieRound: () => void;
  onWithdraw: () => void;
}

export function TieRoundCard({ sessionId, lot, state, total, busy, openTieRound, withdraw, ...on }: Props) {
  const { data: bids = [] } = useSealedBids(sessionId, lot.id);
  const round = state?.round_no ?? 1;
  const revealed = groupByRound(bids).find((g) => g.roundNo === round);
  const tied = new Set(state?.tied_bidder_nos ?? []);

  return (
    <section className="flex flex-col gap-3.5 overflow-hidden rounded-2xl border-t-[3px] border-warning bg-card px-6 py-[22px] shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Tài sản {lot.lot_no} / {total}
          </span>
          <DotPill tone="warning">Bằng giá · {roundLabel(round)}</DotPill>
        </span>
        <span className="flex gap-1.5">
          <Button
            size="sm"
            className={BTN}
            disabled={busy || !openTieRound.enabled}
            title={openTieRound.disabledReason ?? undefined}
            onClick={on.onOpenTieRound}
          >
            Mở vòng phụ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(BTN, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
            disabled={busy || !withdraw.enabled}
            title={withdraw.disabledReason ?? undefined}
            onClick={on.onWithdraw}
          >
            Rút tài sản
          </Button>
        </span>
      </div>

      <h2 className="-mt-1.5 text-[19px] font-semibold tracking-[-0.01em] text-foreground [text-wrap:pretty]">
        {lot.title}
      </h2>

      <div className="border-y py-[18px]">
        <small className="mb-0.5 block text-[12.5px] text-muted-foreground">Cùng trả giá cao nhất</small>
        <strong className="block text-[34px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums text-foreground">
          {formatVnd(state?.tie_amount ?? null)}
        </strong>
        <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          Vào vòng phụ:
          {[...tied].map((no) => (
            <BidderNoChip key={no} no={no} />
          ))}
        </span>
      </div>

      {revealed && (
        <div className="mb-1">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Phiếu {roundLabel(round).toLowerCase()} đã công bố
          </div>
          <ul className="divide-y rounded-xl border">
            {revealed.bids.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[13.5px]">
                <span className="flex items-center gap-2">
                  <BidderNoChip no={b.bidder_no} />
                  <span className="text-xs tabular-nums text-muted-foreground">{clockText(b.placed_at)}</span>
                </span>
                <b className={cn("tabular-nums", tied.has(b.bidder_no) ? "text-primary" : "text-foreground")}>
                  {formatVnd(b.amount)}
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

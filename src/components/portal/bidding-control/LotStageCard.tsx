import { Button } from "@/components/ui/button";
import { BidderNoChip } from "@/components/portal/auction-sessions/DetailCard";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatMoneyShort } from "@/utils/money";
import { formatCountdown } from "@/lib/bidding/countdown";
import { pausedRemainingMs } from "@/lib/bidding/controlView";
import { remainingMs } from "@/lib/bidding/lotPhase";
import { useLotBids } from "@/hooks/useLotBids";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * "Sân khấu" lô đang đấu (design `.ox-stage`): giá cao nhất, người dẫn, đồng hồ
 * lô, 4 chỉ số và 5 lượt trả giá gần nhất. Lô tạm dừng dùng chung thẻ, đổi viền
 * & đồng hồ sang vàng và nút thành "Tiếp tục lô".
 *
 * Lượt trả giá không có realtime riêng: kênh trong useLotStates (do
 * BiddingControlRoom mount) đánh thức query useLotBids.
 */

const BTN = "h-8 rounded-lg px-[11px] text-[12.5px] font-semibold";
const SHOWN = 5;

interface Props {
  sessionId: string;
  lot: AuctionSessionItem;
  state: LotState | null;
  total: number;
  paused: boolean;
  now: Date;
  clockReady: boolean;
  canOperate: boolean;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onWithdraw: () => void;
}

export function LotStageCard(props: Props) {
  const { sessionId, lot, state, total, paused, now, clockReady, canOperate, busy } = props;
  const { data: bids = [] } = useLotBids(sessionId, lot.id);
  const valid = bids.filter((b) => b.withdrawn_at == null); // seq giảm dần
  const bidders = new Set(valid.map((b) => b.bidder_no)).size;

  const hasBid = !!state?.bid_count && state.current_price != null;
  const high = hasBid ? state!.current_price! : lot.starting_price;
  const up = hasBid && lot.starting_price ? Math.round((state!.current_price! / lot.starting_price - 1) * 100) : null;
  const clock = clockReady ? formatCountdown(paused ? pausedRemainingMs(state) : remainingMs(state, now)) : null;

  return (
    <section
      className={cn(
        "flex flex-col gap-3.5 overflow-hidden rounded-2xl border-t-[3px] bg-card px-6 pt-[22px] shadow-card",
        paused ? "border-warning" : "border-destructive",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Lô {lot.lot_no} / {total}
          </span>
          <DotPill tone={paused ? "warning" : "live"}>{paused ? "Tạm dừng" : "Đang trả giá"}</DotPill>
        </span>
        {canOperate && (
          <span className="flex gap-1.5">
            {paused ? (
              <Button size="sm" className={BTN} disabled={busy} onClick={props.onResume}>
                Tiếp tục lô
              </Button>
            ) : (
              <Button size="sm" variant="outline" className={BTN} disabled={busy} onClick={props.onPause}>
                Tạm dừng
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={cn(BTN, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
              disabled={busy}
              onClick={props.onWithdraw}
            >
              Rút lô
            </Button>
          </span>
        )}
      </div>

      <h2 className="-mt-1.5 text-[19px] font-semibold tracking-[-0.01em] text-foreground [text-wrap:pretty]">
        {lot.title}
      </h2>

      <div className="grid grid-cols-1 items-end gap-5 border-y py-[18px] sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <small className="mb-0.5 block text-[12.5px] text-muted-foreground">Giá cao nhất</small>
          <strong className="block text-[34px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums text-foreground">
            {high != null ? formatVnd(high) : "—"}
          </strong>
          <span className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
            {hasBid ? (
              <>
                Dẫn đầu <BidderNoChip no={state?.leading_bidder_no} />
                {up != null && ` · +${up}% so với khởi điểm`}
              </>
            ) : (
              "Chưa có lượt trả giá — đang ở giá khởi điểm"
            )}
          </span>
        </div>
        <div className="sm:text-right">
          <small className="mb-0.5 block text-[12.5px] text-muted-foreground">
            {paused ? "Đồng hồ dừng ở" : "Còn lại"}
          </small>
          <strong
            className={cn(
              "block text-[30px] font-bold leading-[1.1] tabular-nums",
              paused ? "text-[hsl(var(--tier-warn-strong))]" : "text-destructive",
            )}
          >
            {clock?.text ?? "—"}
          </strong>
        </div>
      </div>

      <dl className="mb-1.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Giá khởi điểm", lot.starting_price != null ? formatMoneyShort(lot.starting_price) : "—"],
          ["Bước giá", lot.bid_step != null ? formatMoneyShort(lot.bid_step) : "—"],
          ["Lượt trả giá", String(state?.bid_count ?? 0)],
          ["Người đang trả", String(bidders)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 text-[14.5px] font-semibold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="-mx-6 mt-1 border-t bg-muted/30 px-6 pb-3.5 pt-3">
        <b className="mb-1 block text-[13px] font-semibold text-foreground">Lịch sử trả giá</b>
        {valid.length === 0 ? (
          <p className="py-2 text-[13px] text-muted-foreground">Chưa có lượt trả giá nào.</p>
        ) : (
          <div>
            {valid.slice(0, SHOWN).map((b, i) => {
              const prev = valid[i + 1]?.amount ?? lot.starting_price ?? null;
              const step = prev != null ? b.amount - prev : null;
              return (
                <div
                  key={b.id}
                  className="grid grid-cols-[72px_auto_minmax(0,1fr)_auto] items-center gap-3 border-t py-[7px] text-[13px] first:border-t-0"
                >
                  <span className="text-[12.5px] tabular-nums text-muted-foreground">
                    {new Date(b.placed_at).toLocaleTimeString("vi-VN")}
                  </span>
                  <BidderNoChip no={b.bidder_no} />
                  <b className={cn("font-semibold tabular-nums", i === 0 ? "text-primary" : "text-foreground")}>
                    {formatVnd(b.amount)}
                  </b>
                  <small className="text-xs tabular-nums text-muted-foreground">
                    {step != null && step > 0 ? `+${formatMoneyShort(step)}` : ""}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

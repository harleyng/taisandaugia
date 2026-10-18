import { Button } from "@/components/ui/button";
import { BidderNoChip } from "@/components/portal/auction-sessions/DetailCard";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatMoneyShort } from "@/utils/money";
import { formatCountdown } from "@/lib/bidding/countdown";
import { pausedRemainingMs } from "@/lib/bidding/controlView";
import { remainingMs } from "@/lib/bidding/lotPhase";
import { descendingPriceAt, nextDropAt } from "@/lib/bidding/descending";
import { secondsText, type BiddingMethod } from "@/lib/bidding/methods";
import { roundLabel, sealedMinBid } from "@/lib/bidding/sealed";
import { useLotBids } from "@/hooks/useLotBids";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * "Sân khấu" lô đang đấu (design `.ox-stage`): giá cao nhất, người dẫn, đồng hồ
 * lô và 4 chỉ số. Lô đang đấu tông xanh dương; lô tạm dừng dùng chung thẻ, đổi
 * viền & đồng hồ sang vàng và nút thành "Tiếp tục lô".
 *
 * Lịch sử trả giá KHÔNG hiện ở đây (bỏ 18/10) — xem Nhật ký điều hành, lọc loại
 * "Trả giá" + tài sản. useLotBids chỉ còn để đếm người đang trả; nó không có
 * realtime riêng: kênh trong useLotStates (do BiddingControlRoom mount) đánh thức.
 *
 * Theo phương thức: đặt giá xuống hiện giá đang chào + lần giảm kế tiếp; bỏ phiếu
 * kín hiện SỐ PHIẾU (giá kín — tổ chức cũng không thấy giá tới khi hết vòng).
 */

const BTN = "h-8 rounded-lg px-[11px] text-[12.5px] font-semibold";

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
  method: BiddingMethod;
  dropSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onWithdraw: () => void;
}

export function LotStageCard(props: Props) {
  const { sessionId, lot, state, total, paused, now, clockReady, canOperate, busy, method, dropSeconds } = props;
  const { data: bids = [] } = useLotBids(sessionId, lot.id);
  const valid = bids.filter((b) => b.withdrawn_at == null); // seq giảm dần
  const bidders = new Set(valid.map((b) => b.bidder_no)).size;

  const hasBid = !!state?.bid_count && state.current_price != null;
  const high = hasBid ? state!.current_price! : lot.starting_price;
  const up = hasBid && lot.starting_price ? Math.round((state!.current_price! / lot.starting_price - 1) * 100) : null;
  const clock = clockReady ? formatCountdown(paused ? pausedRemainingMs(state) : remainingMs(state, now)) : null;
  const block = priceBlock();

  function priceBlock(): { label: string; value: string; sub: string | null } | null {
    if (method === "descending") {
      const price = descendingPriceAt(state, lot, dropSeconds, now);
      const next = clockReady ? nextDropAt(state, lot, dropSeconds, now) : null;
      return {
        label: "Giá đang chào",
        value: price != null ? formatVnd(price) : "—",
        sub: next
          ? `Giảm tiếp sau ${formatCountdown(next.getTime() - now.getTime())?.text ?? "—"} · sàn ${formatMoneyShort(lot.floor_price ?? 0)}`
          : paused
            ? "Giá đứng yên khi tạm dừng"
            : "Đã chạm giá sàn — chờ người chấp nhận",
      };
    }
    if (method === "sealed") {
      return {
        label: `${roundLabel(state?.round_no ?? 1)} · giá kín`,
        value: `${state?.round_bid_count ?? 0} phiếu`,
        sub: `Giá phiếu từ ${formatVnd(sealedMinBid(state, lot))} · công bố khi hết giờ nhận phiếu`,
      };
    }
    return null;
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-3.5 overflow-hidden rounded-2xl border-t-[3px] bg-card px-6 pt-[22px] shadow-card",
        paused ? "border-warning" : "border-[hsl(var(--tier-info))]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Tài sản {lot.lot_no} / {total}
          </span>
          <DotPill tone={paused ? "warning" : "live"}>{paused ? "Tạm dừng" : "Đang trả giá"}</DotPill>
        </span>
        {canOperate && (
          <span className="flex gap-1.5">
            {paused ? (
              <Button size="sm" className={BTN} disabled={busy} onClick={props.onResume}>
                Tiếp tục tài sản
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
              Rút tài sản
            </Button>
          </span>
        )}
      </div>

      <h2 className="-mt-1.5 text-[19px] font-semibold tracking-[-0.01em] text-foreground [text-wrap:pretty]">
        {lot.title}
      </h2>

      <div className="grid grid-cols-1 items-end gap-5 border-y py-[18px] sm:grid-cols-[minmax(0,1fr)_auto]">
        {block ? (
          <div>
            <small className="mb-0.5 block text-[12.5px] text-muted-foreground">{block.label}</small>
            <strong className="block text-[34px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums text-foreground">
              {block.value}
            </strong>
            {block.sub && <span className="mt-2 block text-[13px] text-muted-foreground">{block.sub}</span>}
          </div>
        ) : (
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
        )}
        <div className="sm:text-right">
          <small className="mb-0.5 block text-[12.5px] text-muted-foreground">
            {paused ? "Đồng hồ dừng ở" : "Còn lại"}
          </small>
          <strong
            className={cn(
              "block text-[30px] font-bold leading-[1.1] tabular-nums",
              paused ? "text-[hsl(var(--tier-warn-strong))]" : "text-[hsl(var(--tier-info))]",
            )}
          >
            {clock?.text ?? "—"}
          </strong>
        </div>
      </div>

      <dl className="mb-[22px] grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Giá khởi điểm", lot.starting_price != null ? formatMoneyShort(lot.starting_price) : "—"],
          ["Bước giá", lot.bid_step != null ? formatMoneyShort(lot.bid_step) : "—"],
          ...(method === "descending"
            ? [
                ["Giá sàn", lot.floor_price != null ? formatMoneyShort(lot.floor_price) : "—"],
                ["Nhịp giảm", secondsText(dropSeconds)],
              ]
            : method === "sealed"
              ? [
                  ["Tổng phiếu", String(state?.bid_count ?? 0)],
                  ["Vòng", roundLabel(state?.round_no ?? 1)],
                ]
              : [
                  ["Lượt trả giá", String(state?.bid_count ?? 0)],
                  ["Người đang trả", String(bidders)],
                ]),
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 text-[14.5px] font-semibold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

    </section>
  );
}

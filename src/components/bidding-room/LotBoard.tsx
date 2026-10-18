import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { groupNumber } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { formatCountdown } from "@/lib/bidding/countdown";
import { isLivePhase, clockText, displayPrice, hasLeader, pausedRemainingMs, remainingPercent, roomUrgency } from "@/lib/bidding/roomView";
import { remainingMs, type LotPhase } from "@/lib/bidding/lotPhase";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { BiddingMethod } from "@/lib/bidding/methods";
import { methodBoardPane } from "./BoardPricePanes";

/**
 * Bảng giá nền tối (design `.board`): giá cao nhất + người dẫn đầu bên trái,
 * đồng hồ bên phải. Đồng hồ là giờ MÁY CHỦ; chưa đồng bộ xong thì hiện "—".
 */

interface Props {
  lot: AuctionSessionItem;
  state: LotState | null;
  phase: LotPhase;
  now: Date;
  clockReady: boolean;
  myBidderNo: number;
  activeLotNo: number | null;
  method: BiddingMethod;
  /** Đặt giá xuống: giây giữa hai lần giảm. */
  dropSeconds: number;
}

const BIG = "my-1.5 mb-2 text-[clamp(28px,3.4vw,42px)] font-[750] leading-[1.15] tracking-[-.01em] tabular-nums";
const LBL = "text-xs font-medium text-[hsl(var(--tier-std-card-muted))]";
const SUB = "flex flex-wrap items-center gap-2 text-[12.5px] text-[hsl(var(--tier-std-card-muted))]";

export function LotBoard({ lot, state, phase, now, clockReady, myBidderNo, activeLotNo, method, dropSeconds }: Props) {
  const pane = methodBoardPane({ method, lot, state, phase, now, clockReady, dropSeconds, myBidderNo });
  const price = pane ? pane.price : displayPrice(lot, state);
  const leader = hasLeader(state) ? state!.leading_bidder_no! : null;
  const leaderIsMe = leader === myBidderNo;
  const priceLabel =
    pane?.label ??
    (phase === "closed" && leader != null ? "Giá trúng" : state?.current_price == null ? "Giá khởi điểm" : "Giá cao nhất hiện tại");

  // Nháy số khi giá đổi trên CÙNG một lô (không nháy khi chỉ đổi lô đang xem).
  const prev = useRef<{ lotId: string; price: number | null } | null>(null);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    const p = prev.current;
    prev.current = { lotId: lot.id, price };
    if (p && p.lotId === lot.id && p.price !== price) setFlash((n) => n + 1);
  }, [lot.id, price]);

  return (
    <div className="mx-3 mb-3 mt-3.5 grid overflow-hidden rounded-xl bg-[hsl(var(--sidebar-background))] text-primary-foreground md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="px-[22px] py-5">
        <div className={LBL}>{priceLabel}</div>
        <div key={flash} className={cn(BIG, "origin-left", flash > 0 && "animate-room-flash")}>
          {groupNumber(price)}
          <span className="ml-1 text-[clamp(18px,1.8vw,22px)] font-medium text-[hsl(var(--tier-std-card-muted))]">₫</span>
        </div>
        <div className={SUB}>
          {pane ? (
            pane.sub
          ) : leader != null ? (
            <>
              Dẫn đầu
              <span
                className={cn(
                  "whitespace-nowrap rounded-md px-[7px] py-0.5 font-mono text-xs font-bold",
                  leaderIsMe
                    ? "bg-[hsl(var(--tier-gold))] text-[hsl(var(--tier-gold-fg))]"
                    : "bg-[hsl(var(--sidebar-primary))] text-primary-foreground",
                )}
              >
                {formatBidderNo(leader)}
                {leaderIsMe && " · Bạn"}
              </span>
              · {state?.bid_count ?? 0} lượt trả giá
            </>
          ) : (
            "Chưa có lượt trả giá"
          )}
        </div>
      </div>

      <div className="border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] px-[22px] py-5 max-md:border-t md:border-l">
        <TimeBox lot={lot} state={state} phase={phase} now={now} clockReady={clockReady} activeLotNo={activeLotNo} />
      </div>
    </div>
  );
}

const BAR_FILL = {
  normal: "bg-[hsl(var(--tier-mint))]",
  soon: "bg-[hsl(var(--tier-gold))]",
  urgent: "bg-destructive",
};
const BIG_TONE = { normal: "", soon: "text-[hsl(var(--tier-gold))]", urgent: "text-destructive" };

function TimeBox({
  lot,
  state,
  phase,
  now,
  clockReady,
  activeLotNo,
}: Omit<Props, "myBidderNo" | "method" | "dropSeconds"> & { activeLotNo: number | null }) {
  if (isLivePhase(phase)) {
    const ms = clockReady ? remainingMs(state, now) : null;
    const cd = formatCountdown(ms);
    const urgency = roomUrgency(ms);
    const endsAt = state?.ends_at;
    return (
      <>
        <div className={LBL}>Thời gian còn lại</div>
        <div className={cn(BIG, BIG_TONE[urgency])}>{cd?.text ?? "—"}</div>
        <div className="mb-2 h-1 overflow-hidden rounded bg-[hsl(var(--sidebar-border))]">
          <i
            className={cn("block h-full transition-[width] duration-1000 ease-linear", BAR_FILL[urgency])}
            style={{ width: `${remainingPercent(state, ms)}%` }}
          />
        </div>
        {endsAt && (
          <div className={SUB}>
            Đóng lúc {cd?.showAbsolute ? formatDateTime(endsAt) : clockText(endsAt)}
            {state!.extension_count > 0 && ` · đã gia hạn ${state!.extension_count} lần`}
          </div>
        )}
      </>
    );
  }

  if (phase === "paused") {
    const ms = pausedRemainingMs(state);
    return (
      <>
        <div className={LBL}>Thời gian còn lại</div>
        <div className={BIG}>{formatCountdown(ms)?.text ?? "—"}</div>
        <div className="mb-2 h-1 overflow-hidden rounded bg-[hsl(var(--sidebar-border))]">
          <i className="block h-full bg-[hsl(var(--tier-gold))]" style={{ width: `${remainingPercent(state, ms)}%` }} />
        </div>
        <div className={SUB}>Đồng hồ dừng — giữ nguyên thời gian</div>
      </>
    );
  }

  if (phase === "tied") {
    return (
      <>
        <div className={LBL}>Trạng thái</div>
        <div className={BIG}>Chờ vòng phụ</div>
        <div className={SUB}>Đấu giá viên mở vòng phụ cho những người bằng giá</div>
      </>
    );
  }

  if (phase === "pending") {
    return (
      <>
        <div className={LBL}>Trạng thái</div>
        <div className={BIG}>Chưa mở</div>
        <div className={SUB}>
          {activeLotNo != null && activeLotNo !== lot.lot_no
            ? `Mở sau khi tài sản ${activeLotNo} đóng`
            : "Đấu giá viên mở lần lượt từng tài sản"}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={LBL}>Kết thúc</div>
      <div className={BIG}>{phase === "withdrawn" ? "Đã rút" : "Đã đóng"}</div>
      <div className={SUB}>
        {phase === "withdrawn"
          ? "Tài sản không còn đấu giá trong phiên"
          : hasLeader(state)
            ? `${state!.bid_count} lượt trả giá hợp lệ`
            : "Không có lượt hợp lệ"}
      </div>
    </>
  );
}

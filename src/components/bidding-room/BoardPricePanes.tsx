import type { ReactNode } from "react";
import { formatMoneyFull } from "@/utils/money";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { formatCountdown } from "@/lib/bidding/countdown";
import { descendingPriceAt, nextDropAt } from "@/lib/bidding/descending";
import type { LotPhase } from "@/lib/bidding/lotPhase";
import type { BiddingMethod } from "@/lib/bidding/methods";
import { roundLabel, sealedMinBid } from "@/lib/bidding/sealed";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Nửa trái bảng giá theo phương thức KHÁC trả giá lên, khi lô chưa đóng:
 *   • đặt giá xuống — giá đang chào (đồng hồ máy chủ), lần giảm kế tiếp, giá sàn;
 *   • bỏ phiếu kín  — giá phiếu tối thiểu của vòng + số phiếu đã nộp (giá kín);
 *     bằng giá — giá bằng nhau + các số báo danh vào vòng phụ.
 * `null` = để LotBoard vẽ bảng trả giá lên như cũ (cả khi lô đã đóng: giá trúng).
 */
export interface BoardPane {
  label: string;
  price: number | null;
  sub: ReactNode;
}

interface Input {
  method: BiddingMethod;
  lot: AuctionSessionItem;
  state: LotState | null;
  phase: LotPhase;
  now: Date;
  clockReady: boolean;
  dropSeconds: number;
  myBidderNo: number;
}

export function methodBoardPane({ method, lot, state, phase, now, clockReady, dropSeconds, myBidderNo }: Input): BoardPane | null {
  const live = phase === "open" || phase === "extended" || phase === "paused";

  if (method === "descending" && live) {
    const price = descendingPriceAt(state, lot, dropSeconds, now) ?? lot.starting_price;
    const next = clockReady ? nextDropAt(state, lot, dropSeconds, now) : null;
    const left = next ? formatCountdown(next.getTime() - now.getTime())?.text : null;
    return {
      label: "Giá đang chào",
      price,
      sub:
        phase === "paused"
          ? `Giá đứng yên khi tạm dừng · sàn ${formatMoneyFull(lot.floor_price)}`
          : next && price != null && lot.bid_step
            ? `Giảm còn ${formatMoneyFull(price - lot.bid_step)} sau ${left ?? "—"} · sàn ${formatMoneyFull(lot.floor_price)}`
            : `Đã chạm giá sàn — giá không giảm thêm`,
    };
  }

  if (method === "sealed" && phase === "tied") {
    const nos = state?.tied_bidder_nos ?? [];
    const meIn = nos.includes(myBidderNo);
    return {
      label: `${roundLabel(state?.round_no ?? 1)} · bằng giá`,
      price: state?.tie_amount ?? null,
      sub: `Số báo danh ${nos.map(formatBidderNo).join(", ")} cùng trả giá cao nhất${meIn ? " — có bạn" : ""}`,
    };
  }

  if (method === "sealed" && live) {
    const round = state?.round_no ?? 1;
    return {
      label: `${roundLabel(round)} · giá phiếu tối thiểu`,
      price: sealedMinBid(state, lot),
      sub: `${state?.round_bid_count ?? 0} phiếu đã nộp · giá kín, công bố khi hết giờ nhận phiếu`,
    };
  }

  return null;
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { NO_BID_MESSAGES, type NoBidReason } from "@/lib/bidding/roomAccess";
import { hasLeader, isLivePhase } from "@/lib/bidding/roomView";
import { nextMinBid } from "@/lib/bidding/rules";
import type { LotPhase } from "@/lib/bidding/lotPhase";
import type { BiddingMethod } from "@/lib/bidding/methods";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Thẻ thông báo dưới bảng giá (design `.banner`) — MỘT câu theo hoàn cảnh của
 * người xem, ưu tiên: chỉ xem → tạm dừng/rút → đã đóng → chưa mở → dẫn đầu → bị vượt.
 */

type Tone = "ok" | "warn" | "red" | "mute";

const TONE: Record<Tone, { box: string; dot: string }> = {
  ok: { box: "bg-success/10", dot: "bg-success" },
  warn: { box: "bg-[hsl(var(--tier-warn-bg))]", dot: "bg-[hsl(var(--tier-warn-strong))]" },
  red: { box: "bg-destructive/10", dot: "bg-destructive" },
  mute: { box: "bg-muted", dot: "bg-muted-foreground" },
};

function Banner({ tone, title, children }: { tone: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={cn("m-3 flex items-start gap-2.5 rounded-[10px] px-3.5 py-[11px] text-[13.5px] text-foreground", TONE[tone].box)}>
      <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full", TONE[tone].dot)} />
      <div>
        <b className="block">{title}</b>
        {children}
      </div>
    </div>
  );
}

interface Props {
  lot: AuctionSessionItem;
  state: LotState | null;
  phase: LotPhase;
  myBidderNo: number;
  /** Mình có lượt chưa rút ở lô này (để phân biệt "bị vượt giá" với "chưa trả lần nào"). */
  hasMyBid: boolean;
  noBid: NoBidReason | null;
  /** Lô đang trả giá / tạm dừng KHÁC lô đang xem — hiện nút chuyển sang. */
  activeLot: AuctionSessionItem | null;
  onGoTo: (lot: AuctionSessionItem) => void;
  /** Câu từ chối theo trạng thái phiên/lô mà giai đoạn lô không nói hết (vd. phiên chưa sống). */
  stateMessage: string | null;
  method: BiddingMethod;
}

export function LotBanner({ lot, state, phase, myBidderNo, hasMyBid, noBid, activeLot, onGoTo, stateMessage, method }: Props) {
  const leader = hasLeader(state) ? state!.leading_bidder_no! : null;
  const leaderIsMe = leader === myBidderNo;
  const price = state?.winning_amount ?? state?.current_price ?? null;
  const goTo =
    activeLot && activeLot.id !== lot.id ? (
      <button
        type="button"
        onClick={() => onGoTo(activeLot)}
        className="mt-1.5 block text-[13px] font-semibold text-primary hover:text-primary-hover hover:underline"
      >
        Đến tài sản {activeLot.lot_no} đang trả giá →
      </button>
    ) : null;

  if (noBid) return <Banner tone="red" title="Bạn chỉ được xem phiên này.">{NO_BID_MESSAGES[noBid]}</Banner>;

  if (phase === "withdrawn") {
    return (
      <Banner tone="mute" title="Tài sản đã bị rút khỏi phiên.">
        {state?.withdraw_reason}
        {goTo}
      </Banner>
    );
  }

  if (phase === "paused") {
    return (
      <Banner tone="warn" title="Đấu giá viên tạm dừng tài sản này.">
        {state?.pause_reason ? `${state.pause_reason} ` : ""}Thời gian còn lại được giữ nguyên và cộng bù khi mở lại.
      </Banner>
    );
  }

  if (phase === "tied") {
    const nos = state?.tied_bidder_nos ?? [];
    return nos.includes(myBidderNo) ? (
      <Banner tone="warn" title={`Bạn bằng giá cao nhất — ${formatMoneyFull(state?.tie_amount ?? null)}.`}>
        Đấu giá viên sẽ mở vòng phụ cho số báo danh {nos.map(formatBidderNo).join(", ")}. Ở vòng phụ, phiếu phải từ{" "}
        {formatMoneyFull(state?.tie_amount ?? null)} trở lên.
      </Banner>
    ) : (
      <Banner tone="mute" title="Có người bằng giá cao nhất — chờ vòng phụ.">
        Vòng phụ chỉ dành cho số báo danh {nos.map(formatBidderNo).join(", ")}.
      </Banner>
    );
  }

  if (phase === "closed") {
    if (leader == null) {
      return (
        <Banner tone="mute" title="Tài sản đã đóng — không thành.">
          Không có lượt trả giá hợp lệ.
          {goTo}
        </Banner>
      );
    }
    return leaderIsMe ? (
      <Banner
        tone="ok"
        title={
          method === "descending"
            ? `Bạn đã chấp nhận giá ${formatMoneyFull(price)} — trúng đấu giá.`
            : `Bạn là người trả giá cao nhất — ${formatMoneyFull(price)}.`
        }
      >
        Kết quả chính thức được công bố trong biên bản đấu giá.
      </Banner>
    ) : (
      <Banner tone="mute" title="Tài sản đã đóng — đã có người trúng.">
        Giá trúng {formatMoneyFull(price)}, số báo danh {formatBidderNo(leader)}.{goTo}
      </Banner>
    );
  }

  if (phase === "pending") {
    return (
      <Banner tone="mute" title="Đấu giá viên chưa mở tài sản này.">
        Tài sản được mở lần lượt{activeLot && activeLot.id !== lot.id ? `, sau khi tài sản ${activeLot.lot_no} đóng` : ""}.
        Màn hình tự cập nhật khi tài sản được mở.
        {goTo}
      </Banner>
    );
  }

  if (stateMessage) return <Banner tone="mute" title={stateMessage} />;

  // Dẫn đầu / bị vượt chỉ có nghĩa với trả giá lên — hai phương thức kia có bảng riêng.
  if (method === "ascending" && isLivePhase(phase) && leader != null) {
    if (leaderIsMe) {
      return (
        <Banner tone="ok" title="Bạn đang trả giá cao nhất.">
          Bạn chỉ trả tiếp được khi có người trả cao hơn.
        </Banner>
      );
    }
    if (hasMyBid) {
      return (
        <Banner tone="warn" title="Bạn đã bị vượt giá.">
          Số báo danh {formatBidderNo(leader)} vừa trả {formatMoneyFull(price)}. Trả từ{" "}
          {formatMoneyFull(nextMinBid(state, lot))} để dẫn đầu lại.
        </Banner>
      );
    }
  }

  return null;
}

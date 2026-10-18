import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { lotPhaseOf } from "@/lib/bidding/lotPhase";
import { isLivePhase } from "@/lib/bidding/roomView";
import { roundLabel } from "@/lib/bidding/sealed";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Báo khi đấu giá viên chuyển sang lô kế tiếp, khi lô đang xem được gia hạn bởi
 * lượt của NGƯỜI KHÁC (lượt của mình đã có toast từ usePlaceBid), và khi lô bỏ
 * phiếu kín sang vòng phụ.
 */
export function useRoomToasts(
  lots: AuctionSessionItem[],
  stateByLot: Map<string, LotState>,
  now: Date,
  selected: AuctionSessionItem | null,
  selectedState: LotState | null,
  bidderNo: number,
) {
  const live = lots.find((l) => isLivePhase(lotPhaseOf(stateByLot.get(l.id) ?? null, now))) ?? null;
  const lastLive = useRef<AuctionSessionItem | null>(null);
  useEffect(() => {
    if (!live) return;
    const prev = lastLive.current;
    lastLive.current = live;
    if (prev && prev.id !== live.id) {
      toast(`Tài sản ${prev.lot_no} đã đóng. Tài sản ${live.lot_no} bắt đầu nhận trả giá.`);
    }
  }, [live]);

  const ext = useRef<{ lotId: string; count: number } | null>(null);
  const count = selectedState?.extension_count ?? 0;
  useEffect(() => {
    if (!selected) return;
    const prev = ext.current;
    ext.current = { lotId: selected.id, count };
    if (prev?.lotId === selected.id && count > prev.count && selectedState?.leading_bidder_no !== bidderNo) {
      toast(`Có lượt trả giá sát giờ đóng — tài sản ${selected.lot_no} được gia hạn thêm thời gian.`);
    }
  }, [selected, count, selectedState?.leading_bidder_no, bidderNo]);

  const roundRef = useRef<{ lotId: string; round: number } | null>(null);
  const round = selectedState?.round_no ?? 1;
  const inTie = (selectedState?.tied_bidder_nos ?? []).includes(bidderNo);
  useEffect(() => {
    if (!selected) return;
    const prev = roundRef.current;
    roundRef.current = { lotId: selected.id, round };
    if (prev?.lotId === selected.id && round > prev.round) {
      toast(
        inTie
          ? `${roundLabel(round)} của tài sản ${selected.lot_no} đã mở — bạn được nộp phiếu mới.`
          : `Tài sản ${selected.lot_no} sang ${roundLabel(round).toLowerCase()} cho những người bằng giá.`,
      );
    }
  }, [selected, round, inTie]);
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { NoBidReason } from "@/lib/bidding/roomAccess";
import { lotAcceptsBids, lotPhaseOf } from "@/lib/bidding/lotPhase";
import type { BidSession } from "@/lib/bidding/rules";
import { useLotStates } from "@/hooks/useLotStates";
import { useServerClock, useServerNow } from "@/hooks/useServerClock";
import { useWithdrawBid } from "@/hooks/usePlaceBid";
import type { LotBid, LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, PublicSessionDetail } from "@/types/auction-session";
import type { BiddingContract } from "@/types/bidding-contract";
import { BidHistory } from "./BidHistory";
import { BidPanel } from "./BidPanel";
import { BiddingMethodNotice } from "./BiddingMethodNotice";
import { LiveLotCard } from "./LiveLotCard";
import { LotBoard } from "./LotBoard";
import { WithdrawBidDialog } from "./WithdrawBidDialog";

/**
 * Bộ điều phối phòng đấu giá.
 *
 * TÁCH KHỎI TRANG có chủ đích: useLotStates mở socket trong một useEffect vô
 * điều kiện, mà React thì cấm gọi hook có điều kiện. Nếu đặt hook ngay trong
 * trang thì người bị chặn ở cổng cũng mở kênh realtime.
 *
 * Cũng là NƠI DUY NHẤT mount useLotStates cho phiên này: BidHistory dựa vào
 * kênh đó để tự làm mới.
 *
 * MỘT `now` cho cả phòng: giai đoạn lô, đồng hồ và validateBid phải đọc cùng
 * một mốc, nếu không ô nhập còn bật thêm một nhịp sau khi đồng hồ đã báo đóng.
 */

interface Props {
  session: PublicSessionDetail;
  contract: BiddingContract;
  bidderNo: number;
  /** false = đã mất tiền đặt trước (đã rút giá): xem được, không trả giá được. */
  noBid: NoBidReason | null;
  userId: string;
}

/** Lô nào đáng chọn sẵn: đang trả giá → tạm dừng → chưa mở → còn lại. */
function defaultLot(lots: AuctionSessionItem[], stateByLot: Map<string, LotState>, now: Date) {
  const rank = (lot: AuctionSessionItem) => {
    const phase = lotPhaseOf(stateByLot.get(lot.id) ?? null, now);
    if (phase === "open" || phase === "extended") return 0;
    if (phase === "paused") return 1;
    if (phase === "pending") return 2;
    return 3;
  };
  return [...lots].sort((a, b) => rank(a) - rank(b) || a.lot_no - b.lot_no)[0] ?? null;
}

export function BiddingRoom({ session, contract, bidderNo, noBid, userId }: Props) {
  const { data: states, isLoading } = useLotStates(session.id);
  const { ready: clockReady } = useServerClock();
  const now = useServerNow(1000);

  const [searchParams, setSearchParams] = useSearchParams();
  const [withdrawTarget, setWithdrawTarget] = useState<LotBid | null>(null);
  const withdraw = useWithdrawBid(session.id);

  const lots = session.auction_session_items ?? [];

  const stateByLot = useMemo(() => {
    const map = new Map<string, LotState>();
    for (const s of states ?? []) map.set(s.lot_id, s);
    return map;
  }, [states]);

  // Chọn lô qua ?lot=<lot_no> để hai trình duyệt mở cùng một lô bằng link.
  const paramLotNo = Number(searchParams.get("lot"));
  const fromParam = lots.find((l) => l.lot_no === paramLotNo) ?? null;
  const selected = fromParam ?? defaultLot(lots, stateByLot, now);

  // Ghi lựa chọn mặc định vào URL MỘT LẦN, rồi không bao giờ tự đổi nữa: giật
  // sang lô khác lúc người dùng đang gõ số tiền là chuyện không chấp nhận được.
  useEffect(() => {
    if (!fromParam && selected) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("lot", String(selected.lot_no));
          return next;
        },
        { replace: true },
      );
    }
  }, [fromParam, selected, setSearchParams]);

  const bidSession: BidSession = {
    status: session.status,
    auction_format: session.auction_format,
    starts_at: session.starts_at,
    max_bid_steps: session.max_bid_steps,
  };

  if (isLoading && !states) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!selected) {
    return (
      <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
        Phiên này chưa có lô tài sản nào.
      </Card>
    );
  }

  const selectedState = stateByLot.get(selected.id) ?? null;
  const phase = lotPhaseOf(selectedState, now);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <LiveLotCard
            lot={selected}
            state={selectedState}
            now={now}
            clockReady={clockReady}
            myBidderNo={bidderNo}
          />
          <BidPanel
            sessionId={session.id}
            bidSession={bidSession}
            lot={selected}
            state={selectedState}
            now={now}
            clockReady={clockReady}
            userId={userId}
            bidderNo={bidderNo}
            noBid={noBid}
          />
          <BidHistory
            sessionId={session.id}
            lotId={selected.id}
            myBidderNo={bidderNo}
            myContractId={contract.id}
            leadingBidId={selectedState?.current_bid_id ?? null}
            // withdraw_bid cho rút cả khi lô đang TẠM DỪNG (20260913000001:876).
            canWithdraw={noBid === null && (lotAcceptsBids(selectedState, now) || phase === "paused")}
            onWithdraw={setWithdrawTarget}
          />
        </div>

        <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-4 lg:self-start">
          <Card className="rounded-2xl bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground">Số báo danh của bạn</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{formatBidderNo(bidderNo)}</p>
          </Card>
          <LotBoard
            lots={lots}
            stateByLot={stateByLot}
            now={now}
            clockReady={clockReady}
            selectedLotId={selected.id}
            onSelect={(lot) =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("lot", String(lot.lot_no));
                  return next;
                },
                { replace: true },
              )
            }
            myBidderNo={bidderNo}
          />
          <BiddingMethodNotice />
        </aside>
      </div>

      <WithdrawBidDialog
        bid={withdrawTarget}
        lotTitle={selected.title}
        depositAmount={contract.deposit_amount_received}
        pending={withdraw.isPending}
        onOpenChange={() => setWithdrawTarget(null)}
        onConfirm={(bidId) => withdraw.mutate(bidId, { onSuccess: () => setWithdrawTarget(null) })}
      />
    </>
  );
}

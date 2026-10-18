import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoneyFull } from "@/utils/money";
import type { NoBidReason } from "@/lib/bidding/roomAccess";
import { lotPhaseOf } from "@/lib/bidding/lotPhase";
import { lotActionGate } from "@/lib/bidding/actionGate";
import { biddingMethodOf } from "@/lib/bidding/methods";
import { activeLotOf, isLivePhase, nextPendingLotOf } from "@/lib/bidding/roomView";
import type { BidSession } from "@/lib/bidding/rules";
import { useLotStates } from "@/hooks/useLotStates";
import { useLotBids } from "@/hooks/useLotBids";
import { useServerClock, useServerNow } from "@/hooks/useServerClock";
import { useWithdrawBid } from "@/hooks/usePlaceBid";
import type { LotBid, LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, PublicSessionDetail } from "@/types/auction-session";
import type { BiddingContract } from "@/types/bidding-contract";
import { BiddingMethodNotice } from "./BiddingMethodNotice";
import { BidFeed } from "./BidFeed";
import { LotActionArea } from "./LotActionArea";
import { LotBanner } from "./LotBanner";
import { LotBoard } from "./LotBoard";
import { LotDetailCard } from "./LotDetailCard";
import { LotRail } from "./LotRail";
import { RoomHeader } from "./RoomHeader";
import { LotPhasePills } from "./RoomPill";
import { SealedBidFeed } from "./SealedBidFeed";
import { useRoomToasts } from "./useRoomToasts";
import { WithdrawBidDialog } from "./WithdrawBidDialog";

/**
 * Phòng đấu giá (design "Phong Dau Gia - Redesign"): thanh đầu riêng + 3 cột
 * tài sản | bảng giá & trả giá | diễn biến.
 *
 * TÁCH KHỎI TRANG có chủ đích: useLotStates mở socket trong một useEffect vô
 * điều kiện, mà React thì cấm gọi hook có điều kiện. Nếu đặt hook ngay trong
 * trang thì người bị chặn ở cổng cũng mở kênh realtime.
 *
 * Cũng là NƠI DUY NHẤT mount useLotStates cho phiên này: useLotBids dựa vào
 * kênh đó để tự làm mới.
 *
 * MỘT `now` cho cả phòng: giai đoạn lô, đồng hồ và validateBid phải đọc cùng
 * một mốc, nếu không ô nhập còn bật thêm một nhịp sau khi đồng hồ đã báo đóng.
 */

interface Props {
  session: PublicSessionDetail;
  sessionPath: string;
  contract: BiddingContract;
  bidderNo: number;
  /** `null` = trả giá được; khác null = chỉ xem (đã mất / đã chốt / đã hoàn tiền đặt trước). */
  noBid: NoBidReason | null;
  userId: string;
}

/** Lô nào đáng chọn sẵn: đang trả giá → tạm dừng → chưa mở → còn lại. */
function defaultLot(lots: AuctionSessionItem[], stateByLot: Map<string, LotState>, now: Date) {
  const rank = (lot: AuctionSessionItem) => {
    const phase = lotPhaseOf(stateByLot.get(lot.id) ?? null, now);
    if (phase === "open" || phase === "extended") return 0;
    if (phase === "paused" || phase === "tied") return 1;
    if (phase === "pending") return 2;
    return 3;
  };
  return [...lots].sort((a, b) => rank(a) - rank(b) || a.lot_no - b.lot_no)[0] ?? null;
}

export function BiddingRoom({ session, sessionPath, contract, bidderNo, noBid, userId }: Props) {
  const { data: states, isLoading } = useLotStates(session.id);
  const { ready: clockReady } = useServerClock();
  const now = useServerNow(1000);

  const [searchParams, setSearchParams] = useSearchParams();
  const [withdrawTarget, setWithdrawTarget] = useState<LotBid | null>(null);
  const withdraw = useWithdrawBid(session.id);
  const method = biddingMethodOf(session.bidding_method);
  const dropSeconds = session.price_drop_seconds ?? 60;

  const lots = useMemo(
    () => [...(session.auction_session_items ?? [])].sort((a, b) => a.lot_no - b.lot_no),
    [session.auction_session_items],
  );

  const stateByLot = useMemo(() => {
    const map = new Map<string, LotState>();
    for (const s of states ?? []) map.set(s.lot_id, s);
    return map;
  }, [states]);

  // Chọn lô qua ?lot=<lot_no> để hai trình duyệt mở cùng một lô bằng link.
  const paramLotNo = Number(searchParams.get("lot"));
  const fromParam = lots.find((l) => l.lot_no === paramLotNo) ?? null;
  const selected = fromParam ?? defaultLot(lots, stateByLot, now);

  const selectLot = (lot: AuctionSessionItem) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("lot", String(lot.lot_no));
        return next;
      },
      { replace: true },
    );

  // Ghi lựa chọn mặc định vào URL MỘT LẦN, rồi không bao giờ tự đổi nữa: giật
  // sang lô khác lúc người dùng đang gõ số tiền là chuyện không chấp nhận được.
  // Chờ có trạng thái lô: chọn trước đó thì luôn ra lô 1 thay vì lô đang trả giá.
  const statesReady = !!states;
  useEffect(() => {
    if (!fromParam && selected && statesReady) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("lot", String(selected.lot_no));
          return next;
        },
        { replace: true },
      );
    }
  }, [fromParam, selected, statesReady, setSearchParams]);

  const activeLot = activeLotOf(lots, stateByLot, now);
  const nextLot = nextPendingLotOf(lots, stateByLot, now);
  const selectedState = selected ? (stateByLot.get(selected.id) ?? null) : null;
  const phase = lotPhaseOf(selectedState, now);
  const { data: bids, isLoading: bidsLoading } = useLotBids(session.id, selected?.id);

  useRoomToasts(lots, stateByLot, now, selected, selectedState, bidderNo);

  const header = (
    <RoomHeader
      sessionPath={sessionPath}
      code={session.code}
      title={session.title}
      now={now}
      clockReady={clockReady}
      bidderNo={bidderNo}
    />
  );

  if (isLoading && !states) {
    return (
      <div className="min-h-screen bg-muted">
        {header}
        <div className="mx-auto grid max-w-[1440px] gap-4 px-5 py-4 md:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_330px]">
          <Skeleton className="h-80 rounded-[14px]" />
          <Skeleton className="h-[420px] rounded-[14px]" />
          <Skeleton className="h-80 rounded-[14px]" />
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-muted">
        {header}
        <div className="mx-auto max-w-xl px-5 py-10">
          <div className="rounded-[14px] bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
            Phiên này chưa có tài sản nào.
          </div>
        </div>
      </div>
    );
  }

  const bidSession: BidSession = {
    status: session.status,
    auction_format: session.auction_format,
    starts_at: session.starts_at,
    max_bid_steps: session.max_bid_steps,
    bidding_method: method,
  };
  const { show: showComposer, stateMessage } = lotActionGate({
    method,
    lot: selected,
    state: selectedState,
    phase,
    bidSession,
    bidderNo,
    canBid: noBid === null,
    userId,
    now,
  });
  const hasMyBid = (bids ?? []).some((b) => b.contract_id === contract.id && b.withdrawn_at == null);
  // Bỏ phiếu kín chưa đóng: sổ trả giá còn rỗng (phiếu chỉ chép sang khi đóng) ⇒ cột phải đọc phiếu kín.
  const sealedOpen =
    method === "sealed" && phase !== "closed" && phase !== "withdrawn" && phase !== "pending";

  return (
    <div className="min-h-screen bg-muted">
      {header}

      <div className="mx-auto grid max-w-[1440px] items-start gap-4 p-3 pb-10 md:grid-cols-[250px_minmax(0,1fr)] md:px-5 md:py-4 xl:grid-cols-[270px_minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4 md:sticky md:top-[76px]">
          <BiddingMethodNotice method={method} />
          <LotRail
            lots={lots}
            stateByLot={stateByLot}
            now={now}
            clockReady={clockReady}
            selectedLotId={selected.id}
            nextLotId={nextLot?.id ?? null}
            onSelect={selectLot}
            myBidderNo={bidderNo}
            method={method}
            dropSeconds={dropSeconds}
          />
        </div>

        <main className="flex min-w-0 flex-col gap-4">
          <section className="rounded-[14px] bg-card shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-5 pt-[18px]">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Tài sản {selected.lot_no} / {lots.length}
                </div>
                <h1 className="mt-0.5 text-[19px] font-bold leading-[1.3] text-foreground">
                  {selected.title}
                </h1>
                <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground">
                  <span>
                    Khởi điểm{" "}
                    <b className="font-semibold text-foreground">
                      {formatMoneyFull(selected.starting_price)}
                    </b>
                  </span>
                  <span>
                    Bước giá{" "}
                    <b className="font-semibold text-foreground">{formatMoneyFull(selected.bid_step)}</b>
                  </span>
                  <span>
                    Đặt trước{" "}
                    <b className="font-semibold text-foreground">
                      {formatMoneyFull(selected.deposit_amount)}
                    </b>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <LotPhasePills phase={phase} extensionCount={selectedState?.extension_count ?? 0} />
              </div>
            </div>

            <LotBoard
              lot={selected}
              state={selectedState}
              phase={phase}
              now={now}
              clockReady={clockReady}
              myBidderNo={bidderNo}
              activeLotNo={activeLot?.lot_no ?? null}
              method={method}
              dropSeconds={dropSeconds}
            />

            <LotBanner
              lot={selected}
              state={selectedState}
              phase={phase}
              myBidderNo={bidderNo}
              hasMyBid={hasMyBid}
              noBid={noBid}
              activeLot={activeLot}
              onGoTo={selectLot}
              stateMessage={stateMessage}
              method={method}
            />

            {showComposer ? (
              <LotActionArea
                method={method}
                sessionId={session.id}
                bidSession={bidSession}
                lot={selected}
                state={selectedState}
                now={now}
                clockReady={clockReady}
                userId={userId}
                bidderNo={bidderNo}
                contractId={contract.id}
                dropSeconds={dropSeconds}
              />
            ) : null}
          </section>

          <LotDetailCard lot={selected} lotCount={lots.length} />
        </main>

        {sealedOpen ? (
          <SealedBidFeed
            sessionId={session.id}
            lotId={selected.id}
            state={selectedState}
            myBidderNo={bidderNo}
          />
        ) : (
          <BidFeed
            bids={bids}
            loading={bidsLoading}
            phase={phase}
            startingPrice={selected.starting_price}
            myBidderNo={bidderNo}
            myContractId={contract.id}
            leadingBidId={selectedState?.current_bid_id ?? null}
            // withdraw_bid cho rút cả khi lô đang TẠM DỪNG (20260913000001:876). Chỉ trả giá lên.
            canWithdraw={
              method === "ascending" && noBid === null && (isLivePhase(phase) || phase === "paused")
            }
            onWithdraw={setWithdrawTarget}
            method={method}
          />
        )}
      </div>

      <WithdrawBidDialog
        bid={withdrawTarget}
        lotNo={selected.lot_no}
        depositAmount={contract.deposit_amount_received}
        pending={withdraw.isPending}
        onOpenChange={() => setWithdrawTarget(null)}
        onConfirm={(bidId) => withdraw.mutate(bidId, { onSuccess: () => setWithdrawTarget(null) })}
      />
    </div>
  );
}

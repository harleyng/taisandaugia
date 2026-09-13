import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoBox } from "@/components/shared/InfoBox";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { bidderRosterRows } from "@/lib/biddingContracts/filters";
import { operateWindowOf, OPERATE_BLOCK_LABELS } from "@/lib/bidding/controlAccess";
import { finalizeBlockersOf, finalizePreviewOf } from "@/lib/bidding/finalize";
import { lotPhaseOf } from "@/lib/bidding/lotPhase";
import type { ActorSources } from "@/lib/bidding/lotEventText";
import { useLotStates } from "@/hooks/useLotStates";
import { useServerClock, useServerNow } from "@/hooks/useServerClock";
import {
  useFinalizeSession,
  useLotEvents,
  useOpenLot,
  usePauseLot,
  useResumeLot,
  useWithdrawLot,
} from "@/hooks/useOrgBidding";
import { useSessionBiddingContracts } from "@/hooks/useOrgBiddingContracts";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import { BidderRoster } from "./BidderRoster";
import { FinalizeSessionCard } from "./FinalizeSessionCard";
import { FinalizeSessionDialog } from "./FinalizeSessionDialog";
import { SettlementPanel } from "./SettlementPanel";
import { ControlLotTable } from "./ControlLotTable";
import { LiveBidFeed } from "./LiveBidFeed";
import { LotEventLog } from "./LotEventLog";
import { OpenLotDialog } from "./OpenLotDialog";
import { PauseLotDialog } from "./PauseLotDialog";
import { WithdrawLotDialog } from "./WithdrawLotDialog";

/**
 * Bộ điều phối phòng điều hành.
 *
 * TÁCH KHỎI TRANG vì useLotStates mở socket realtime trong một useEffect VÔ
 * ĐIỀU KIỆN, mà React cấm gọi hook có điều kiện — để hook trong trang thì người
 * bị cổng chặn (phiên nháp, phiên trực tiếp) cũng mở kênh. Đây cũng là NƠI DUY
 * NHẤT mount useLotStates cho phiên này: LiveBidFeed dựa vào kênh đó để tự làm
 * mới, nên không component con nào được gọi useLotStates hay useLotState —
 * useLotState gọi lại useLotStates bên trong và sẽ mở kênh thứ hai trùng tên.
 *
 * MỘT `now` cho cả màn: giai đoạn lô, đồng hồ và việc bật/tắt nút phải đọc cùng
 * một mốc, nếu không nút "Tạm dừng" còn sáng thêm một nhịp sau khi lô đã hết giờ
 * và server sẽ trả lot_closed.
 */

interface Props {
  session: AuctionSessionWithItems;
  canOperate: boolean;
  canViewContracts: boolean;
  /** dieu-hanh-dau-gia.finalize — chốt phiên, biên bản, xác nhận thanh toán. */
  canFinalize: boolean;
  /** ho-so-tham-gia.update — MODULE KHÁC, chỉ để ghi nhận hoàn trả tiền đặt trước. */
  canRefund: boolean;
}

type DialogKind = "open" | "pause" | "withdraw" | null;

export function BiddingControlRoom({ session, canOperate, canViewContracts, canFinalize, canRefund }: Props) {
  const navigate = useNavigate();
  const { data: states, isLoading: statesLoading } = useLotStates(session.id);
  const { ready: clockReady } = useServerClock();
  const now = useServerNow(1000);

  const { data: events, isLoading: eventsLoading } = useLotEvents(session.id);
  const { data: contracts = [], isLoading: contractsLoading } = useSessionBiddingContracts(session.id);
  const { data: members = [] } = useOrgMembers(session.organization_id);

  const openLot = useOpenLot(session.id);
  const pauseLot = usePauseLot(session.id);
  const resumeLot = useResumeLot(session.id);
  const withdrawLot = useWithdrawLot(session.id);
  const finalizeSession = useFinalizeSession(session.id);

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [target, setTarget] = useState<AuctionSessionItem | null>(null);

  // useMemo vì `?? []` tạo mảng mới mỗi lần render, làm mọi useMemo phía dưới
  // (xếp lô mặc định, map số lô) tính lại vô ích mỗi nhịp đồng hồ.
  const lots = useMemo(() => session.auction_session_items ?? [], [session.auction_session_items]);

  const stateByLot = useMemo(() => {
    const map = new Map<string, LotState>();
    for (const s of states ?? []) map.set(s.lot_id, s);
    return map;
  }, [states]);

  // Lô đáng xem nhất: đang trả giá → tạm dừng → chưa mở → còn lại. Chỉ dùng khi
  // người dùng chưa tự chọn; đã chọn rồi thì không bao giờ tự nhảy sang lô khác.
  const defaultLot = useMemo(() => {
    const rank = (lot: AuctionSessionItem) => {
      const phase = lotPhaseOf(stateByLot.get(lot.id) ?? null, now);
      if (phase === "open" || phase === "extended") return 0;
      if (phase === "paused") return 1;
      if (phase === "pending") return 2;
      return 3;
    };
    return [...lots].sort((a, b) => rank(a) - rank(b) || a.lot_no - b.lot_no)[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ xếp lại khi danh sách lô / trạng thái đổi, không mỗi giây
  }, [lots, stateByLot]);

  const selected = lots.find((l) => l.id === selectedLotId) ?? defaultLot;

  const lotNoById = useMemo(() => new Map(lots.map((l) => [l.id, l.lot_no])), [lots]);

  const rosterRows = useMemo(
    () => (canViewContracts ? bidderRosterRows(contracts, states ?? [], session.id) : []),
    [canViewContracts, contracts, states, session.id],
  );

  const nameByBidderNo = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rosterRows) if (r.bidderNo != null) map.set(r.bidderNo, r.fullName);
    return map;
  }, [rosterRows]);

  const actors: ActorSources = useMemo(
    () => ({
      members: new Map(
        members.filter((m) => m.userId).map((m) => [m.userId as string, m.name || m.email || "Thành viên tổ chức"]),
      ),
      bidders: new Map(contracts.map((c) => [c.user_id, c.full_name])),
    }),
    [members, contracts],
  );

  const window = operateWindowOf(session, now);
  const finalized = !!session.finalized_at;

  // Lô chặn tính theo GIAI ĐOẠN dẫn xuất, không theo status thô — xem finalize.ts.
  const blockers = useMemo(
    () => (finalized ? [] : finalizeBlockersOf(lots, stateByLot, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tính lại khi lô / trạng thái đổi, không mỗi giây
    [finalized, lots, stateByLot],
  );
  const preview = useMemo(
    () => finalizePreviewOf(lots, stateByLot, contracts, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- như trên
    [lots, stateByLot, contracts],
  );
  const pendingLotId =
    openLot.isPending || pauseLot.isPending || resumeLot.isPending || withdrawLot.isPending
      ? target?.id ?? null
      : null;

  const closeDialog = () => {
    setDialog(null);
    setTarget(null);
  };

  const ask = (kind: Exclude<DialogKind, null>) => (lot: AuctionSessionItem) => {
    setTarget(lot);
    setDialog(kind);
  };

  const select = (lot: AuctionSessionItem) => setSelectedLotId(lot.id);

  if (statesLoading && !states) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      {window.reason && (
        <InfoBox variant={window.reason === "finalized" ? "muted" : "amber"} className="text-sm">
          <strong>{OPERATE_BLOCK_LABELS[window.reason]}.</strong>{" "}
          {window.reason === "not_started" &&
            `Phiên bắt đầu lúc ${formatDateTime(session.starts_at)} — chưa mở lô được.`}
          {window.reason === "ended" &&
            `Phiên kết thúc lúc ${formatDateTime(session.ends_at)}. Lô còn mở sẽ tự đóng, không mở thêm lô mới được.`}
          {window.reason === "finalized" &&
            `Kết quả đã chốt lúc ${formatDateTime(session.finalized_at)}. Không mở hay đóng lô được nữa; phần còn lại là xác nhận thanh toán của người trúng, hoàn trả tiền đặt trước và phát hành biên bản.`}
        </InfoBox>
      )}

      {canFinalize && !finalized && (
        <FinalizeSessionCard preview={preview} blockers={blockers} onFinalize={() => setFinalizeOpen(true)} />
      )}

      {/* Bảng lô chiếm TRỌN chiều ngang: nhét vào 2/3 lưới thì cột thao tác bị
          cắt mất, mà đó lại là thứ đấu giá viên cần bấm nhanh nhất. */}
      <ControlLotTable
        lots={lots}
        stateByLot={stateByLot}
        now={now}
        clockReady={clockReady}
        canOperate={canOperate}
        window={window}
        selectedLotId={selected?.id ?? null}
        pendingLotId={pendingLotId}
        onSelect={select}
        onOpen={ask("open")}
        onPause={ask("pause")}
        onResume={(lot) => {
          setTarget(lot);
          resumeLot.mutate(lot.id, { onSettled: () => setTarget(null) });
        }}
        onWithdraw={ask("withdraw")}
      />

      {/* Phiên chốt rồi thì dòng trả giá là lịch sử, việc đang làm là thanh
          toán — nên khối này nằm TRÊN dòng trả giá. Trước khi chốt thì ẩn hẳn:
          cả org_confirm_winner_payment lẫn org_issue_minutes đều trả not_finalized. */}
      {finalized && (
        <SettlementPanel
          session={session}
          lots={lots}
          stateByLot={stateByLot}
          contracts={contracts}
          canFinalize={canFinalize}
          canRefund={canRefund}
          now={now}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {selected ? (
            <LiveBidFeed
              sessionId={session.id}
              lot={selected}
              leadingBidId={stateByLot.get(selected.id)?.current_bid_id ?? null}
              nameByBidderNo={nameByBidderNo}
            />
          ) : (
            <Card className="rounded-2xl border-dashed p-6 text-center text-sm text-muted-foreground">
              Thêm lô tài sản vào phiên để bắt đầu điều hành.
            </Card>
          )}
          <LotEventLog events={events} isLoading={eventsLoading} lotNoById={lotNoById} actors={actors} />
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <BidderRoster
            rows={rosterRows}
            isLoading={contractsLoading}
            canView={canViewContracts}
            onManage={() => navigate(`/portal/ho-so-tham-gia?session=${session.id}`)}
          />
        </aside>
      </div>

      {canFinalize && !finalized && (
        <FinalizeSessionDialog
          open={finalizeOpen}
          sessionTitle={session.title}
          preview={preview}
          pending={finalizeSession.isPending}
          onOpenChange={setFinalizeOpen}
          onConfirm={() =>
            finalizeSession.mutate(session.id, { onSuccess: () => setFinalizeOpen(false) })
          }
        />
      )}

      {canOperate && (
        <>
          <OpenLotDialog
            lot={dialog === "open" ? target : null}
            sessionEndsAt={session.ends_at}
            extensionSeconds={session.extension_seconds}
            now={now}
            pending={openLot.isPending}
            onOpenChange={(open) => !open && closeDialog()}
            onConfirm={(durationSeconds) =>
              target &&
              openLot.mutate({ lotId: target.id, durationSeconds }, { onSuccess: closeDialog })
            }
          />
          <PauseLotDialog
            lot={dialog === "pause" ? target : null}
            pending={pauseLot.isPending}
            onOpenChange={(open) => !open && closeDialog()}
            onConfirm={(reason) =>
              target && pauseLot.mutate({ lotId: target.id, reason }, { onSuccess: closeDialog })
            }
          />
          <WithdrawLotDialog
            lot={dialog === "withdraw" ? target : null}
            state={target ? stateByLot.get(target.id) ?? null : null}
            pending={withdrawLot.isPending}
            onOpenChange={(open) => !open && closeDialog()}
            onConfirm={(reason) =>
              target && withdrawLot.mutate({ lotId: target.id, reason }, { onSuccess: closeDialog })
            }
          />
        </>
      )}
    </>
  );
}

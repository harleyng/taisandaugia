import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UPLOADABLE_DOC_TYPES } from "@/lib/caseQa/labels";
import { lotActionsFor, operateWindowOf } from "@/lib/bidding/controlAccess";
import { biddingMethodOf } from "@/lib/bidding/methods";
import { formatSessionRemaining, isLotDone, lotViewKeyOf } from "@/lib/bidding/controlView";
import { finalizeBlockersOf, finalizePreviewOf } from "@/lib/bidding/finalize";
import type { ActorSources } from "@/lib/bidding/lotEventText";
import { formatMoneyShort } from "@/utils/money";
import { useCaseDocuments } from "@/hooks/useCaseDocuments";
import { useLotStates } from "@/hooks/useLotStates";
import { useServerClock, useServerNow } from "@/hooks/useServerClock";
import { useCheckinSummary } from "@/hooks/useSessionCheckin";
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
import { useOpenTieRound } from "@/hooks/useOrgTieRound";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import { BidderRoster } from "./BidderRoster";
import { ControlDialogs, type DialogKind } from "./ControlDialogs";
import { ControlStatusBar } from "./ControlStatusBar";
import { FinalizeSessionDialog } from "./FinalizeSessionDialog";
import { LotEventLog } from "./LotEventLog";
import { LotIdleCard } from "./LotIdleCard";
import { LotQueueCard } from "./LotQueueCard";
import { LotStageCard } from "./LotStageCard";
import { SettlementPanel } from "./SettlementPanel";
import { TieRoundCard } from "./TieRoundCard";

/**
 * Phòng điều hành — bố cục theo design pdg-ops `controlTab`:
 *   thanh trạng thái → [chưa chốt] sân khấu lô | (Thứ tự lô + Người có mặt)
 *                     → [đã chốt] 4 chỉ số + Kết quả & thanh toán
 *   Nhật ký điều hành (ngoài design — người dùng giữ lại) nằm cột trái dưới sân khấu.
 *
 * TÁCH KHỎI TRANG vì useLotStates mở socket realtime trong một useEffect VÔ
 * ĐIỀU KIỆN — để hook trong trang thì người bị cổng chặn cũng mở kênh. Đây là
 * NƠI DUY NHẤT mount useLotStates cho phiên này: LotStageCard dựa vào kênh đó để
 * tự làm mới lượt trả giá.
 *
 * MỘT `now` cho cả màn: giai đoạn lô, đồng hồ và việc bật/tắt nút phải đọc cùng
 * một mốc, nếu không nút "Tạm dừng" còn sáng thêm một nhịp sau khi lô hết giờ.
 */

interface Props {
  session: AuctionSessionWithItems;
  canOperate: boolean;
  canViewContracts: boolean;
  /** dieu-hanh-dau-gia.finalize — chốt phiên, biên bản, xác nhận thanh toán. */
  canFinalize: boolean;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const hm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const dm = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
const SM = "h-8 gap-1.5 rounded-lg px-[11px] text-[12.5px] font-semibold";

export function BiddingControlRoom({ session, canOperate, canViewContracts, canFinalize }: Props) {
  const navigate = useNavigate();
  const { data: states, isLoading: statesLoading } = useLotStates(session.id);
  const { ready: clockReady } = useServerClock();
  const now = useServerNow(1000);

  const { data: events, isLoading: eventsLoading } = useLotEvents(session.id);
  const { data: contracts = [] } = useSessionBiddingContracts(session.id);
  const { data: members = [] } = useOrgMembers(session.organization_id);
  const { data: summary } = useCheckinSummary(session.id);
  const { data: docs = [] } = useCaseDocuments(session.id);

  const openLot = useOpenLot(session.id);
  const pauseLot = usePauseLot(session.id);
  const resumeLot = useResumeLot(session.id);
  const withdrawLot = useWithdrawLot(session.id);
  const finalizeSession = useFinalizeSession(session.id);
  const openTieRound = useOpenTieRound(session.id);
  const method = biddingMethodOf(session.bidding_method);
  const dropSeconds = session.price_drop_seconds ?? 60;

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [target, setTarget] = useState<AuctionSessionItem | null>(null);

  const lots = useMemo(() => session.auction_session_items ?? [], [session.auction_session_items]);
  const stateByLot = useMemo(() => {
    const map = new Map<string, LotState>();
    for (const s of states ?? []) map.set(s.lot_id, s);
    return map;
  }, [states]);
  const lotNoById = useMemo(() => new Map(lots.map((l) => [l.id, l.lot_no])), [lots]);
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
  const started = window.reason !== "not_started";

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

  const view = lots.map((lot) => {
    const state = stateByLot.get(lot.id) ?? null;
    return { lot, state, key: lotViewKeyOf(state, now) };
  });
  const done = view.filter((v) => isLotDone(v.key)).length;
  const current = view.find((v) => v.key === "live" || v.key === "paused" || v.key === "tied");
  const next = view.find((v) => v.key === "wait");
  const present = summary?.checked_in ?? 0;
  const eligible = summary?.eligible ?? 0;

  const pendingLotId =
    openLot.isPending || pauseLot.isPending || resumeLot.isPending || withdrawLot.isPending || openTieRound.isPending
      ? target?.id ?? null
      : null;
  const closeDialog = () => {
    setDialog(null);
    setTarget(null);
  };
  const ask = (kind: Exclude<DialogKind, null>, lot: AuctionSessionItem) => {
    setTarget(lot);
    setDialog(kind);
  };

  if (statesLoading && !states) return <Skeleton className="h-64 rounded-2xl" />;

  // ── Thanh trạng thái ────────────────────────────────────────────────────
  const starts = new Date(session.starts_at);
  const ends = new Date(session.ends_at);
  const roomBtn = (
    <Button variant="outline" className={SM} onClick={() => navigate(`/sessions/${session.id}/dau-gia`)}>
      <ExternalLink className="h-4 w-4" />
      Phòng đấu giá trên sàn
    </Button>
  );
  const finalizeBtn = canFinalize && started && !finalized && (
    <Button
      className={SM}
      disabled={blockers.length > 0}
      title={blockers.length ? `Còn ${blockers.length} tài sản chưa đóng` : undefined}
      onClick={() => setFinalizeOpen(true)}
    >
      Chốt kết quả phiên
    </Button>
  );
  const fin = session.finalized_at ? new Date(session.finalized_at) : null;
  const stat = finalized
    ? { label: "Đã chốt kết quả", value: fin ? `${dm(fin)} · ${hm(fin)}` : "—" }
    : window.reason === "not_started"
      ? { label: "Mở phòng lúc", value: `${dm(starts)}/${starts.getFullYear()} · ${hm(starts)}` }
      : window.reason === "ended"
        ? { label: "Phiên đã hết giờ lúc", value: `${dm(ends)} · ${hm(ends)}` }
        : {
            label: "Thời gian còn lại",
            value: formatSessionRemaining(ends.getTime() - now.getTime()),
            meta: `· kết thúc ${hm(ends)}`,
          };

  const bar = (
    <ControlStatusBar
      {...stat}
      actions={
        <>
          {roomBtn}
          {finalizeBtn}
        </>
      }
      lots={view.map((v) => ({ lotNo: v.lot.lot_no, key: v.key }))}
      done={done}
      present={started ? present : null}
      eligible={eligible}
    />
  );

  // ── Sân khấu ────────────────────────────────────────────────────────────
  let stage;
  if (current?.key === "tied") {
    const actions = lotActionsFor(current.state, now, { canOperate, window });
    stage = (
      <TieRoundCard
        sessionId={session.id}
        lot={current.lot}
        state={current.state}
        total={lots.length}
        busy={pendingLotId === current.lot.id}
        openTieRound={actions.openTieRound}
        withdraw={actions.withdraw}
        onOpenTieRound={() => ask("tieRound", current.lot)}
        onWithdraw={() => ask("withdraw", current.lot)}
      />
    );
  } else if (current) {
    stage = (
      <LotStageCard
        sessionId={session.id}
        lot={current.lot}
        state={current.state}
        total={lots.length}
        paused={current.key === "paused"}
        now={now}
        clockReady={clockReady}
        canOperate={canOperate}
        busy={pendingLotId === current.lot.id}
        method={method}
        dropSeconds={dropSeconds}
        onPause={() => ask("pause", current.lot)}
        onResume={() => {
          setTarget(current.lot);
          resumeLot.mutate(current.lot.id, { onSettled: () => setTarget(null) });
        }}
        onWithdraw={() => ask("withdraw", current.lot)}
      />
    );
  } else if (started && next) {
    const open = lotActionsFor(next.state, now, { canOperate, window }).open;
    stage = (
      <LotIdleCard
        eyebrow={`Tài sản tiếp theo · ${next.lot.lot_no} / ${lots.length}`}
        pill="Chờ mở"
        title={next.lot.title}
        facts={[
          ["Giá khởi điểm", next.lot.starting_price != null ? formatMoneyShort(next.lot.starting_price) : "—"],
          ["Bước giá", next.lot.bid_step != null ? formatMoneyShort(next.lot.bid_step) : "—"],
          ["Tiền đặt trước", next.lot.deposit_amount != null ? formatMoneyShort(next.lot.deposit_amount) : "—"],
          ["Có mặt", `${present} người`],
        ]}
        control={{
          label: `Mở tài sản ${next.lot.lot_no}`,
          hint: "Người trả giá thấy tài sản ngay khi mở.",
          disabled: !open.enabled || pendingLotId === next.lot.id,
          disabledTitle: open.disabledReason ?? undefined,
          onClick: () => ask("open", next.lot),
        }}
      />
    );
  } else if (!started) {
    const approved = contracts.filter((c) => c.status === "paid" && c.review_status === "approved").length;
    const docsOk = UPLOADABLE_DOC_TYPES.filter((t) =>
      docs.some((d) => d.doc_type === t && d.review_status === "confirmed"),
    ).length;
    stage = (
      <LotIdleCard
        eyebrow="Sẵn sàng điều hành"
        title={`Phòng mở lúc ${hm(starts)} ngày ${dm(starts)}`}
        checks={[
          { ok: approved > 0, title: "Danh sách đủ điều kiện", sub: `${approved} người đã duyệt` },
          {
            ok: docsOk >= UPLOADABLE_DOC_TYPES.length,
            title: "Tài liệu phiên",
            sub: `${docsOk}/${UPLOADABLE_DOC_TYPES.length} đã xác nhận`,
          },
          {
            ok: !!summary?.roster_closed_at,
            title: "Chốt điểm danh",
            sub: `Mở ${session.checkin_lead_minutes} phút trước giờ bắt đầu`,
          },
          { ok: lots.length > 0, title: "Thứ tự tài sản", sub: `${lots.length} tài sản, đấu lần lượt` },
        ]}
        control={{
          label: "Mở tài sản 1",
          hint: "Mở được khi đến giờ bắt đầu và đã chốt điểm danh.",
          disabled: true,
          disabledTitle: "Chưa đến giờ",
        }}
      />
    );
  } else {
    stage = (
      <LotIdleCard
        eyebrow={`Đã đóng ${done} / ${lots.length} tài sản`}
        title="Không còn tài sản chờ mở — chốt kết quả phiên để chuyển sang thanh toán."
      />
    );
  }

  // Nhật ký điều hành (ngoài design, người dùng giữ lại): cột trái dưới sân khấu.
  const eventLog = (
    <LotEventLog
      events={events}
      isLoading={eventsLoading}
      lotNoById={lotNoById}
      actors={actors}
      currentLotId={current?.lot.id ?? null}
    />
  );

  return (
    <>
      {bar}

      {finalized ? (
        <SettlementPanel
          session={session}
          lots={view}
          stateByLot={stateByLot}
          contracts={contracts}
          canFinalize={canFinalize}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            {stage}
            {started && eventLog}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <LotQueueCard lots={view} done={done} />
            <BidderRoster
              contracts={contracts}
              canView={canViewContracts}
              started={started}
              present={present}
              eligible={eligible}
            />
          </div>
        </div>
      )}

      {/* Đã chốt thì không còn hai cột — nhật ký xuống cuối. */}
      {finalized && eventLog}

      {canFinalize && !finalized && (
        <FinalizeSessionDialog
          open={finalizeOpen}
          sessionTitle={session.title}
          preview={preview}
          pending={finalizeSession.isPending}
          onOpenChange={setFinalizeOpen}
          onConfirm={() => finalizeSession.mutate(session.id, { onSuccess: () => setFinalizeOpen(false) })}
        />
      )}

      {canOperate && (
        <ControlDialogs
          dialog={dialog}
          target={target}
          session={session}
          stateByLot={stateByLot}
          method={method}
          dropSeconds={dropSeconds}
          now={now}
          mutations={{ openLot, pauseLot, withdrawLot, openTieRound }}
          onClose={closeDialog}
        />
      )}
    </>
  );
}

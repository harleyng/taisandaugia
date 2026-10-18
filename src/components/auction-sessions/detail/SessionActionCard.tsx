import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useMySessionContract, useSessionContractSummary } from "@/hooks/useBiddingContracts";
import { useSessionResults } from "@/hooks/useOrgBidding";
import { useServerNow } from "@/hooks/useServerClock";
import { JOURNEY_STEP_LABELS, journeyPhaseOf, journeyStepOf, type JourneyPhase, hasOnlineRoom } from "@/lib/auctionSessions/buyerJourney";
import { sessionPhaseOf } from "@/lib/auctionSessions/phase";
import { contractCtaState } from "@/lib/biddingContracts/ctaState";
import { attendanceStateOf } from "@/lib/biddingContracts/eligibility";
import type { PublicSessionDetail } from "@/types/auction-session";
import { OutcomeBody } from "./action/OutcomeBody";
import { ParticipationBody } from "./action/ParticipationBody";
import { PurchaseBody } from "./action/PurchaseBody";

function titleOf(phase: JourneyPhase, online: boolean, hasContract: boolean): string {
  switch (phase) {
    case "cancelled":
      return "Phiên đã huỷ";
    case "registered":
    case "awaiting_review":
    case "needs_info":
    case "rejected":
    case "awaiting_deposit":
      return "Hồ sơ của bạn";
    case "ticket_ready":
    case "checkin_open":
    case "absent":
    case "excused":
      return online ? "Điểm danh trực tuyến" : "Điểm danh tại hội trường";
    case "checked_in":
      return online ? "Phòng đấu giá" : "Phiếu dự phiên";
    case "live":
      return online ? "Phòng đấu giá" : "Phiên đang diễn ra";
    case "awaiting_result":
      return "Kết quả";
    case "final":
      return hasContract ? "Kết quả của bạn" : "Kết quả phiên";
    default:
      return "Hồ sơ tham gia";
  }
}

const PARTICIPATION = new Set<JourneyPhase>([
  "registered",
  "awaiting_review",
  "needs_info",
  "rejected",
  "awaiting_deposit",
  "ticket_ready",
  "checkin_open",
  "checked_in",
  "absent",
  "excused",
]);

/**
 * Thẻ hành động ở cột phải trang phiên (design `.ac`): thanh 5 bước của người mua +
 * nội dung theo trạng thái thật (buyerJourney.ts). Giờ lấy theo MÁY CHỦ — cửa sổ
 * điểm danh do server chấm.
 */
export function SessionActionCard({ session }: { session: PublicSessionDetail }) {
  const { userId } = useAuth();
  const now = useServerNow(1000);
  const { data: summary } = useSessionContractSummary(session.id);
  const { data: contract, isLoading: contractLoading } = useMySessionContract(session.id);

  const sessionPhase = sessionPhaseOf(session, now);
  const cta = contractCtaState({ session, contract: contract ?? null, summary: summary ?? null, userId, now });
  const paid = contract?.status === "paid" ? contract : null;
  const phase = journeyPhaseOf({
    sessionStatus: session.status,
    finalized: !!session.finalized_at,
    phase: sessionPhase,
    cta,
    attendance: paid ? attendanceStateOf(paid, session, now) : null,
    hasPaidContract: !!paid,
  });
  const { data: lotStates } = useSessionResults(phase === "live" ? session.id : null);
  const liveLot = (lotStates ?? []).find((s) => s.status === "open" || s.status === "paused" || s.status === "tied");
  const liveLotNo = liveLot ? (session.auction_session_items.find((l) => l.id === liveLot.lot_id)?.lot_no ?? null) : null;

  const step = journeyStepOf(phase);
  const online = hasOnlineRoom(session.auction_format);

  const body = () => {
    if (userId && contractLoading) {
      return (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (paid && (PARTICIPATION.has(phase) || (phase === "live" && paid.checked_in_at))) {
      return (
        <ParticipationBody phase={phase} session={session} contract={paid} liveLotNo={liveLotNo} now={now} />
      );
    }
    if (phase === "live" || phase === "awaiting_result" || phase === "final" || phase === "cancelled") {
      return <OutcomeBody phase={phase} session={session} contract={paid} liveLotNo={liveLotNo} />;
    }
    return (
      <PurchaseBody
        phase={phase as Parameters<typeof PurchaseBody>[0]["phase"]}
        session={session}
        contract={contract ?? null}
        summary={summary ?? null}
        now={now}
      />
    );
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-card">
      <div className="bg-[hsl(var(--tier-std-card-2))] px-4 pb-4 pt-[18px] text-primary-foreground">
        <h3 className="text-[15px] font-semibold">{titleOf(phase, online, !!paid)}</h3>
        {phase !== "cancelled" && (
          <>
            <div className="mt-3 flex gap-1">
              {JOURNEY_STEP_LABELS.map((label, i) => (
                <i
                  key={label}
                  className={cn(
                    "h-1 flex-1 rounded-sm",
                    i < step ? "bg-[hsl(var(--tier-mint))]" : i === step ? "bg-[hsl(var(--tier-slate-art))]" : "bg-primary-foreground/15",
                  )}
                />
              ))}
            </div>
            <div className="mt-1.5 text-xs text-[hsl(var(--tier-std-muted))]">
              Bước {step + 1}/5 · {JOURNEY_STEP_LABELS[step]}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">{body()}</div>
    </section>
  );
}

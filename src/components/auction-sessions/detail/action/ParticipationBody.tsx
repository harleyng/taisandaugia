import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractReviewNotice } from "@/components/bidding-contracts/ContractReviewNotice";
import { ResubmitContractDialog } from "@/components/bidding-contracts/ResubmitContractDialog";
import { CheckinDialogs, type CheckinDialogKind } from "@/components/bidder-checkin/CheckinDialogs";
import { useContractLotIds } from "@/hooks/useBuyerContracts";
import { countdownParts, type JourneyPhase, hasOnlineRoom } from "@/lib/auctionSessions/buyerJourney";
import { formatShortDateTime } from "@/lib/auctionSessions/listBadge";
import { BIDDER_BLOCK_MESSAGES } from "@/lib/bidding/bidderReason";
import { checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { formatBidderNo, myContractDepositPath, myContractPath } from "@/lib/biddingContracts/paths";
import {
  CHECKIN_ATTENDEE_LABELS,
  DEPOSIT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  type BiddingContract,
} from "@/types/bidding-contract";
import type { PublicSessionDetail } from "@/types/auction-session";
import { BidderNoBox, Countdown, KvBox, Note, Pill } from "../ui";
import { BTN } from "../buttonStyles";

interface Props {
  phase: JourneyPhase;
  session: PublicSessionDetail;
  contract: BiddingContract;
  /** "Tài sản 2 đang được đấu giá" — chỉ khi phase live. */
  liveLotNo: number | null;
  now: Date;
}

const REVIEW_TONE = { approved: "ok", pending: "muted", needs_info: "amber", rejected: "red" } as const;

function DepositPill({ status }: { status: BiddingContract["deposit_status"] }) {
  if (status === "received") return <Pill tone="ok">Đã nộp</Pill>;
  if (status === "pending") return <Pill tone="amber">Chưa nộp</Pill>;
  return <Pill tone={status === "forfeited" ? "red" : "muted"}>{DEPOSIT_STATUS_LABELS[status]}</Pill>;
}

const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** Bước 2–4 của người đã mua hồ sơ: duyệt, đặt trước, điểm danh, vào phòng đấu giá. */
export function ParticipationBody({ phase, session, contract: c, liveLotNo, now }: Props) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<CheckinDialogKind | null>(null);
  const { data: lotIds } = useContractLotIds(c.id);
  const [resubmitOpen, setResubmitOpen] = useState(false);

  const online = session.auction_format === "truc_tuyen";
  const room = hasOnlineRoom(session.auction_format);
  const published = session.status === "published";
  const { opensAt, closesAt } = checkinWindowOf(session);
  const venue = [session.venue, session.province].filter(Boolean).join(", ");
  const roomPath = `/sessions/${session.id}/dau-gia`;
  const bidderNo = formatBidderNo(c.bidder_no);
  const checkedCaption = [
    c.checkin_attendee ? CHECKIN_ATTENDEE_LABELS[c.checkin_attendee] : null,
    c.checked_in_at ? `điểm danh lúc ${formatShortDateTime(c.checked_in_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const kv = (
    <KvBox
      rows={[
        { label: "Mã hồ sơ", value: <span className="font-mono">{c.code}</span> },
        { label: "Duyệt hồ sơ", value: <Pill tone={REVIEW_TONE[c.review_status]}>{REVIEW_STATUS_LABELS[c.review_status]}</Pill> },
        { label: "Tiền đặt trước", value: <DepositPill status={c.deposit_status} /> },
        { label: "Số báo danh", value: bidderNo ?? "Cấp khi điểm danh" },
      ]}
    />
  );
  const address = venue ? (
    <div className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
      <MapPin className="mt-0.5 h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
      <span>{venue}</span>
    </div>
  ) : null;
  const myContracts = (
    <Button className={BTN.ghost} onClick={() => navigate(myContractPath(c.code))}>
      Xem hồ sơ của tôi
    </Button>
  );
  // Lô đã đăng ký cho phiếu dự phiên; không có dòng = mọi lô.
  const lotNos = session.auction_session_items
    .filter((l) => !lotIds || lotIds.length === 0 || lotIds.includes(l.id))
    .map((l) => l.lot_no);

  const body = () => {
    switch (phase) {
      case "needs_info":
        return (
          <>
            {kv}
            <Note tone="amber">
              <b>Tổ chức yêu cầu:</b> {c.review_note ?? "Bổ sung giấy tờ theo hướng dẫn của tổ chức đấu giá."}
            </Note>
            {published && (
              <Button className={BTN.primary} onClick={() => setResubmitOpen(true)}>
                Bổ sung giấy tờ
              </Button>
            )}
            <ResubmitContractDialog contract={c} open={resubmitOpen} onOpenChange={setResubmitOpen} />
          </>
        );
      case "rejected":
      case "awaiting_review":
        return (
          <>
            {kv}
            <ContractReviewNotice contract={c} sessionPublished={published} />
            {myContracts}
          </>
        );
      case "awaiting_deposit": {
        return (
          <>
            {kv}
            <p className="m-0 text-xs text-muted-foreground">
              Nộp tiền đặt trước theo hướng dẫn của tổ chức đấu giá
              {session.registration_end_at ? ` trước ${formatShortDateTime(session.registration_end_at)}` : ""}.
            </p>
            <Button
              className={BTN.primary}
              onClick={() => navigate(myContractDepositPath(c.code))}
            >
              Xem hướng dẫn nộp đặt trước
            </Button>
            {myContracts}
          </>
        );
      }
      case "ticket_ready":
        return online ? (
          <>
            {kv}
            <Countdown
              caption={`Mở điểm danh lúc ${formatShortDateTime(opensAt.toISOString())}`}
              parts={countdownParts(opensAt.getTime(), now.getTime())}
            />
            <Note tone="amber">
              Đóng điểm danh lúc {formatShortDateTime(closesAt.toISOString())}. Chưa điểm danh khi đóng sẽ bị ghi vắng và
              mất tiền đặt trước.
            </Note>
          </>
        ) : (
          <>
            {kv}
            <p className="m-0 text-xs text-muted-foreground">
              Có mặt từ <b className="text-foreground">{formatShortDateTime(opensAt.toISOString())}</b>, mang CCCD bản
              gốc và chứng từ nộp tiền đặt trước.
            </p>
            {address}
            <Button className={BTN.primary} onClick={() => setDialog("ticket")}>
              Xem phiếu dự phiên
            </Button>
            {venue && (
              <Button className={BTN.soft} onClick={() => window.open(mapsUrl(venue), "_blank", "noopener,noreferrer")}>
                Chỉ đường
              </Button>
            )}
          </>
        );
      case "checkin_open":
        return online ? (
          <>
            <Countdown
              caption={`Đóng điểm danh lúc ${formatShortDateTime(closesAt.toISOString())}`}
              parts={countdownParts(closesAt.getTime(), now.getTime())}
            />
            <Note tone="amber">Không điểm danh sẽ bị ghi vắng và mất tiền đặt trước.</Note>
            <Button className={BTN.primaryLg} onClick={() => setDialog("checkin")}>
              Điểm danh ngay
            </Button>
          </>
        ) : (
          <>
            <Note tone="plain">
              Đang điểm danh tại hội trường — đóng lúc <b>{formatShortDateTime(closesAt.toISOString())}</b>.
            </Note>
            {address}
            <Button className={BTN.primaryLg} onClick={() => setDialog("ticket")}>
              Mở phiếu dự phiên (QR)
            </Button>
            <span className="text-xs text-muted-foreground">
              Đưa mã cho nhân viên tại bàn điểm danh, kèm CCCD bản gốc.
            </span>
          </>
        );
      case "checked_in":
      case "live":
        return (
          <>
            {phase === "live" && room && (
              <span className="text-center text-xs text-muted-foreground">
                {liveLotNo != null ? `Tài sản ${liveLotNo} đang được đấu giá · ` : ""}dự kiến kết thúc lúc{" "}
                {formatShortDateTime(session.ends_at).slice(-5)}
              </span>
            )}
            <BidderNoBox no={bidderNo ?? "—"} caption={checkedCaption} />
            {room ? (
              <>
                {phase === "checked_in" && (
                  <span className="text-xs text-muted-foreground">
                    Phòng đấu giá mở lúc {formatShortDateTime(session.starts_at)}.
                  </span>
                )}
                <Button className={BTN.primaryLg} onClick={() => navigate(roomPath)}>
                  Vào phòng đấu giá
                </Button>
              </>
            ) : (
              <>
                {address}
                {phase === "live" && (
                  <span className="text-xs text-muted-foreground">
                    {liveLotNo != null ? `Tài sản ${liveLotNo} đang trả giá tại hội trường.` : "Phiên đang trả giá tại hội trường."}
                  </span>
                )}
              </>
            )}
          </>
        );
      case "absent":
        return (
          <>
            <Note tone="amber">{BIDDER_BLOCK_MESSAGES.absent}</Note>
            {c.absence_appeal_at ? (
              <Note>
                Bạn đã gửi lý do lúc {formatShortDateTime(c.absence_appeal_at)} — tổ chức đấu giá đang xem xét.
              </Note>
            ) : (
              <span className="text-xs text-muted-foreground">
                Vắng vì lý do bất khả kháng? Gửi giấy tờ chứng minh để tổ chức xem xét hoàn trả.
              </span>
            )}
            <Button className={BTN.soft} onClick={() => setDialog("appeal")}>
              {c.absence_appeal_at ? "Sửa lý do đã gửi" : "Gửi lý do vắng mặt"}
            </Button>
          </>
        );
      case "excused":
        return <Note>Tổ chức đấu giá đã chấp nhận lý do vắng mặt — tiền đặt trước của bạn đang chờ hoàn trả.</Note>;
      default:
        return (
          <>
            {kv}
            {myContracts}
          </>
        );
    }
  };

  return (
    <>
      {body()}
      <CheckinDialogs kind={dialog} onClose={() => setDialog(null)} contract={c} session={session} lotNos={lotNos} />
    </>
  );
}

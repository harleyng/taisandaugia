import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BidderNoBox, Countdown, Note } from "@/components/auction-sessions/detail/ui";
import { BTN } from "@/components/auction-sessions/detail/buttonStyles";
import { CheckinDialogs, type CheckinDialogKind } from "@/components/bidder-checkin/CheckinDialogs";
import { registeredLotsOf, type MyContract } from "@/hooks/useBuyerContracts";
import { useServerNow } from "@/hooks/useServerClock";
import { formatVnd } from "@/lib/advertising/slug";
import { countdownParts } from "@/lib/auctionSessions/buyerJourney";
import { formatShortDateTime } from "@/lib/auctionSessions/listBadge";
import { checkinWindowLabel, formatClock, maskPhone } from "@/lib/biddingContracts/attendanceTicket";
import { checkinChannelOf, checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { attendanceStateOf } from "@/lib/biddingContracts/eligibility";
import { formatBidderNo } from "@/lib/biddingContracts/paths";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
    <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
    {children}
  </section>
);

const Xs = ({ children }: { children: React.ReactNode }) => (
  <p className="m-0 text-xs text-muted-foreground">{children}</p>
);

/**
 * Thẻ điểm danh ở cột phải chi tiết hồ sơ (design hs-mine.js `ckCard`): chờ mở /
 * đang mở / đã điểm danh / vắng — trực tuyến tự điểm danh bằng mã SMS, trực tiếp
 * mở phiếu QR cho nhân viên quét. null = hồ sơ chưa tới chặng điểm danh.
 */
export function CheckinNextCard({ contract: c }: { contract: MyContract }) {
  // Giờ máy chủ, nhịp 1 giây: đếm ngược + cửa sổ điểm danh do server chấm.
  const now = useServerNow(1000);
  const [dialog, setDialog] = useState<CheckinDialogKind | null>(null);
  const s = c.auction_sessions;
  if (!s) return null;

  const state = attendanceStateOf(c, s, now);
  const channel = checkinChannelOf(s.auction_format);
  const onsite = channel === "onsite";
  const { opensAt, closesAt } = checkinWindowOf(s);
  const windowText = checkinWindowLabel(s);
  const venue = s.venue ? (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <MapPin className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      <span>{s.venue}</span>
    </div>
  ) : null;

  const card = (() => {
    switch (state) {
      case "ticket_ready":
        return onsite ? (
          <Card title="Điểm danh tại hội trường">
            <Countdown caption="Mở điểm danh sau" parts={countdownParts(opensAt.getTime(), now.getTime())} />
            <Xs>Có mặt {windowText}, mang CCCD bản gốc. Số báo danh được cấp tại bàn điểm danh.</Xs>
            {venue}
            <Button className={BTN.primary} onClick={() => setDialog("ticket")}>
              Xem phiếu dự phiên
            </Button>
          </Card>
        ) : (
          <Card title="Điểm danh trực tuyến">
            <Countdown caption="Mở điểm danh sau" parts={countdownParts(opensAt.getTime(), now.getTime())} />
            <Xs>Mở {windowText}. Quá giờ đóng sẽ bị ghi vắng và mất tiền đặt trước.</Xs>
            <Button className={BTN.primary} variant="outline" disabled>
              Điểm danh · mở lúc {formatClock(opensAt)}
            </Button>
          </Card>
        );
      case "checkin_open":
        return onsite ? (
          <Card title="Điểm danh tại hội trường">
            <Note tone="amber">
              Đang điểm danh — đóng lúc <b>{formatClock(closesAt)}</b>.
            </Note>
            {venue}
            <Button className={BTN.primaryLg} onClick={() => setDialog("ticket")}>
              Mở phiếu dự phiên (QR)
            </Button>
            <span className="text-xs text-muted-foreground">
              Đưa mã cho nhân viên tại bàn điểm danh, kèm CCCD bản gốc.
            </span>
          </Card>
        ) : (
          <Card title="Điểm danh trực tuyến">
            <Countdown caption="Đóng điểm danh sau" parts={countdownParts(closesAt.getTime(), now.getTime())} />
            <Button className={BTN.primaryLg} onClick={() => setDialog("checkin")}>
              Điểm danh ngay
            </Button>
            <span className="text-xs text-muted-foreground">Xác nhận bằng mã gửi tới {maskPhone(c.phone)}</span>
          </Card>
        );
      case "checked_in": {
        const who = c.checkin_attendee === "proxy" ? "Người được uỷ quyền" : "Chính chủ";
        const where = c.checkin_channel === "onsite" ? "tại cửa" : "trên sàn";
        return (
          <Card title="Đã điểm danh">
            <BidderNoBox
              no={formatBidderNo(c.bidder_no) ?? "—"}
              caption={`${who} · ${where} · ${formatShortDateTime(c.checked_in_at)}`}
            />
            {onsite ? (
              <Xs>Vào hội trường và ngồi theo số báo danh. Phiên bắt đầu lúc {formatClock(s.starts_at)}.</Xs>
            ) : (
              <Button className={BTN.primaryLg} variant="outline" disabled>
                Vào phòng đấu giá · mở lúc {formatClock(s.starts_at)}
              </Button>
            )}
          </Card>
        );
      }
      case "absent": {
        const amount = c.deposit_amount_received ?? registeredLotsOf(c).reduce((a, l) => a + (l.deposit_amount ?? 0), 0);
        const closedAt = s.roster_closed_at ?? closesAt.toISOString();
        return (
          <Card title="Bạn đã vắng mặt">
            <Note tone="amber">
              Chưa điểm danh khi danh sách chốt lúc <b>{formatClock(closedAt)}</b> nên bị ghi vắng. Tiền đặt trước{" "}
              <b>{formatVnd(amount)}</b> không được hoàn theo Quy chế cuộc đấu giá.
            </Note>
            {c.absence_appeal_at ? (
              <Note>
                Bạn đã gửi lý do lúc {formatShortDateTime(c.absence_appeal_at)} — tổ chức đấu giá đang xem xét.
              </Note>
            ) : (
              <Xs>Vắng vì lý do bất khả kháng? Gửi giấy tờ chứng minh để tổ chức xem xét hoàn trả.</Xs>
            )}
            <Button className={BTN.soft} onClick={() => setDialog("appeal")}>
              {c.absence_appeal_at ? "Sửa lý do đã gửi" : "Gửi lý do vắng mặt"}
            </Button>
          </Card>
        );
      }
      case "excused":
        return (
          <Card title="Đã chấp nhận lý do vắng">
            <Note>
              Tổ chức đấu giá đã chấp nhận lý do vắng mặt
              {c.deposit_status === "refunded" ? " và đã hoàn tiền đặt trước." : " — tiền đặt trước đang chờ hoàn trả."}
            </Note>
          </Card>
        );
      default:
        return null;
    }
  })();

  if (!card) return null;
  return (
    <>
      {card}
      <CheckinDialogs
        kind={dialog}
        onClose={() => setDialog(null)}
        contract={c}
        session={s}
        lotNos={registeredLotsOf(c).map((l) => l.lot_no)}
      />
    </>
  );
}

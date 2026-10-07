import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { useMySessionContract } from "@/hooks/useBiddingContracts";
import { useServerNow } from "@/hooks/useServerClock";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { BIDDER_BLOCK_MESSAGES } from "@/lib/bidding/bidderReason";
import { formatDurationVi } from "@/lib/biddingContracts/checkinReminder";
import { checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { attendanceStateOf } from "@/lib/biddingContracts/eligibility";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { CHECKIN_ATTENDEE_LABELS } from "@/types/bidding-contract";
import type { PublicSessionDetail } from "@/types/auction-session";
import { CheckInOtpDialog } from "./CheckInOtpDialog";

/**
 * Tự điểm danh cho phiên TRỰC TUYẾN — trang phiên và cổng phòng đấu giá.
 *
 * Chỉ hiện từ khi hồ sơ đủ điều kiện (đã duyệt + đã nhận tiền đặt trước); các
 * bước trước đó do thẻ hồ sơ tham gia nói. Giờ lấy theo MÁY CHỦ vì cửa sổ điểm
 * danh do server chấm — lệch đồng hồ máy là bấm "Điểm danh" ra window_closed.
 */

type SessionLike = Pick<
  PublicSessionDetail,
  "id" | "status" | "auction_format" | "starts_at" | "checkin_lead_minutes" | "checkin_grace_minutes" | "roster_closed_at"
>;

interface Props {
  session: SessionLike;
  /** Đang ở trong trang phòng đấu giá ⇒ không cần nút "Vào phòng". */
  inRoom?: boolean;
}

export function SelfCheckInCard({ session, inRoom }: Props) {
  const navigate = useNavigate();
  const now = useServerNow(1000);
  const { data: contract } = useMySessionContract(session.id);
  const [otpOpen, setOtpOpen] = useState(false);

  if (session.auction_format !== "truc_tuyen" || !contract) return null;

  const state = attendanceStateOf(contract, session, now);
  const { opensAt, closesAt } = checkinWindowOf(session);

  const content = () => {
    switch (state) {
      case "ticket_ready":
        return (
          <>
            <p className="text-sm text-muted-foreground">
              Điểm danh mở lúc <span className="font-medium text-foreground">{formatDateTime(opensAt.toISOString())}</span>{" "}
              (còn {formatDurationVi(opensAt.getTime() - now.getTime())}) và đóng lúc{" "}
              {formatDateTime(closesAt.toISOString())}. Ai chưa điểm danh khi đóng sẽ bị ghi vắng và mất tiền đặt trước.
            </p>
            <Button className="w-full" disabled>
              Chưa đến giờ điểm danh
            </Button>
          </>
        );
      case "checkin_open":
        return (
          <>
            <InfoBox variant="primary" className="text-sm">
              Đang mở điểm danh — đóng lúc{" "}
              <span className="font-semibold">{formatDateTime(closesAt.toISOString())}</span> (còn{" "}
              {formatDurationVi(closesAt.getTime() - now.getTime())}).
            </InfoBox>
            <Button className="h-11 w-full text-base font-semibold" onClick={() => setOtpOpen(true)}>
              Điểm danh
            </Button>
          </>
        );
      case "checked_in":
        return (
          <>
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Số báo danh</p>
              <p className="font-mono text-4xl font-bold tracking-widest text-primary">
                {formatBidderNo(contract.bidder_no) ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {contract.checkin_attendee && `${CHECKIN_ATTENDEE_LABELS[contract.checkin_attendee]} · `}
                điểm danh lúc {formatDateTime(contract.checked_in_at)}
              </p>
            </div>
            {!inRoom && session.status === "published" && (
              <Button className="w-full" variant="outline" onClick={() => navigate(`/sessions/${session.id}/dau-gia`)}>
                Vào phòng đấu giá
              </Button>
            )}
          </>
        );
      case "absent":
        return (
          <InfoBox variant="amber" className="text-sm">
            {BIDDER_BLOCK_MESSAGES.absent} Liên hệ tổ chức đấu giá nếu bạn có lý do chính đáng.
          </InfoBox>
        );
      case "excused":
        return (
          <InfoBox variant="muted" className="text-sm">
            Tổ chức đấu giá đã chấp nhận lý do vắng mặt — tiền đặt trước của bạn đang chờ hoàn trả.
          </InfoBox>
        );
      default:
        return null;
    }
  };

  const inner = content();

  return (
    <>
      {inner && (
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Điểm danh trực tuyến</p>
              <p className="text-xs text-muted-foreground">Điểm danh để nhận số báo danh và vào phòng đấu giá.</p>
            </div>
          </div>
          {inner}
        </Card>
      )}
      {/* Luôn gắn khi có hồ sơ: điểm danh xong hồ sơ đổi sang checked_in, dialog
          vẫn phải ở lại để hiện số báo danh. */}
      <CheckInOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        contract={contract}
        sessionId={session.id}
        inRoom={inRoom}
      />
    </>
  );
}

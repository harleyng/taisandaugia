import { AttendanceTicketDialog } from "@/components/bidding-contracts/AttendanceTicketDialog";
import type { TicketSession } from "@/lib/biddingContracts/attendanceTicket";
import type { BiddingContract } from "@/types/bidding-contract";
import { AbsenceAppealDialog } from "./AbsenceAppealDialog";
import { CheckInOtpDialog } from "./CheckInOtpDialog";

export type CheckinDialogKind = "checkin" | "ticket" | "appeal";

interface Props {
  kind: CheckinDialogKind | null;
  onClose: () => void;
  contract: BiddingContract;
  session: TicketSession & { id: string };
  lotNos?: number[] | null;
  inRoom?: boolean;
}

/**
 * Ba modal của luồng điểm danh phía người mua — điểm danh trực tuyến (OTP), phiếu
 * dự phiên (QR) và gửi lý do vắng — dùng chung cho trang phiên, danh sách và chi
 * tiết hồ sơ. Cả ba LUÔN được gắn: điểm danh xong hồ sơ đổi trạng thái, modal OTP
 * vẫn phải ở lại để hiện số báo danh.
 */
export function CheckinDialogs({ kind, onClose, contract, session, lotNos, inRoom }: Props) {
  const change = (open: boolean) => {
    if (!open) onClose();
  };
  return (
    <>
      <CheckInOtpDialog
        open={kind === "checkin"}
        onOpenChange={change}
        contract={contract}
        session={session}
        inRoom={inRoom}
      />
      <AttendanceTicketDialog
        open={kind === "ticket"}
        onOpenChange={change}
        contract={contract}
        session={session}
        lotNos={lotNos}
      />
      <AbsenceAppealDialog open={kind === "appeal"} onOpenChange={change} contract={contract} />
    </>
  );
}

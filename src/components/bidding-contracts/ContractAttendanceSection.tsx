import { useState } from "react";
import { Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { useServerNow } from "@/hooks/useServerClock";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { ATTENDANCE_STATE_LABELS, attendanceStateOf, type AttendanceState } from "@/lib/biddingContracts/eligibility";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { ContractWithSession } from "@/types/bidding-contract";
import { AttendanceTicketDialog } from "./AttendanceTicketDialog";

const REVIEW_STATES = new Set<AttendanceState>(["awaiting_review", "needs_info", "rejected"]);

/**
 * Khối dự phiên trên một hồ sơ ĐÃ THANH TOÁN (/profile?tab=auction-contracts):
 * số báo danh (cấp lúc điểm danh), tiền đặt trước, trạng thái dự phiên và nút
 * phiếu dự phiên. Duyệt hồ sơ / từ chối do ContractReviewNotice (S3) lo.
 */
export function ContractAttendanceSection({ contract }: { contract: ContractWithSession }) {
  const now = useServerNow(30_000);
  const [ticketOpen, setTicketOpen] = useState(false);
  const session = contract.auction_sessions;
  const state = session ? attendanceStateOf(contract, session, now) : null;
  const hasTicket = state === "ticket_ready" || state === "checkin_open";
  const bidderNo = contract.checked_in_at ? formatBidderNo(contract.bidder_no) : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Số báo danh</p>
          {bidderNo ? (
            <p className="font-mono text-2xl font-bold text-primary">{bidderNo}</p>
          ) : (
            <p className="text-muted-foreground">Cấp khi điểm danh</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tiền đặt trước</p>
          <DepositStatusBadge status={contract.deposit_status} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Thanh toán lúc</p>
          <p className="text-foreground">{formatDateTime(contract.paid_at)}</p>
        </div>
      </div>

      {/* Trạng thái duyệt (chờ duyệt / cần bổ sung / từ chối) do ContractReviewNotice hiện ngay phía trên. */}
      {state && !REVIEW_STATES.has(state) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Badge
              variant={state === "checked_in" || state === "checkin_open" ? "default" : state === "absent" ? "destructive" : "outline"}
            >
              {ATTENDANCE_STATE_LABELS[state]}
            </Badge>
            {state === "absent" && (
              <p className="text-xs text-muted-foreground">
                Không điểm danh trước giờ đóng — tiền đặt trước không được hoàn trả.
              </p>
            )}
            {state === "excused" && (
              <p className="text-xs text-muted-foreground">Tổ chức đấu giá chấp nhận lý do vắng — tiền đặt trước sẽ được hoàn trả.</p>
            )}
          </div>
          {hasTicket && (
            <Button size="sm" variant={state === "checkin_open" ? "default" : "outline"} className="gap-1.5" onClick={() => setTicketOpen(true)}>
              <Ticket className="h-4 w-4" />
              Phiếu dự phiên
            </Button>
          )}
        </div>
      )}

      <AttendanceTicketDialog contract={ticketOpen ? contract : null} onOpenChange={setTicketOpen} />
    </div>
  );
}

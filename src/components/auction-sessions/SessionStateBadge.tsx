import { Badge } from "@/components/ui/badge";
import { SessionStatusBadge } from "@/components/shared/SessionStatusBadge";
import { sessionPhaseOf, type SessionPublishStatus, type SessionTiming } from "@/lib/auctionSessions/phase";

interface Props {
  session: SessionTiming & { status: SessionPublishStatus };
  className?: string;
}

/**
 * Nhãn trạng thái một phiên. Nháp / đã huỷ là vòng đời CÔNG BỐ; phiên đã công bố
 * thì hiện GIAI ĐOẠN suy từ mốc thời gian (dùng lại badge của tin đấu giá).
 */
export function SessionStateBadge({ session, className }: Props) {
  if (session.status === "cancelled") {
    return (
      <Badge variant="destructive" className={className}>
        Đã huỷ
      </Badge>
    );
  }
  if (session.status === "draft") {
    return (
      <Badge variant="secondary" className={className}>
        Nháp
      </Badge>
    );
  }
  return <SessionStatusBadge status={sessionPhaseOf(session)} className={className} />;
}

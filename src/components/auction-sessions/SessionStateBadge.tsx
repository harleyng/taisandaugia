import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SessionStatusBadge } from "@/components/shared/SessionStatusBadge";
import { sessionPhaseOf, type SessionPublishStatus, type SessionTiming } from "@/lib/auctionSessions/phase";

interface Props {
  session: SessionTiming & { status: SessionPublishStatus; finalized_at?: string | null };
  className?: string;
}

/**
 * Nhãn trạng thái một phiên. Nháp / đã huỷ là vòng đời CÔNG BỐ; phiên đã công bố
 * thì hiện GIAI ĐOẠN suy từ mốc thời gian (dùng lại badge của tin đấu giá).
 *
 * "Đã chốt kết quả" thắng giai đoạn thời gian: chốt xong là trạng thái cuối,
 * trong khi sessionPhaseOf vẫn chỉ đọc được "đã kết thúc" từ ends_at. Lưu ý
 * `finalized_at` phải nằm trong select — xem bẫy ở đầu usePublicAuctionSessions.
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
  if (session.finalized_at) {
    return (
      <Badge variant="outline" className={cn("border-success/20 bg-success/10 text-success", className)}>
        Đã chốt kết quả
      </Badge>
    );
  }
  return <SessionStatusBadge status={sessionPhaseOf(session)} className={className} />;
}

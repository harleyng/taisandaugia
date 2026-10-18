import { AlertTriangle } from "lucide-react";
import { DetailNote } from "../DetailCard";
import { SessionInfoSummary } from "../SessionInfoSummary";
import { SessionScheduleCard } from "../SessionScheduleCard";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/**
 * Tab "Thông tin" — chỉ ĐỌC: Lịch phiên + Thông tin cơ bản + Hồ sơ & trả giá.
 * Sửa là trang form riêng (/portal/phien-dau-gia/:id/sua, nút "Chỉnh sửa" ở hero).
 *
 * Chỉ chứa thông tin khai báo của phiên; tài sản, tài liệu, hồ sơ là các tab
 * riêng vì mỗi thứ là một việc làm nhiều lần, thường do người khác phụ trách.
 */
export function SessionInfoTab({ session }: { session: AuctionSessionWithItems }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {session.status === "cancelled" && (
        <DetailNote icon={<AlertTriangle />}>
          Phiên đã huỷ{session.cancelled_reason ? ` — lý do: ${session.cancelled_reason}` : ""}. Phiên vẫn hiện trên sàn
          kèm lý do và không chỉnh sửa được nữa.
        </DetailNote>
      )}
      <SessionScheduleCard session={session} />
      <SessionInfoSummary session={session} />
    </div>
  );
}

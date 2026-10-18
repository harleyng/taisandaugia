import { SessionItemsCard } from "../SessionItemsCard";
import { sessionRowState } from "@/lib/auctionSessions/sessionList";
import type { AuctionSessionWithItems } from "@/types/auction-session";

interface Props {
  session: AuctionSessionWithItems;
  auctionOrgId: string | null;
  canUpdate: boolean;
}

/**
 * Tab "Tài sản" — danh sách lô. Thêm / sửa / gỡ lô được tới trước giờ đấu
 * (server chặn khi phiên huỷ hoặc đã bắt đầu trả giá); sau đó bảng chỉ còn để
 * xem kết quả từng lô.
 */
export function SessionItemsTab({ session, auctionOrgId, canUpdate }: Props) {
  const state = sessionRowState(session);
  const editable = state === "draft" || state === "reg" || state === "upcoming";
  return <SessionItemsCard session={session} auctionOrgId={auctionOrgId} canUpdate={canUpdate} editable={editable} />;
}

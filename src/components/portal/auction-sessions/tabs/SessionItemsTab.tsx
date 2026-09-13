import { SessionItemsCard } from "../SessionItemsCard";
import type { AuctionSessionWithItems } from "@/types/auction-session";

interface Props {
  session: AuctionSessionWithItems;
  auctionOrgId: string | null;
  canUpdate: boolean;
}

/**
 * Tab "Tài sản trong phiên" — danh sách lô.
 *
 * Thẻ tự có nút thêm / sửa / gỡ từng dòng nên KHÔNG chịu chế độ "Chỉnh sửa" của
 * tab Thông tin: thêm một lô là thao tác thường xuyên nhất của trang, bắt bấm
 * mở khoá trước là thêm một bước thừa.
 */
export function SessionItemsTab({ session, auctionOrgId, canUpdate }: Props) {
  return (
    <SessionItemsCard
      session={session}
      auctionOrgId={auctionOrgId}
      readOnly={session.status === "cancelled" || !canUpdate}
    />
  );
}

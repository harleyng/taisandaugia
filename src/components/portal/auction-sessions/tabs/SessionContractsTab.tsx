import { Card } from "@/components/ui/card";
import { SessionContractsCard } from "@/components/portal/bidding-contracts/SessionContractsCard";
import { SessionSaleContractsCard } from "../SessionSaleContractsCard";
import type { AuctionSessionWithItems } from "@/types/auction-session";

interface Props {
  session: AuctionSessionWithItems;
  canView: boolean;
  canUpdate: boolean;
}

/**
 * Tab "Hồ sơ tham gia" — hồ sơ người mua đã trả tiền, kèm hợp đồng mua bán sau
 * khi phiên chốt kết quả (cùng một mạch: người tham gia → người trúng → hợp
 * đồng), nên để chung tab thay vì đẻ thêm một tab chỉ hiện ở cuối vòng đời.
 */
export function SessionContractsTab({ session, canView, canUpdate }: Props) {
  // Phiên nháp không bao giờ có hồ sơ: chỉ bán được khi đã công bố.
  if (session.status === "draft" || !canView) {
    return (
      <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
        {session.status === "draft"
          ? "Phiên chưa công bố nên chưa bán được hồ sơ tham gia."
          : "Vai trò của bạn chưa được cấp quyền xem hồ sơ tham gia."}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <SessionContractsCard session={session} canUpdate={canUpdate} />
      {/* Thẻ tự ẩn khi phiên chưa chốt kết quả. */}
      {session.finalized_at && (
        <SessionSaleContractsCard sessionId={session.id} organizationId={session.organization_id} />
      )}
    </div>
  );
}

import { Gavel } from "lucide-react";
import { BiddingControlRoom } from "@/components/portal/bidding-control/BiddingControlRoom";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { controlGateOf } from "@/lib/bidding/controlAccess";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import { DetailEmpty } from "../DetailCard";

/**
 * Tab "Điều hành" (/portal/phien-dau-gia/:id/dieu-hanh — design pdg-ops `controlTab`, không có tiêu đề tab).
 *
 * Tab chỉ làm CỔNG TĨNH và giải quyết quyền; mọi thứ sống (realtime, đồng hồ,
 * mutation) nằm trong <BiddingControlRoom> — xem chú thích ở đó.
 *
 * LƯU Ý về quyền đọc phiên: trang cha đọc auction_sessions qua RLS vốn hỏi
 * `phien-dau-gia.view` chứ không phải `dieu-hanh-dau-gia.view`. Phiên ĐÃ CÔNG BỐ
 * còn có policy đọc công khai nên vẫn tải được; phiên nháp thì không, nhưng
 * phiên nháp cũng không có gì để điều hành nên cổng đã chặn từ trước.
 */
export function SessionControlTab({ session }: { session: AuctionSessionWithItems }) {
  // Xét theo tổ chức CỦA PHIÊN, không theo tổ chức đang chọn ở OrgSwitcher:
  // mở link phòng điều hành của tổ chức khác trong khi đang là OWNER của tổ
  // chức mình thì nếu hỏi nhầm chỗ sẽ bày ra nút mà server luôn từ chối.
  const orgId = session.organization_id;
  const canOperate = useHasOrgPermissionIn(orgId, "dieu-hanh-dau-gia", "operate");
  const canViewContracts = useHasOrgPermissionIn(orgId, "ho-so-tham-gia", "view");
  const canFinalize = useHasOrgPermissionIn(orgId, "dieu-hanh-dau-gia", "finalize");

  const gate = controlGateOf({ loading: false, session });

  switch (gate.kind) {
    // loading / not_found do trang cha xử lý trước khi dựng tab.
    case "loading":
    case "not_found":
      return null;

    case "not_online":
      return (
        <DetailEmpty icon={<Gavel />} title="Phiên đấu giá trực tiếp">
          Phiên tổ chức tại địa điểm đã công bố nên không có phòng điều hành trực tuyến.
        </DetailEmpty>
      );

    case "draft":
      return (
        <DetailEmpty icon={<Gavel />} title="Phiên chưa công bố">
          Chỉ điều hành được phiên đã công bố. Hoàn tất thông tin, thêm tài sản rồi công bố phiên.
        </DetailEmpty>
      );

    case "cancelled":
      return (
        <DetailEmpty icon={<Gavel />} title="Phiên đã huỷ">
          {session.cancelled_reason
            ? `Lý do: ${session.cancelled_reason}. Các tài sản còn lại đã được rút tự động.`
            : "Phiên này đã bị huỷ nên không còn điều hành được."}
        </DetailEmpty>
      );

    case "ready":
      return (
        <div className="flex min-w-0 flex-col gap-4">
          <BiddingControlRoom
            session={session}
            canOperate={canOperate}
            canViewContracts={canViewContracts}
            canFinalize={canFinalize}
          />
        </div>
      );
  }
}

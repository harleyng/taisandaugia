import { useNavigate } from "react-router-dom";
import { ExternalLink, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { BiddingControlRoom } from "@/components/portal/bidding-control/BiddingControlRoom";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { controlGateOf } from "@/lib/bidding/controlAccess";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/**
 * Tab "Điều hành phiên" — phòng điều hành phiên đấu giá trực tuyến.
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
  const navigate = useNavigate();

  // Xét theo tổ chức CỦA PHIÊN, không theo tổ chức đang chọn ở OrgSwitcher:
  // mở link phòng điều hành của tổ chức khác trong khi đang là OWNER của tổ
  // chức mình thì nếu hỏi nhầm chỗ sẽ bày ra nút mà server luôn từ chối.
  const orgId = session.organization_id;
  const canOperate = useHasOrgPermissionIn(orgId, "dieu-hanh-dau-gia", "operate");
  const canViewContracts = useHasOrgPermissionIn(orgId, "ho-so-tham-gia", "view");
  const canFinalize = useHasOrgPermissionIn(orgId, "dieu-hanh-dau-gia", "finalize");
  // Hoàn trả tiền đặt trước thuộc MODULE HỒ SƠ, không phải điều hành — cùng cách
  // org_mark_deposit_refunded gác quyền (xem chú thích useOrgBidding).
  const canRefund = useHasOrgPermissionIn(orgId, "ho-so-tham-gia", "update");

  const gate = controlGateOf({ loading: false, session });

  const notice = (title: string, body: string) => (
    <Card className="rounded-2xl p-10 text-center">
      <Gavel className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="mb-2 text-lg font-bold text-foreground">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{body}</p>
    </Card>
  );

  switch (gate.kind) {
    // loading / not_found do trang cha xử lý trước khi dựng tab.
    case "loading":
    case "not_found":
      return null;

    case "draft":
      return notice(
        "Phiên chưa được công bố",
        "Chỉ điều hành được phiên đã công bố. Hãy hoàn tất thông tin, thêm lô tài sản rồi công bố phiên.",
      );

    case "cancelled":
      return notice(
        "Phiên đã huỷ",
        session.cancelled_reason
          ? `Lý do: ${session.cancelled_reason}. Các lô còn lại đã được rút tự động.`
          : "Phiên này đã bị huỷ nên không còn điều hành được.",
      );

    case "not_online":
      return notice(
        "Phiên đấu giá trực tiếp",
        "Phiên được tổ chức trực tiếp tại địa điểm đã công bố nên không có phòng điều hành trực tuyến. Đổi hình thức sang trực tuyến hoặc kết hợp nếu muốn nhận trả giá qua sàn.",
      );

    case "ready":
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canOperate ? (
              <p className="text-sm text-muted-foreground">
                Mở lô, tạm dừng và chốt kết quả ngay tại đây; người trả giá thấy thay đổi theo thời gian thực.
              </p>
            ) : (
              <InfoBox variant="amber" className="flex-1 text-sm">
                Bạn có quyền theo dõi phiên nhưng không được điều hành.
              </InfoBox>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/sessions/${session.id}/dau-gia`)}
            >
              <ExternalLink className="h-4 w-4" />
              Phòng đấu giá trên sàn
            </Button>
          </div>

          <BiddingControlRoom
            session={session}
            canOperate={canOperate}
            canViewContracts={canViewContracts}
            canFinalize={canFinalize}
            canRefund={canRefund}
          />
        </div>
      );
  }
}

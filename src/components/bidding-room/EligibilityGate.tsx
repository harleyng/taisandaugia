import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { MY_CONTRACTS_PATH } from "@/lib/biddingContracts/paths";
import { BIDDER_BLOCK_MESSAGES, type BidderBlockReason } from "@/hooks/useMyBidderStatus";

/**
 * Cổng vào phòng đấu giá — CHẶN CẢ TRANG (người dùng chọn 2026-09-12).
 *
 * RLS vốn cho ai cũng đọc giá và lượt trả giá của phiên đã công bố, nhưng phòng
 * đấu giá chỉ mở cho người đủ điều kiện; ai chưa đủ thì xem thông tin phiên ở
 * /sessions/:id.
 *
 * Câu chữ lấy nguyên từ BIDDER_BLOCK_MESSAGES để trùng với nơi khác, ở đây chỉ
 * thêm VIỆC CẦN LÀM TIẾP cho từng lý do.
 */

interface Props {
  sessionId: string;
  reason: BidderBlockReason;
}

export function EligibilityGate({ sessionId, reason }: Props) {
  const navigate = useNavigate();
  const { openAuthDialog } = useAuthDialog();

  const sessionPath = `/sessions/${sessionId}`;

  const hint: Record<BidderBlockReason, string> = {
    login_required: "Đăng nhập bằng tài khoản đã mua hồ sơ tham gia phiên này.",
    no_contract: "Mua hồ sơ tham gia tại trang phiên, sau đó nộp tiền đặt trước để được cấp số báo danh.",
    unpaid: "Hoàn tất thanh toán hồ sơ tại trang phiên để tiếp tục.",
    no_deposit:
      "Tiền đặt trước nộp trực tiếp cho tổ chức đấu giá. Sau khi tổ chức ghi nhận, bạn sẽ được cấp số báo danh và vào được phòng đấu giá.",
    // Hai mã dưới thường KHÔNG tới đây: roomGateOf đưa người đã chốt sổ vào
    // nhánh chỉ-xem. Chúng chỉ rơi xuống đây khi hồ sơ chưa có số báo danh.
    settled: "Phiên đã kết thúc và chốt kết quả. Xem kết quả tại trang phiên.",
    refunded: "Tiền đặt trước của bạn đã được hoàn trả. Xem lại hồ sơ để đối chiếu.",
    no_bidder_no: "Số báo danh do tổ chức đấu giá cấp sau khi ghi nhận tiền đặt trước.",
  };

  const actions = () => {
    if (reason === "login_required") {
      return <Button className="w-full sm:w-auto" onClick={() => openAuthDialog()}>Đăng nhập</Button>;
    }
    return (
      <>
        <Button className="w-full sm:w-auto" onClick={() => navigate(sessionPath)}>
          {reason === "no_contract" ? "Mua hồ sơ tham gia" : "Về trang phiên"}
        </Button>
        {reason !== "no_contract" && (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(MY_CONTRACTS_PATH)}>
            Xem hồ sơ của tôi
          </Button>
        )}
      </>
    );
  };

  return (
    <Card className="mx-auto max-w-xl rounded-2xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-foreground">Chưa thể vào phòng đấu giá</h2>
      <p className="mb-1 text-sm font-medium text-foreground">{BIDDER_BLOCK_MESSAGES[reason]}</p>
      <p className="mb-6 text-sm text-muted-foreground">{hint[reason]}</p>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">{actions()}</div>
    </Card>
  );
}

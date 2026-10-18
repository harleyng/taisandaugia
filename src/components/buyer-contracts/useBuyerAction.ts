import { useNavigate } from "react-router-dom";
import type { BuyerActionKind } from "@/lib/biddingContracts/buyerContract";
import { myContractDepositPath, myContractPath, sessionRegistrationPath } from "@/lib/biddingContracts/paths";

/** Đi tới đúng màn cho việc tiếp theo của một hồ sơ (actionOf). */
export function useBuyerAction() {
  const navigate = useNavigate();
  return (kind: BuyerActionKind, c: { code: string; session_id: string }) => {
    switch (kind) {
      // Trang đăng ký tự mở lại bước thanh toán cho hồ sơ đang chờ.
      case "pay":
        return navigate(sessionRegistrationPath(c.session_id));
      case "deposit":
        return navigate(myContractDepositPath(c.code));
      case "room":
        return navigate(`/sessions/${c.session_id}/dau-gia`);
      case "result":
        return navigate(`/sessions/${c.session_id}`);
      case "resubmit":
        return navigate(`${myContractPath(c.code)}?bo-sung=1`);
      default:
        return navigate(myContractPath(c.code));
    }
  };
}

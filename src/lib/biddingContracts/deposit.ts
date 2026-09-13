// Tổ chức được đổi tiền đặt trước sang trạng thái nào, và nếu không thì vì sao.
//
// BẢN SAO PHÍA CLIENT của hai cổng ở DB, mà cổng thứ hai mới là cái hay bị quên:
//   1. org_set_contract_deposit (20260911000005:662) RAISE với mọi đích ngoài
//      bốn giá trị DepositActionStatus.
//   2. trigger auction_bidding_contracts_bidding_lock (20260913000001:326-343)
//      chặn MỌI thay đổi deposit_status ngoài RPC khi phiên đã chốt kết quả.
//
// Tách khỏi dialog để unit test được: bản cũ nằm trong JSX và kết thúc bằng một
// `return ["received"]` rơi tự do, nên hồ sơ `applied` / `pending_refund` (chỉ
// sinh ra sau khi chốt phiên) lại được mời "đưa về đã nhận" — một nút Lưu mà DB
// chắc chắn từ chối. Ở đây switch vét cạn, không còn nhánh rơi.

import type { DepositActionStatus, DepositStatus } from "@/types/bidding-contract";

export interface DepositActions {
  targets: DepositActionStatus[];
  /** Câu giải thích khi không còn thao tác nào — `null` khi có thao tác. */
  blockedNote: string | null;
}

export interface DepositActionContext {
  sessionCancelled: boolean;
  sessionFinalized: boolean;
}

const SETTLED_NOTE =
  "Phiên đã chốt kết quả — tiền đặt trước chỉ thay đổi qua màn điều hành đấu giá (xác nhận thanh toán, hoàn trả).";
const CANCELLED_NOTE = "Phiên đã huỷ — hồ sơ này không có tiền đặt trước cần hoàn trả.";

export function depositActionsFor(current: DepositStatus, ctx: DepositActionContext): DepositActions {
  // Xét TRƯỚC mọi nhánh khác: sau khi chốt, trigger chặn cả đường ghi thẳng.
  if (ctx.sessionFinalized) return { targets: [], blockedNote: SETTLED_NOTE };

  // Thắt lưng buộc bụng: hai trạng thái này chỉ tồn tại sau khi chốt, nhưng một
  // dòng `finalized_at` đọc trễ không được phép làm nút Lưu sống lại.
  if (current === "applied" || current === "pending_refund") {
    return { targets: [], blockedNote: SETTLED_NOTE };
  }

  if (ctx.sessionCancelled) {
    return current === "received"
      ? { targets: ["refunded"], blockedNote: null }
      : { targets: [], blockedNote: CANCELLED_NOTE };
  }

  switch (current) {
    case "pending":
      return { targets: ["received"], blockedNote: null };
    case "received":
      return { targets: ["refunded", "forfeited", "pending"], blockedNote: null };
    case "refunded":
    case "forfeited":
      return { targets: ["received"], blockedNote: null };
  }
}

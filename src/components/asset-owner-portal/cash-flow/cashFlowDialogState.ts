import type { CashKind } from "@/lib/ownerCashEvent";
import type { CashEvent, CashRow } from "@/lib/ownerCashFlow";

export type { CanWriteRow } from "@/lib/ownerCashFlow";

/** Một hộp thoại của trang "Thu tiền" tại một thời điểm. */
export type CashDialogState =
  /** Ghi khoản mới — có outcomeId ⇒ khoá tài sản; không ⇒ chọn trong danh sách. */
  | { kind: "record"; outcomeId: string | null; presetKind?: CashKind }
  | { kind: "edit"; event: CashEvent }
  | { kind: "delete"; event: CashEvent }
  | { kind: "due"; row: CashRow }
  /** "Người trúng bỏ cọc" — tài sản rời danh sách còn phải thu. */
  | { kind: "default"; row: CashRow };

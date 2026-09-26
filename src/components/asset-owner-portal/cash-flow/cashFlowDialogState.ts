import type { CashKind } from "@/lib/ownerCashEvent";
import type { CashEvent, CashRow } from "@/lib/ownerCashFlow";

/** Một hộp thoại của trang "Dòng tiền" tại một thời điểm. */
export type CashDialogState =
  /** Ghi khoản mới — có outcomeId ⇒ khoá tài sản; không ⇒ chọn trong danh sách. */
  | { kind: "record"; outcomeId: string | null; presetKind?: CashKind }
  | { kind: "edit"; event: CashEvent }
  | { kind: "delete"; event: CashEvent }
  | { kind: "due"; row: CashRow };

/** Quyền ghi của người xem trên một dòng (đơn vị của mình + phạm vi chi nhánh). */
export type CanWriteRow = (unitId: string, branchId: string | null) => boolean;

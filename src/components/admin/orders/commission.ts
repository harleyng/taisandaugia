// Tính hoa hồng để xem trước trên form đơn hàng.
//
// Tách khỏi OrderCommissionFields.tsx: file component chỉ nên xuất component
// (rule react-refresh/only-export-components), và OrderFormDialog cần hàm này
// mà không cần JSX.

import type { CommissionType } from "@/types/orders";

/** Bản xem trước phải khớp CÔNG THỨC TRIGGER trong DB:
 *  percent → round(gross * value / 100) · fixed → round(value * quantity) */
export const previewCommission = (
  type: CommissionType,
  value: number,
  gross: number,
  quantity: number,
): number =>
  type === "percent" ? Math.round((gross * value) / 100) : Math.round(value * quantity);

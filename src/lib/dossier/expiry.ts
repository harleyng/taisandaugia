// Hạn chứng thư thẩm định giá (docs/owner-dossier-plan.md §A6) — chỉ để HIỂN THỊ huy hiệu.
// Điểm và trạng thái 'expired' do SQL tính; ở đây chỉ thêm mức "sắp hết hạn" (không ảnh hưởng điểm).

import { differenceInCalendarDays, parseISO } from "date-fns";
import { APPRAISAL_EXPIRY_WARNING_DAYS } from "./types";

export type AppraisalExpiry = "valid" | "expiring" | "expired";

/**
 * `validUntil` là ngày "yyyy-MM-dd" (hết hiệu lực SAU ngày đó). null ⇒ không có huy hiệu.
 * Hôm nay vẫn còn hiệu lực — khớp `valid_until >= current_date` của SQL.
 */
export function appraisalExpiryOf(validUntil: string | null | undefined, today: Date = new Date()): AppraisalExpiry | null {
  if (!validUntil) return null;
  const days = differenceInCalendarDays(parseISO(validUntil), today);
  if (Number.isNaN(days)) return null;
  if (days < 0) return "expired";
  return days <= APPRAISAL_EXPIRY_WARNING_DAYS ? "expiring" : "valid";
}

export const APPRAISAL_EXPIRY_LABEL: Record<Exclude<AppraisalExpiry, "valid">, string> = {
  expiring: "Chứng thư sắp hết hạn",
  expired: "Chứng thư đã hết hạn — cần thẩm định lại",
};

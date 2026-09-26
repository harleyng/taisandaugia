// Trạng thái lần tư vấn: Chờ báo giá → Báo giá → Đã thanh toán → Đang rà soát → Đã có kết quả.

import type { ChecklistItemStatus, LegalConsultation, LegalConsultStatus } from "@/types/legalConsult";

export const TVPL_STATUS_LABELS: Record<LegalConsultStatus, string> = {
  requested: "Chờ báo giá",
  quoted: "Báo giá",
  paid: "Đã thanh toán",
  in_review: "Đang rà soát",
  completed: "Đã có kết quả",
  superseded: "Phiên bản cũ",
  cancelled: "Đã huỷ",
};

export const TVPL_FLOW: LegalConsultStatus[] = ["requested", "quoted", "paid", "in_review", "completed"];

export const TVPL_ACTIVE_STATUSES: LegalConsultStatus[] = ["requested", "quoted", "paid", "in_review"];

/** Sàn / chuyên gia đang phải làm ⇒ phía người bán hỏi lại định kỳ. */
export const TVPL_WAITING_ON_PLATFORM: LegalConsultStatus[] = ["requested", "paid", "in_review"];

export const ITEM_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  sufficient: "Đủ",
  missing: "Thiếu",
  needs_clarification: "Cần làm rõ",
};

/** Thứ tự hiển thị cho người bán: việc cần làm lên đầu. */
export const ITEM_STATUS_ORDER: ChecklistItemStatus[] = ["missing", "needs_clarification", "sufficient"];

export const tvplStatusLabel = (s: string) => TVPL_STATUS_LABELS[s as LegalConsultStatus] ?? s;
export const itemStatusLabel = (s: string | null | undefined) =>
  s ? (ITEM_STATUS_LABELS[s as ChecklistItemStatus] ?? s) : "Chưa chấm";

export const tvplStepIndex = (status: string) => TVPL_FLOW.indexOf(status as LegalConsultStatus);

export const isTvplQuoteExpired = (o: Pick<LegalConsultation, "quote_expires_at">, now = Date.now()) =>
  !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() < now;

/** "Việc tiếp theo" của vận hành sàn. */
export function tvplNextAction(o: Pick<LegalConsultation, "status">): string {
  switch (o.status) {
    case "requested":
      return "Phân công chuyên gia & báo giá";
    case "quoted":
      return "Chờ người bán thanh toán";
    case "paid":
      return "Bắt đầu rà soát";
    case "in_review":
      return "Chấm checklist & hoàn tất";
    default:
      return "—";
  }
}

/** Lần đang chạy + kết quả hiện hành + lịch sử phiên bản (danh sách mới nhất trước). */
export function summarizeConsultations(rows: LegalConsultation[]) {
  const versions = rows
    .filter((r) => (r.status === "completed" || r.status === "superseded") && r.version != null)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  return {
    active: rows.find((r) => TVPL_ACTIVE_STATUSES.includes(r.status as LegalConsultStatus)) ?? null,
    current: rows.find((r) => r.status === "completed") ?? null,
    versions,
  };
}

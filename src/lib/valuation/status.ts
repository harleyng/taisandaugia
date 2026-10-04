// Trạng thái đơn thẩm định giá: Chờ báo giá → Báo giá → Đã thanh toán → Đang thẩm định → Đã có chứng thư.

import type { ValuationMethod, ValuationOrder, ValuationPurpose, ValuationStatus } from "@/types/valuation";

export const TDG_STATUS_LABELS: Record<ValuationStatus, string> = {
  requested: "Chờ báo giá",
  quoted: "Báo giá",
  paid: "Đã thanh toán",
  in_review: "Đang thẩm định",
  completed: "Đã có chứng thư",
  superseded: "Kết quả cũ",
  cancelled: "Đã huỷ",
};

export const TDG_FLOW: ValuationStatus[] = ["requested", "quoted", "paid", "in_review", "completed"];

export const TDG_ACTIVE_STATUSES: ValuationStatus[] = ["requested", "quoted", "paid", "in_review"];

/** Sàn / đơn vị thẩm định đang phải làm ⇒ phía người bán hỏi lại định kỳ. */
export const TDG_WAITING_ON_PLATFORM: ValuationStatus[] = ["requested", "paid", "in_review"];

export const PURPOSE_LABELS: Record<ValuationPurpose, string> = {
  auction: "Làm căn cứ đấu giá",
  mortgage: "Thế chấp / vay vốn",
  transfer: "Chuyển nhượng / mua bán",
  other: "Mục đích khác",
};

export const METHOD_LABELS: Record<ValuationMethod, string> = {
  comparison: "Phương pháp so sánh",
  cost: "Phương pháp chi phí",
  income: "Phương pháp thu nhập",
  mixed: "Kết hợp nhiều phương pháp",
};

export const tdgStatusLabel = (s: string) => TDG_STATUS_LABELS[s as ValuationStatus] ?? s;
export const purposeLabel = (s: string | null | undefined) =>
  s ? (PURPOSE_LABELS[s as ValuationPurpose] ?? s) : "—";
export const methodLabel = (s: string | null | undefined) =>
  s ? (METHOD_LABELS[s as ValuationMethod] ?? s) : "—";

export const tdgStepIndex = (status: string) => TDG_FLOW.indexOf(status as ValuationStatus);

export const isTdgQuoteExpired = (o: Pick<ValuationOrder, "quote_expires_at">, now = Date.now()) =>
  !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() < now;

/** "Việc tiếp theo" của vận hành sàn. */
export function tdgNextAction(o: Pick<ValuationOrder, "status">): string {
  switch (o.status) {
    case "requested":
      return "Phân công đơn vị & báo giá";
    case "quoted":
      return "Chờ người bán thanh toán";
    case "paid":
      return "Bắt đầu thẩm định";
    case "in_review":
      return "Nhập kết quả & chứng thư";
    default:
      return "—";
  }
}

/** Đơn đang chạy + kết quả hiện hành + lịch sử kết quả (mới nhất trước). */
export function summarizeValuations(rows: ValuationOrder[]) {
  const history = rows
    .filter((r) => r.status === "completed" || r.status === "superseded")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  return {
    active: rows.find((r) => TDG_ACTIVE_STATUSES.includes(r.status as ValuationStatus)) ?? null,
    current: rows.find((r) => r.status === "completed") ?? null,
    history,
  };
}

// Trạng thái đơn VR tour (BR-VR-01): Báo giá → Đã thanh toán → Đã hẹn → Đã giao → Đã gắn lô.
// "Chờ báo giá" là bước trước báo giá vì giá do sàn báo riêng cho từng đơn.

import type { VrTourOrder, VrTourStatus } from "@/types/vrTour";

export const VR_STATUS_LABELS: Record<VrTourStatus, string> = {
  requested: "Chờ báo giá",
  quoted: "Báo giá",
  paid: "Đã thanh toán",
  scheduled: "Đã hẹn",
  delivered: "Đã giao",
  attached: "Đã gắn lô",
  superseded: "Đã thay thế",
  cancelled: "Đã huỷ",
};

/** Các bước hiển thị trên stepper, theo đúng thứ tự BR-VR-01. */
export const VR_FLOW: VrTourStatus[] = ["requested", "quoted", "paid", "scheduled", "delivered", "attached"];

/** Đơn còn đang chạy — mỗi hồ sơ tối đa một (unique index ở DB). */
export const VR_ACTIVE_STATUSES: VrTourStatus[] = ["requested", "quoted", "paid", "scheduled", "delivered"];

/** Trạng thái sàn đang phải làm gì đó ⇒ phía người bán hỏi lại định kỳ. */
export const VR_WAITING_ON_PLATFORM: VrTourStatus[] = ["requested", "paid", "scheduled", "delivered"];

export const vrStatusLabel = (s: string) => VR_STATUS_LABELS[s as VrTourStatus] ?? s;

export function vrStepIndex(status: string): number {
  return VR_FLOW.indexOf(status as VrTourStatus);
}

export const isQuoteExpired = (o: Pick<VrTourOrder, "quote_expires_at">, now = Date.now()) =>
  !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() < now;

/** "Việc tiếp theo" của vận hành sàn cho một đơn. */
export function vrNextAction(status: string, postingReviewStatus?: string | null): string {
  switch (status) {
    case "requested":
      return "Sàn báo giá";
    case "quoted":
      return "Chờ người bán thanh toán";
    case "paid":
      return "Hẹn lịch với đối tác";
    case "scheduled":
      return "Nhận link từ đối tác";
    case "delivered":
      return postingReviewStatus === "approved" ? "Duyệt & gắn vào lô" : "Chờ duyệt hồ sơ tài sản";
    default:
      return "—";
  }
}

/** Đơn đang chạy + tour đang gắn + đơn gần nhất của một hồ sơ (danh sách mới nhất trước). */
export function summarizeVrOrders(orders: VrTourOrder[]) {
  return {
    active: orders.find((o) => VR_ACTIVE_STATUSES.includes(o.status as VrTourStatus)) ?? null,
    attached: orders.find((o) => o.status === "attached") ?? null,
    latest: orders[0] ?? null,
  };
}

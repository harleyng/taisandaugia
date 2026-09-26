// Trạng thái đơn giám định: Chờ báo giá → Báo giá → Đã thanh toán → Gửi hiện vật / Đã hẹn
// → Đang giám định → Đã có kết quả. "Từ ảnh" bỏ qua bước hiện vật.

import type {
  AuthenticationMethod,
  AuthenticationOrder,
  AuthenticationStatus,
  AuthenticationVerdict,
} from "@/types/authentication";

export const GD_STATUS_LABELS: Record<AuthenticationStatus, string> = {
  requested: "Chờ báo giá",
  quoted: "Báo giá",
  paid: "Đã thanh toán",
  item_pending: "Chờ hiện vật",
  in_review: "Đang giám định",
  completed: "Đã có kết quả",
  superseded: "Đã thay thế",
  cancelled: "Đã huỷ",
};

export const GD_METHOD_LABELS: Record<AuthenticationMethod, string> = {
  from_photos: "Từ ảnh",
  ship_item: "Gửi hiện vật",
  on_site: "Tại chỗ",
};

export const GD_METHOD_DESCRIPTIONS: Record<AuthenticationMethod, string> = {
  from_photos: "Đối tác giám định dựa trên ảnh & video trong hồ sơ. Nhanh nhất, mức xác minh 3.",
  ship_item: "Bạn gửi hiện vật tới đối tác sau khi thanh toán. Mức xác minh 4.",
  on_site: "Chuyên gia tới tận nơi xem hiện vật. Mức xác minh 4.",
};

export const GD_VERDICT_LABELS: Record<AuthenticationVerdict, string> = {
  authentic: "Xác thực",
  inconclusive: "Không xác thực được",
  suspected_fake: "Nghi giả",
};

export const GD_ACTIVE_STATUSES: AuthenticationStatus[] = ["requested", "quoted", "paid", "item_pending", "in_review"];

/** Trạng thái sàn / đối tác đang phải làm ⇒ phía người bán hỏi lại định kỳ. */
export const GD_WAITING_ON_PLATFORM: AuthenticationStatus[] = ["requested", "item_pending", "in_review"];

export const gdStatusLabel = (s: string) => GD_STATUS_LABELS[s as AuthenticationStatus] ?? s;
export const gdMethodLabel = (m: string) => GD_METHOD_LABELS[m as AuthenticationMethod] ?? m;
export const gdVerdictLabel = (v: string | null | undefined) =>
  v ? (GD_VERDICT_LABELS[v as AuthenticationVerdict] ?? v) : "—";

export const isNegativeVerdict = (v: string | null | undefined) => v === "inconclusive" || v === "suspected_fake";

/** Các bước của stepper theo phương thức. */
export function gdFlow(method: string): AuthenticationStatus[] {
  return method === "from_photos"
    ? ["requested", "quoted", "paid", "in_review", "completed"]
    : ["requested", "quoted", "paid", "item_pending", "in_review", "completed"];
}

export function gdStepIndex(method: string, status: string): number {
  return gdFlow(method).indexOf(status as AuthenticationStatus);
}

export const isQuoteExpired = (o: Pick<AuthenticationOrder, "quote_expires_at">, now = Date.now()) =>
  !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() < now;

/** "Việc tiếp theo" của vận hành sàn cho một đơn. */
export function gdNextAction(o: Pick<AuthenticationOrder, "status" | "method" | "shipment_tracking">): string {
  switch (o.status) {
    case "requested":
      return "Sàn báo giá";
    case "quoted":
      return "Chờ người bán thanh toán";
    case "paid":
      if (o.method === "from_photos") return "Bắt đầu giám định";
      if (o.method === "on_site") return "Hẹn lịch giám định tại chỗ";
      return "Chờ người bán gửi hiện vật";
    case "item_pending":
      return o.method === "on_site" ? "Xác nhận đã giám định tại chỗ" : "Xác nhận đã nhận hiện vật";
    case "in_review":
      return "Tải chứng thư & kết luận";
    default:
      return "—";
  }
}

/** Đơn đang chạy + kết luận hiện hành + đơn gần nhất (danh sách mới nhất trước). */
export function summarizeGdOrders(orders: AuthenticationOrder[]) {
  return {
    active: orders.find((o) => GD_ACTIVE_STATUSES.includes(o.status as AuthenticationStatus)) ?? null,
    completed: orders.find((o) => o.status === "completed") ?? null,
    latest: orders[0] ?? null,
  };
}

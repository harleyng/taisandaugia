// Trạng thái yêu cầu tư vấn đấu giá: Chờ báo giá → Báo giá → Đã thanh toán → Đang xây dựng
// phương án → Đã có đề xuất. Quyết định của người bán (Chấp nhận / Không sử dụng) tách riêng.

import { isQuoteExpired } from "@/lib/vrTour/status";
import type { AuctionConsultation, AuctionConsultStatus, SellerDecision } from "@/types/auctionConsult";

export const TVDG_STATUS_LABELS: Record<AuctionConsultStatus, string> = {
  requested: "Chờ báo giá",
  quoted: "Báo giá",
  paid: "Đã thanh toán",
  in_review: "Đang xây dựng phương án",
  completed: "Đã có đề xuất",
  superseded: "Phiên bản cũ",
  cancelled: "Đã huỷ",
};

export const TVDG_FLOW: AuctionConsultStatus[] = ["requested", "quoted", "paid", "in_review", "completed"];

export const TVDG_ACTIVE_STATUSES: AuctionConsultStatus[] = ["requested", "quoted", "paid", "in_review"];

/** Sàn / chuyên gia đang phải làm ⇒ phía người bán hỏi lại định kỳ. */
export const TVDG_WAITING_ON_PLATFORM: AuctionConsultStatus[] = ["requested", "paid", "in_review"];

export const SELLER_DECISION_LABELS: Record<SellerDecision, string> = {
  pending: "Chờ người bán quyết định",
  accepted: "Đã chấp nhận",
  declined: "Không sử dụng",
};

export const tvdgStatusLabel = (s: string) => TVDG_STATUS_LABELS[s as AuctionConsultStatus] ?? s;
export const decisionLabel = (s: string) => SELLER_DECISION_LABELS[s as SellerDecision] ?? s;

export const tvdgStepIndex = (status: string) => TVDG_FLOW.indexOf(status as AuctionConsultStatus);

export const isTvdgQuoteExpired = (o: Pick<AuctionConsultation, "quote_expires_at">, now = Date.now()) =>
  isQuoteExpired(o, now);

/** "Việc tiếp theo" của vận hành sàn. */
export function tvdgNextAction(o: Pick<AuctionConsultation, "status">): string {
  switch (o.status) {
    case "requested":
      return "Phân công chuyên gia & báo giá";
    case "quoted":
      return "Chờ người bán thanh toán";
    case "paid":
      return "Bắt đầu xây dựng phương án";
    case "in_review":
      return "Soạn phương án & hoàn tất";
    default:
      return "—";
  }
}

/** Đề xuất chỉ thành dữ liệu gợi ý khi là bản hiện hành VÀ người bán đã chấp nhận (BR-CNS-06). */
export const isSuggestionSource = (o: Pick<AuctionConsultation, "status" | "seller_decision">) =>
  o.status === "completed" && o.seller_decision === "accepted";

/** Yêu cầu đang chạy + đề xuất hiện hành + lịch sử phiên bản (mới nhất trước). */
export function summarizeAuctionConsultations(rows: AuctionConsultation[]) {
  const versions = rows
    .filter((r) => (r.status === "completed" || r.status === "superseded") && r.version != null)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  return {
    active: rows.find((r) => TVDG_ACTIVE_STATUSES.includes(r.status as AuctionConsultStatus)) ?? null,
    current: rows.find((r) => r.status === "completed") ?? null,
    versions,
  };
}

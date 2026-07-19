// Nhãn + màu + cấu hình cột kanban cho Cơ hội.
// 5 cột khớp ảnh thiết kế: Bán hàng · Chờ xét duyệt · Bị từ chối · Thành công · Thất bại.

import type { OpportunityStage, OpportunityType, RevenueMode } from "@/types/opportunities";

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  selling: "Bán hàng",
  pending_approval: "Chờ xét duyệt",
  rejected: "Bị từ chối",
  won: "Thành công",
  lost: "Thất bại",
};

export const STAGE_BADGE_CLASS: Record<OpportunityStage, string> = {
  selling: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  rejected: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

/** Vạch màu đầu cột kanban. */
export const STAGE_ACCENT: Record<OpportunityStage, string> = {
  selling: "bg-blue-500",
  pending_approval: "bg-amber-500",
  rejected: "bg-orange-500",
  won: "bg-green-500",
  lost: "bg-red-500",
};

/** Thứ tự cột trên bảng — cố định, không đọc từ dữ liệu. */
export const STAGE_ORDER: OpportunityStage[] = [
  "selling", "pending_approval", "rejected", "won", "lost",
];

export const TYPE_LABELS: Record<OpportunityType, string> = {
  new_business: "Hợp đồng mới",
  renewal: "Gia hạn",
  upsell: "Nâng cấp",
  cross_sell: "Bán chéo",
  referral: "Giới thiệu",
};

export const REVENUE_MODE_LABELS: Record<RevenueMode, string> = {
  order: "Đã sinh đơn hàng",
  credit_ledger: "Chờ khách nạp credit",
  none: "Chưa ghi nhận",
};

/** Giai đoạn kết thúc — không kéo ra khỏi đây bằng thao tác thường. */
export const isClosed = (s: OpportunityStage): boolean =>
  s === "won" || s === "lost" || s === "rejected";

/** Thua/từ chối bắt buộc có lý do (CHECK ở DB) ⇒ phải mở dialog hỏi. */
export const needsLostReason = (s: OpportunityStage): boolean =>
  s === "lost" || s === "rejected";

/** Quá hạn: còn đang mở mà đã qua ngày dự kiến chốt.
 *  Tính phía client — now() không IMMUTABLE nên không làm generated column được. */
export const isOverdue = (stage: OpportunityStage, expectedCloseAt: string | null): boolean =>
  !isClosed(stage) && !!expectedCloseAt && new Date(expectedCloseAt) < new Date();

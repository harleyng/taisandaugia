// Nhãn + màu + tab cho trạng thái duyệt hồ sơ tài sản, theo khuôn
// src/lib/leads/leadStatus.ts (tách file, không nhét inline như 2 màn KYC cũ).

import type { AssetPostingReviewStatus } from "@/types/asset-posting";

export const REVIEW_STATUS_LABELS: Record<AssetPostingReviewStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

// Giữ đúng bảng màu duyệt của khu admin: amber = chờ, green = duyệt, red = từ chối.
export const REVIEW_STATUS_BADGE_CLASS: Record<AssetPostingReviewStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export type ReviewStatusFilter = AssetPostingReviewStatus | "all";

export const REVIEW_STATUS_TABS: { key: ReviewStatusFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
];

/** Lý do từ chối hay gặp — chip bấm nhanh, admin vẫn sửa/ghi thêm được. */
export const REJECT_REASON_PRESETS = [
  "Giấy tờ chứng minh sở hữu không rõ nét",
  "Thiếu giấy tờ pháp lý bắt buộc",
  "Thông tin tài sản chưa khớp giấy tờ",
  "Tài sản đang tranh chấp / kê biên",
  "Ảnh tài sản không đủ hoặc không đúng tài sản",
];

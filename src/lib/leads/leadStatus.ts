// Nhãn + màu + tab cho Khách hàng tiềm năng, theo khuôn src/lib/advertising/adStatus.ts.

import type { LeadStatus, LeadSource } from "@/types/leads";
import { SEGMENT_LABELS } from "@/lib/customers/customerSegment";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  qualified: "Đủ điều kiện",
  nurturing: "Đang nuôi dưỡng",
  converted: "Đã chuyển đổi",
  disqualified: "Không phù hợp",
};

export const STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-600",
  contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-blue-100 text-blue-700",
  nurturing: "bg-violet-100 text-violet-700",
  converted: "bg-green-100 text-green-700",
  disqualified: "bg-gray-200 text-gray-600",
};

export interface StatusTab {
  key: LeadStatus | "all";
  label: string;
}

export const STATUS_TABS: StatusTab[] = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Mới" },
  { key: "contacted", label: "Đã liên hệ" },
  { key: "qualified", label: "Đủ điều kiện" },
  { key: "converted", label: "Đã chuyển đổi" },
  { key: "disqualified", label: "Không phù hợp" },
];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  contact_form: "Form liên hệ",
  partnership_form: "Đăng ký hợp tác",
  hotline: "Hotline",
  email: "Email",
  referral: "Giới thiệu",
  event: "Sự kiện",
  ads: "Quảng cáo",
  tool_marketplace: "Công cụ đấu giá",
  other: "Khác",
};

/** Loại lead dùng chung từ vựng với phân khúc khách hàng (chuyển đổi copy 1:1). */
export const LEAD_TYPE_LABELS = SEGMENT_LABELS;

/** Đã chuyển đổi thì khoá sửa — con trỏ sang khách hàng do RPC quản. */
export const isConverted = (s: LeadStatus): boolean => s === "converted";

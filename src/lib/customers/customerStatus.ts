// Nhãn + màu + tab trạng thái Khách hàng, theo khuôn src/lib/leads/leadStatus.ts.

import type { CustomerStatus, CustomerType } from "@/types/customers";

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Ngừng",
};

export const STATUS_BADGE_CLASS: Record<CustomerStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
};

export interface StatusTab {
  key: CustomerStatus | "all";
  label: string;
}

export const STATUS_TABS: StatusTab[] = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang hoạt động" },
  { key: "inactive", label: "Ngừng" },
];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Cá nhân",
  company: "Công ty",
};

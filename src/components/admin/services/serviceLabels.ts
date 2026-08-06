// Nhãn tiếng Việt cho nhóm dịch vụ và đối tượng.
//
// Tách khỏi ServiceKindBadge.tsx: file component chỉ nên xuất component, nếu
// không React Fast Refresh phải reload cả module thay vì thay component tại chỗ
// (rule react-refresh/only-export-components). Các hằng này còn được dùng ở
// lib/reports/revenueReport.ts và TopVariantsTable — nơi không cần JSX.

import type { ServiceAudience } from "@/types/orders";

/** Nhãn tiếng Việt cho nhóm dịch vụ (category). */
export const CATEGORY_LABELS: Record<string, string> = {
  package: "Gói credit",
  unlock: "Tính năng credit",
  feature: "Tính năng theo lượt",
  advertising: "Quảng cáo",
  brokerage: "Môi giới",
};

export const categoryLabel = (c: string | null | undefined): string =>
  (c && CATEGORY_LABELS[c]) || c || "—";

export const AUDIENCE_LABELS: Record<ServiceAudience, string> = {
  buyer: "Người mua",
  owner: "Chủ tài sản",
  company: "Công ty đấu giá",
  all: "Dùng chung",
};

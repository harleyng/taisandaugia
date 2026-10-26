// Đường dẫn của menu "Số hoá tài sản" (cổng chủ tài sản).

import { ownerPostingPath } from "@/lib/vrTour/paths";

export const OWNER_POSTINGS_PATH = "/chu-tai-san/dang-tai-san";

/** Chi tiết một hồ sơ số hoá (định nghĩa gốc ở lib/vrTour/paths — trang thanh toán quay về đây). */
export { ownerPostingPath };

/** Tham số mở wizard cho một hồ sơ ĐÃ LƯU (tiếp tục nháp / sửa hồ sơ). */
export const WIZARD_POSTING_PARAM = "ho-so";

export const ownerPostingWizardPath = (postingId: string) =>
  `${OWNER_POSTINGS_PATH}?${WIZARD_POSTING_PARAM}=${encodeURIComponent(postingId)}`;

/**
 * Tham số mở wizard TẠO MỚI, điền trước từ một mục của kế hoạch đấu giá
 * ("Tạo hồ sơ số hoá từ mục này", Phase 5). Wizard chỉ nhận GIÁ TRỊ ĐẦU —
 * luật kiểm tra của wizard KHÔNG đổi.
 */
export const WIZARD_PLAN_ITEM_PARAM = "tu-ke-hoach";

export const ownerPostingFromPlanItemPath = (planItemId: string) =>
  `${OWNER_POSTINGS_PATH}?${WIZARD_PLAN_ITEM_PARAM}=${encodeURIComponent(planItemId)}`;

/** Trang in / lưu PDF của một hồ sơ (ngoài layout cổng). */
export const ownerPostingPrintPath = (postingId: string) => `${OWNER_POSTINGS_PATH}/${encodeURIComponent(postingId)}/in`;

// Đường dẫn của menu "Số hoá tài sản" (cổng chủ tài sản).

import { ownerPostingPath } from "@/lib/vrTour/paths";

export const OWNER_POSTINGS_PATH = "/chu-tai-san/dang-tai-san";

/** Chi tiết một hồ sơ số hoá (định nghĩa gốc ở lib/vrTour/paths — trang thanh toán quay về đây). */
export { ownerPostingPath };

/** Tham số mở wizard cho một hồ sơ ĐÃ LƯU (tiếp tục nháp / sửa hồ sơ). */
export const WIZARD_POSTING_PARAM = "ho-so";

export const ownerPostingWizardPath = (postingId: string) =>
  `${OWNER_POSTINGS_PATH}?${WIZARD_POSTING_PARAM}=${encodeURIComponent(postingId)}`;

/** Trang in / lưu PDF của một hồ sơ (ngoài layout cổng). */
export const ownerPostingPrintPath = (postingId: string) => `${OWNER_POSTINGS_PATH}/${encodeURIComponent(postingId)}/in`;

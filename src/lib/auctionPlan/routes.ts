// Đường dẫn + tab của module "Kế hoạch đấu giá" (A6 của docs/owner-auction-planning-plan.md).
//
// Gom ở đây vì nav, trang danh sách, trang chi tiết và các hộp thoại đều điều
// hướng tới nhau — gõ tay mỗi chỗ là cách chắc nhất để một hôm nút "Xem" trỏ
// vào trang trắng.

export const OWNER_PLANS_HREF = "/chu-tai-san/ke-hoach";

export const ownerPlanHref = (id: string) => `${OWNER_PLANS_HREF}/${id}`;

/** Trang in bản kế hoạch theo mẫu chính thức — Phase 4 dựng trang này. */
export const ownerPlanPrintHref = (id: string) => `${OWNER_PLANS_HREF}/${id}/in`;

/** "Vận hành tháng" (Phase 6) — việc của MỌI kế hoạch trong một tháng. */
export const OWNER_PLAN_OPS_HREF = `${OWNER_PLANS_HREF}/van-hanh`;

export const ownerPlanOpsHref = (periodKey?: string) =>
  periodKey ? `${OWNER_PLAN_OPS_HREF}?ky=${periodKey}` : OWNER_PLAN_OPS_HREF;

/** Tab của trang chi tiết (`?tab=`). Thứ tự đúng bằng A6. */
export const PLAN_TABS = ["danh-muc", "tien-do", "theo-ky", "phe-duyet"] as const;

export type PlanTab = (typeof PLAN_TABS)[number];

export const PLAN_TAB_LABELS: Record<PlanTab, string> = {
  "danh-muc": "Danh mục tài sản",
  "tien-do": "Tiến độ",
  "theo-ky": "Theo kỳ",
  "phe-duyet": "Phê duyệt & lịch sử",
};

export const ownerPlanTabHref = (id: string, tab: PlanTab) =>
  tab === PLAN_TABS[0] ? ownerPlanHref(id) : `${ownerPlanHref(id)}?tab=${tab}`;

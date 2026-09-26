/** Chế độ xem trang "Đường ống" (/chu-tai-san/tai-san) — ghi nhớ theo trình duyệt. */
export const OWNER_ASSETS_VIEWS = ["table", "kanban"] as const;
export type OwnerAssetsView = (typeof OWNER_ASSETS_VIEWS)[number];
export const OWNER_ASSETS_VIEW_KEY = "owner-assets-view";

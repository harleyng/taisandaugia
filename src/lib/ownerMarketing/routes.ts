// Đường dẫn module Truyền thông (/chu-tai-san/truyen-thong).

export const OWNER_MARKETING_HREF = "/chu-tai-san/truyen-thong";

/**
 * 3 tab của trang — cũng là 3 mục con của "Truyền thông" ở sidebar (owner-nav-config).
 * Thứ tự theo docs/owner-marketing-plan.md §B7; tab đầu là mặc định (từ Phase M2).
 * "Hiệu quả" đã tách thành trang "Hiệu quả quảng cáo" ở nhóm Phân tích (OWNER_AD_PERFORMANCE_HREF).
 */
export const OWNER_MARKETING_TABS = [
  { value: "chien-dich", label: "Chiến dịch" },
  { value: "giao-viec", label: "Giao việc cho sàn" },
  { value: "link-theo-doi", label: "Link theo dõi" },
] as const;
export type OwnerMarketingTab = (typeof OWNER_MARKETING_TABS)[number]["value"];
export const ownerMarketingTabHref = (tab: OwnerMarketingTab) => `${OWNER_MARKETING_HREF}?tab=${tab}`;

/** Chi tiết một đơn "Giao việc cho sàn" (mục con giao-viec ⇒ sidebar tô đúng mục). */
export const ownerMarketingOrderHref = (id: string) => `${OWNER_MARKETING_HREF}/giao-viec/${id}`;

export const OWNER_CAMPAIGNS_HREF = ownerMarketingTabHref("chien-dich");
export const NEW_CAMPAIGN_HREF = `${OWNER_MARKETING_HREF}/chien-dich/moi`;
export const ownerCampaignHref = (id: string) => `${OWNER_MARKETING_HREF}/chien-dich/${id}`;
export const ownerCampaignEditHref = (id: string) => `${OWNER_MARKETING_HREF}/chien-dich/${id}/sua`;
/** "Hiệu quả quảng cáo" (nhóm Phân tích) — trước là tab `?tab=hieu-qua` của Truyền thông. */
export const OWNER_AD_PERFORMANCE_HREF = "/chu-tai-san/hieu-qua-quang-cao";
/** "Hiệu quả quảng cáo" — cả đơn vị, hoặc lọc sẵn một tài sản (thay cho tab "Truyền thông" của tài sản). */
export const ownerMarketingPerformanceHref = (listingId?: string | null) =>
  `${OWNER_AD_PERFORMANCE_HREF}${listingId ? `?tai-san=${encodeURIComponent(listingId)}` : ""}`;
/** "Dữ liệu đi đâu" (Phase M6) — mức triển khai L0 / L1 / L2. */
export const OWNER_MARKETING_DATA_FLOW_HREF = `${OWNER_MARKETING_HREF}/du-lieu`;

/** Tổng hợp mọi link Hồ sơ online của Trạm; `assetId` lọc sẵn một hồ sơ / tin. */
export const ownerShareLinksHref = (assetId?: string | null) =>
  `${ownerMarketingTabHref("link-theo-doi")}${assetId ? `&tai-san=${encodeURIComponent(assetId)}` : ""}`;

/**
 * Chi tiết một link Hồ sơ online (đích hồ sơ, tin hay link chiến dịch đều chung trang này).
 * Nằm dưới `/link-theo-doi/` ⇒ sidebar tô mục con "Link theo dõi".
 */
export const shareLinkHref = (id: string, back?: string) =>
  `${OWNER_MARKETING_HREF}/link-theo-doi/${id}${back ? `?tu=${encodeURIComponent(back)}` : ""}`;

/** Chỉ quay lại trong cổng chủ tài sản — không nhận URL ngoài từ query string. */
export const safeOwnerBack = (v: string | null | undefined) =>
  v && v.startsWith("/chu-tai-san/") && !v.startsWith("//") ? v : null;

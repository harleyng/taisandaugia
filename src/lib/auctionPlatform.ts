// Ranh giới nền tảng thông tin → sàn đấu giá trực tuyến (docs/auction-platform-split-plan.md).
//
// Mọi đường dẫn từ code INFO sang màn đấu giá (phiên, hồ sơ tham gia, phòng đấu
// giá…) PHẢI đi qua file này — đây là hợp đồng URL giữa hai nền tảng. Từ cutover
// (Phase 5) màn đấu giá KHÔNG còn ở repo này ⇒ link luôn ra tên miền sàn:
// `VITE_AUCTION_APP_URL` nếu đặt (local: http://localhost:8081), không thì tên
// miền production của repo taisanviet.

import { readMktAttribution, withMktAttribution } from "@/lib/ownerMarketing/links";

/** Production của sàn khi chưa đặt env. Đổi tên miền riêng thì sửa cả vercel.json. */
const DEFAULT_AUCTION_APP_URL = "https://taisanviet.vercel.app";

const BASE = (String(import.meta.env.VITE_AUCTION_APP_URL ?? "").trim() || DEFAULT_AUCTION_APP_URL).replace(/\/+$/, "");

/**
 * Đường dẫn trên sàn đấu giá (bắt đầu bằng "/") → URL tuyệt đối. Cũng là đích của
 * đăng nhập liên kết (/dang-nhap/san-dau-gia): tên miền CHỈ lấy từ env / hằng số —
 * không bao giờ từ tham số URL, nếu không mã đăng nhập một lần có thể bị gửi tới
 * tên miền lạ. Khách đến từ link truyền thông (cookie `mkt_link_id`) ⇒ kèm `?mkt=`
 * để hồ sơ tham gia tạo bên sàn vẫn gắn đúng link (cookie không qua tên miền khác).
 */
export const auctionUrl = (path: string): string => `${BASE}${withMktAttribution(path, readMktAttribution())}`;

export const AUCTION_LINKS = {
  sessions: "/sessions",
  /** Trang nhận mã đăng nhập liên kết trên sàn (taisanviet `AuthHandoffPage`). */
  authHandoff: "/auth/handoff",
  auth: "/auth",
  session: (sessionId: string) => `/sessions/${sessionId}`,
  /** Phòng đấu giá — xem được không cần đăng ký (admin theo dõi phiên đang đấu). */
  sessionRoom: (sessionId: string) => `/sessions/${sessionId}/dau-gia`,
  sessionQa: (sessionId: string) => `/sessions/${sessionId}/hoi-dap`,
  /** "Hồ sơ đấu giá" của người mua (danh sách + định danh eKYC) — trang riêng trên sàn. */
  myContracts: "/ho-so-cua-toi",
  /** Màn phiên đấu giá của cổng tổ chức trên sàn. */
  portalSessions: "/portal/phien-dau-gia",
  portalSession: (sessionId: string, tab?: string) => `/portal/phien-dau-gia/${sessionId}${tab ? `/${tab}` : ""}`,
  portalSessionNew: "/portal/phien-dau-gia/moi",
  portalDossiers: "/portal/ho-so-tham-gia",
  portalQa: "/portal/hoi-dap",
} as const;

/** Điều hướng sang sàn đấu giá — luôn tải cả trang (khác origin). */
export function goToAuction(path: string): void {
  window.location.assign(auctionUrl(path));
}

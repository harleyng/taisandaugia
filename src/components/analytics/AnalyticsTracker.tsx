import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { setCurrentUserId, trackPageView } from "@/lib/analytics/track";

/**
 * Gộp segment id động về placeholder để "Top page" không bị vỡ vụn theo từng id.
 * "r" = link chia sẻ báo cáo /r/:token, "hs" = Hồ sơ online /hs/:code — token / mã là mật
 * khẩu của link, không bao giờ được nằm trong analytics_events (admin đọc được bảng này).
 */
function normalizePath(pathname: string): string {
  return pathname.replace(
    /^\/(listings|auctions|auction-org|asset-owner|tin-tuc|report|nguoi-dung|khach-hang|doi-tac|r|hs)\/[^/]+.*/,
    "/$1/:id",
  );
}

const LISTING_DETAIL = /^\/listings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** Id tài sản của trang /listings/:id — path đã gộp về placeholder nên id đi riêng (cột listing_id). */
function listingIdOf(pathname: string): string | null {
  return LISTING_DETAIL.exec(pathname)?.[1] ?? null;
}

/**
 * Mount 1 lần trong Router. Ghi 1 page_view mỗi lần đổi route (trừ khu vực
 * /admin — báo cáo là về hành vi người dùng cuối, không phải thao tác admin) và
 * đồng bộ user_id hiện tại cho các trackFeature() rải rác trong app.
 */
export default function AnalyticsTracker(): null {
  const { pathname } = useLocation();
  const { userId } = useAuth();

  useEffect(() => {
    setCurrentUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    trackPageView(normalizePath(pathname), { listingId: listingIdOf(pathname) });
  }, [pathname]);

  return null;
}

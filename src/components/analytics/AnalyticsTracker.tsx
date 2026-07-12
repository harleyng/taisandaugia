import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { setCurrentUserId, trackPageView } from "@/lib/analytics/track";

/** Gộp segment id động về placeholder để "Top page" không bị vỡ vụn theo từng id. */
function normalizePath(pathname: string): string {
  return pathname.replace(
    /^\/(listings|auctions|auction-org|asset-owner|tin-tuc|report|nguoi-dung|khach-hang|doi-tac)\/[^/]+.*/,
    "/$1/:id",
  );
}

/**
 * Mount 1 lần trong Router. Ghi 1 page_view mỗi lần đổi route (trừ khu vực
 * /admin — báo cáo là về hành vi người dùng cuối, không phải thao tác admin) và
 * đồng bộ user_id hiện tại cho các trackFeature() rải rác trong app.
 */
export default function AnalyticsTracker() {
  const { pathname } = useLocation();
  const { userId } = useAuth();

  useEffect(() => {
    setCurrentUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    trackPageView(normalizePath(pathname));
  }, [pathname]);

  return null;
}

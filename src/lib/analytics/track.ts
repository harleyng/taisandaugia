// Tracker hành vi người dùng first-party (ghi vào bảng analytics_events).
//
// Fire-and-forget: mọi hàm KHÔNG await, nuốt lỗi, không bao giờ chặn UI. Khách
// chưa đăng nhập vẫn log được (RLS cho anon INSERT). user_id chỉ set khi có
// session — nếu không, chỉ có session_id ẩn danh (localStorage).
//
// Tỉnh (province) KHÔNG set ở client: server tự suy từ hồ sơ tổ chức qua trigger
// khi có user_id (xem migration 20260713000001_analytics_events.sql).

import { supabase } from "@/integrations/supabase/client";

// Catalog nhãn nằm ở module thuần dùng chung (báo cáo + test không kéo supabase).
export { FEATURE_EVENT_LABELS, featureEventLabel } from "./featureLabels";

const SESSION_KEY = "tsdg_sid";

/** id phiên ẩn danh, bền trong localStorage. Sinh 1 lần / trình duyệt. */
export function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    // localStorage bị chặn (chế độ riêng tư) → phiên tạm theo lần load trang.
    return "s_ephemeral";
  }
}

export interface DeviceInfo {
  device_type: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
}

/** Parse thiết bị/trình duyệt/OS từ userAgent (regex nhẹ, không thêm dependency). */
export function parseDevice(ua: string): DeviceInfo {
  const s = ua || "";
  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s);
  const isMobile = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(s);
  const device_type: DeviceInfo["device_type"] = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let browser = "Khác";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/Coc[ _]?Coc/i.test(s)) browser = "Cốc Cốc";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s)) browser = "Safari";

  let os = "Khác";
  if (/Windows/i.test(s)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(s)) os = /iPad/i.test(s) ? "iPadOS" : "iOS";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/Linux/i.test(s)) os = "Linux";

  return { device_type, browser, os };
}

interface BaseEventInput {
  userId?: string | null;
}

// user_id hiện tại, do AnalyticsTracker cập nhật theo session. Cho phép các điểm
// gọi trackFeature("key") mà không cần tự lấy useAuth ở mỗi nơi.
let currentUserId: string | null = null;
export function setCurrentUserId(id: string | null): void {
  currentUserId = id;
}

function device(): DeviceInfo | null {
  if (typeof navigator === "undefined") return null;
  return parseDevice(navigator.userAgent);
}

/** Ghi 1 lượt xem trang. */
export function trackPageView(path: string, opts: BaseEventInput = {}): void {
  const d = device();
  void supabase
    .from("analytics_events")
    .insert({
      session_id: getSessionId(),
      user_id: opts.userId ?? currentUserId,
      event_type: "page_view",
      path,
      device_type: d?.device_type ?? null,
      browser: d?.browser ?? null,
      os: d?.os ?? null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    })
    .then(undefined, () => {
      /* nuốt lỗi: analytics không được chặn UX */
    });
}

/** Ghi 1 lượt dùng tính năng. `key` nên nằm trong FEATURE_EVENT_LABELS. */
export function trackFeature(key: string, opts: BaseEventInput = {}): void {
  const d = device();
  void supabase
    .from("analytics_events")
    .insert({
      session_id: getSessionId(),
      user_id: opts.userId ?? currentUserId,
      event_type: "feature",
      feature_key: key,
      device_type: d?.device_type ?? null,
      browser: d?.browser ?? null,
      os: d?.os ?? null,
    })
    .then(undefined, () => {
      /* nuốt lỗi */
    });
}

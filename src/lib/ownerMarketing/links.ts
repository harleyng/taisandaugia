// Kênh truyền thông + cookie ghi nhận nguồn (docs/owner-marketing-plan.md Phase M1/M5).
//
// Thuần (không React/Supabase) để test được. Từ 20261004210000 mọi link chia sẻ là link Hồ sơ
// online /hs/:code (posting_share_links.channel dùng đúng bộ kênh dưới đây). Link /l/:code cũ
// (mã 8 ký tự [a-z0-9]) chỉ còn chuyển hướng sang /hs/.

import {
  Link2,
  Mail,
  MessageCircle,
  MessageSquareText,
  Newspaper,
  Smartphone,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";

// ─── Kênh ────────────────────────────────────────────────────────────────────

export const MKT_CHANNELS = ["zalo", "sms", "email", "facebook", "bank_app", "press", "other"] as const;
export type MktChannel = (typeof MKT_CHANNELS)[number];

export const MKT_CHANNEL_META: Record<MktChannel, { label: string; icon: LucideIcon; hint: string }> = {
  zalo: { label: "Zalo", icon: MessageCircle, hint: "Nhóm Zalo, Zalo OA hoặc tin nhắn của cán bộ" },
  sms: { label: "SMS", icon: MessageSquareText, hint: "Tin nhắn SMS brandname của đơn vị" },
  email: { label: "Email", icon: Mail, hint: "Email do đơn vị tự gửi" },
  facebook: { label: "Facebook", icon: ThumbsUp, hint: "Trang hoặc nhóm Facebook" },
  bank_app: { label: "App ngân hàng", icon: Smartphone, hint: "Thông báo / banner trong ứng dụng của đơn vị" },
  press: { label: "Báo chí", icon: Newspaper, hint: "Bài báo, thông cáo" },
  other: { label: "Khác", icon: Link2, hint: "Kênh khác" },
};

export function isMktChannel(v: unknown): v is MktChannel {
  return typeof v === "string" && (MKT_CHANNELS as readonly string[]).includes(v);
}

export function channelLabel(channel: string): string {
  return isMktChannel(channel) ? MKT_CHANNEL_META[channel].label : "Khác";
}

// ─── Mã & đường dẫn ──────────────────────────────────────────────────────────

/** Khớp CHECK của owner_mkt_links.code / posting_share_links.legacy_code — mã sai thì khỏi gọi server. */
export function isTrackingCode(code: string | null | undefined): code is string {
  return !!code && /^[a-z0-9]{8}$/.test(code);
}


/** Đích chuyển hướng: trang tin công khai, gắn utm để báo cáo truy cập nhận ra nguồn. */
export function listingTargetPath(listingId: string, channel: string, code: string): string {
  const q = new URLSearchParams({ utm_source: channel, utm_campaign: code });
  return `/listings/${listingId}?${q.toString()}`;
}

// ─── Ghi nhận nguồn (cookie bên thứ nhất, 30 ngày) ───────────────────────────

export const MKT_ATTRIBUTION_COOKIE = "mkt_link_id";
const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lần chạm cuối thắng: mở link mới ghi đè link cũ. Trình duyệt chặn cookie ⇒ bỏ qua. */
export function writeMktAttribution(linkId: string): void {
  if (!UUID_RE.test(linkId)) return;
  try {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${MKT_ATTRIBUTION_COOKIE}=${linkId}; Max-Age=${ATTRIBUTION_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookie bị chặn — chỉ mất ghi nhận nguồn, không chặn người xem */
  }
}

/** id link đã đưa khách tới (≤ 30 ngày), hoặc null. Dùng ở Phase M5 (lưu / đăng ký). */
export function readMktAttribution(cookieString?: string): string | null {
  try {
    const raw = cookieString ?? document.cookie;
    const hit = raw
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${MKT_ATTRIBUTION_COOKIE}=`));
    const v = hit?.slice(MKT_ATTRIBUTION_COOKIE.length + 1) ?? "";
    return UUID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

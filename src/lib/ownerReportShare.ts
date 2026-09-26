// Link chia sẻ báo cáo định kỳ /r/:token (docs/owner-control-tower-plan.md Phase 11).
//
// Thuần (không React/Supabase) để test được. Luật ở server:
//   • owner_share_report / owner_revoke_report_share / owner_report_share_link — chỉ
//     'send_report' (Trưởng đơn vị); chỉ báo cáo đã chốt; hạn 1–90 ngày; tạo khi link
//     còn hạn = gia hạn (giữ token).
//   • get_shared_owner_report (anon) — trả payload đã lọc; lượt xem chỉ đếm người ngoài đơn vị.
// Thành viên khác chỉ thấy trạng thái (OwnerReport.share), không bao giờ thấy token.

import { mapReportPayload, type ReportPayload, type ReportShareInfo } from "@/lib/ownerPeriodicReport";

// ─── Thời hạn ────────────────────────────────────────────────────────────────

export const SHARE_DURATIONS = [7, 30, 90] as const;
export type ShareDuration = (typeof SHARE_DURATIONS)[number];
export const DEFAULT_SHARE_DAYS: ShareDuration = 30;

export const SHARE_DURATION_LABEL: Record<ShareDuration, string> = {
  7: "7 ngày",
  30: "30 ngày",
  90: "90 ngày",
};

// ─── Đường dẫn ───────────────────────────────────────────────────────────────

export const sharedReportPath = (token: string) => `/r/${token}`;

export function sharedReportUrl(token: string, origin = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}${sharedReportPath(token)}`;
}

// ─── Trạng thái ──────────────────────────────────────────────────────────────

export type ReportShareState = "none" | "active" | "expired";

export function reportShareState(share: Pick<ReportShareInfo, "expiresAt">, now: Date = new Date()): ReportShareState {
  if (!share.expiresAt) return "none";
  const t = Date.parse(share.expiresAt);
  if (Number.isNaN(t)) return "none";
  return t > now.getTime() ? "active" : "expired";
}

// Giờ Việt Nam cố định (link mở ở đâu cũng đọc cùng một ngày).
const VN_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function vnParts(iso: string | null): Record<string, string> | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Object.fromEntries(VN_PARTS.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
}

/** "2026-10-26T10:00:00Z" → "26/10/2026" (giờ VN); trống → "—". */
export function formatShareDay(iso: string | null): string {
  const p = vnParts(iso);
  return p ? `${p.day}/${p.month}/${p.year}` : "—";
}

/** "2026-10-26T10:00:00Z" → "26/10/2026 17:00" (giờ VN); trống → "—". */
export function formatShareDateTime(iso: string | null): string {
  const p = vnParts(iso);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : "—";
}

const viewsLabel = (n: number) => (n > 0 ? `${n.toLocaleString("en-US")} lượt xem` : "chưa có lượt xem");

/**
 * Dòng trạng thái dưới link:
 * "Hết hạn 26/10/2026 · 3 lượt xem · xem lần cuối 27/09/2026 09:12".
 */
export function shareStatusLine(share: ReportShareInfo, state: ReportShareState): string {
  const parts: string[] = [];
  if (state === "active") parts.push(`Hết hạn ${formatShareDay(share.expiresAt)}`);
  if (state === "expired") parts.push(`Đã hết hạn ngày ${formatShareDay(share.expiresAt)}`);
  parts.push(viewsLabel(share.viewCount));
  if (share.lastViewedAt) parts.push(`xem lần cuối ${formatShareDateTime(share.lastViewedAt)}`);
  return parts.join(" · ");
}

/** Dòng tóm tắt ở danh sách báo cáo — chỉ khi link còn hạn. */
export function shareListLabel(share: ReportShareInfo, now: Date = new Date()): string | null {
  return reportShareState(share, now) === "active" ? `Đang chia sẻ · ${viewsLabel(share.viewCount)}` : null;
}

// ─── Kết quả RPC (đã qua assertOwnerReportRpcOk) ─────────────────────────────

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export interface ShareLink {
  /** null khi chưa có link hoặc link đã hết hạn. */
  token: string | null;
  expiresAt: string | null;
}

export function mapShareLink(raw: unknown): ShareLink {
  const d = obj(raw);
  return { token: str(d.token), expiresAt: str(d.expires_at) };
}

export interface ShareResult {
  token: string;
  expiresAt: string | null;
  /** true = gia hạn link đang còn hạn (token giữ nguyên). */
  renewed: boolean;
}

export function mapShareResult(raw: unknown): ShareResult {
  const d = obj(raw);
  const token = str(d.token);
  if (!token) throw new Error("share_token_missing");
  return { token, expiresAt: str(d.expires_at), renewed: d.renewed === true };
}

// ─── Trang công khai ─────────────────────────────────────────────────────────

export type SharedReportUnavailable = "not_found" | "expired" | "unreadable";

export interface SharedReportOk {
  ok: true;
  payload: ReportPayload;
  expiresAt: string | null;
}

export interface SharedReportError {
  ok: false;
  reason: SharedReportUnavailable;
  expiredAt: string | null;
}

export type SharedReportResult = SharedReportOk | SharedReportError;

/** JSON của get_shared_owner_report ⇒ kết quả an toàn cho trang /r/:token. */
export function mapSharedReportResponse(raw: unknown): SharedReportResult {
  const d = obj(raw);
  if (d.ok === true) {
    const report = obj(d.report);
    const payload = mapReportPayload(report.payload);
    return payload
      ? { ok: true, payload, expiresAt: str(report.expires_at) }
      : { ok: false, reason: "unreadable", expiredAt: null };
  }
  const reason: SharedReportUnavailable = d.reason === "expired" ? "expired" : d.ok === false ? "not_found" : "unreadable";
  return { ok: false, reason, expiredAt: str(d.expired_at) };
}

export const SHARED_REPORT_UNAVAILABLE: Record<SharedReportUnavailable, { title: string; description: string }> = {
  not_found: {
    title: "Link này không còn hiệu lực",
    description: "Link có thể đã được thu hồi hoặc chưa được sao chép đầy đủ. Vui lòng liên hệ người gửi để nhận link mới.",
  },
  expired: {
    title: "Link đã hết hạn",
    description: "Vui lòng liên hệ người gửi để được cấp link mới.",
  },
  unreadable: {
    title: "Chưa mở được báo cáo",
    description: "Báo cáo này hiện không hiển thị được. Vui lòng liên hệ người gửi.",
  },
};

/** Lối CTA "Tháp Điều Hành" — trang Liên hệ, chủ đề điền sẵn để bộ phận kinh doanh nhận ra nguồn. */
export const CONTROL_TOWER_CONTACT_HREF = `/lien-he?chu-de=${encodeURIComponent("Tháp Điều Hành")}`;

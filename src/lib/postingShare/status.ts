// Trạng thái, thời hạn và câu chữ lỗi của link Hồ sơ online. Thuần — test ở status.test.ts.

import type { PostingShareLink, SharedPostingUnavailable } from "./types";

// ─── Thời hạn ────────────────────────────────────────────────────────────────

/** Lựa chọn hạn link; "none" = không hết hạn. Server nhận 1–365 ngày hoặc null. */
export const SHARE_EXPIRY_OPTIONS = [
  { value: "7", label: "7 ngày", days: 7 },
  { value: "30", label: "30 ngày", days: 30 },
  { value: "90", label: "90 ngày", days: 90 },
  { value: "none", label: "Không hết hạn", days: null as number | null },
] as const;

export type ShareExpiryValue = (typeof SHARE_EXPIRY_OPTIONS)[number]["value"];
export const DEFAULT_SHARE_EXPIRY: ShareExpiryValue = "30";

export function expiryDays(value: ShareExpiryValue): number | null {
  return SHARE_EXPIRY_OPTIONS.find((o) => o.value === value)?.days ?? null;
}

// ─── Trạng thái link ─────────────────────────────────────────────────────────

export type ShareLinkState = "active" | "expired" | "revoked";

export function shareLinkState(
  link: Pick<PostingShareLink, "expiresAt" | "revokedAt">,
  now: Date = new Date(),
): ShareLinkState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt) {
    const t = Date.parse(link.expiresAt);
    if (!Number.isNaN(t) && t <= now.getTime()) return "expired";
  }
  return "active";
}

export const SHARE_LINK_STATE_LABEL: Record<ShareLinkState, string> = {
  active: "Đang mở",
  expired: "Hết hạn",
  revoked: "Đã thu hồi",
};

// Giờ Việt Nam cố định — link mở ở đâu cũng đọc cùng một ngày.
const VN_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const VN_DAY_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function vnFormat(fmt: Intl.DateTimeFormat, iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return p.hour ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : `${p.day}/${p.month}/${p.year}`;
}

/** "26/10/2026" (giờ VN); trống → "—". */
export const formatShareDay = (iso: string | null | undefined) => vnFormat(VN_DAY, iso);
/** "26/10/2026 17:00" (giờ VN); trống → "—". */
export const formatShareDayTime = (iso: string | null | undefined) => vnFormat(VN_DAY_TIME, iso);

/** Dòng phụ dưới nhãn trạng thái: "đến 26/10/2026" / "không hết hạn" / "từ 01/10/2026". */
export function shareLinkStateNote(
  link: Pick<PostingShareLink, "expiresAt" | "revokedAt">,
  now: Date = new Date(),
): string {
  const state = shareLinkState(link, now);
  if (state === "revoked") return `từ ${formatShareDay(link.revokedAt)}`;
  if (!link.expiresAt) return "không hết hạn";
  return state === "expired" ? `ngày ${formatShareDay(link.expiresAt)}` : `đến ${formatShareDay(link.expiresAt)}`;
}

// ─── Câu chữ ─────────────────────────────────────────────────────────────────

/** Trang công khai không mở được — lời lẽ cho NGƯỜI NHẬN link (không lộ lý do nội bộ). */
export const SHARED_POSTING_UNAVAILABLE: Record<SharedPostingUnavailable, { title: string; description: string }> = {
  not_found: {
    title: "Link hồ sơ không còn hiệu lực.",
    description: "Link có thể đã bị thu hồi hoặc chưa được sao chép đầy đủ. Vui lòng liên hệ người đã gửi link cho bạn.",
  },
  expired: {
    title: "Link hồ sơ đã hết hạn.",
    description: "Vui lòng liên hệ người đã gửi link để nhận link mới.",
  },
  unavailable: {
    title: "Hồ sơ đang được cập nhật.",
    description: "Thông tin tài sản đang được chủ tài sản chỉnh sửa và chờ sàn xác minh lại. Vui lòng quay lại sau.",
  },
};

/** Lỗi nghiệp vụ của các RPC phía cổng chủ tài sản. */
export const SHARE_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_found: "Không tìm thấy tài sản hoặc link. Tải lại trang để xem mới nhất.",
  forbidden: "Vai trò của bạn chưa có quyền tạo / sửa link chia sẻ cho tài sản này.",
  not_approved: "Hồ sơ cần được sàn duyệt trước khi tạo link chia sẻ.",
  posting_closed: "Hồ sơ đã huỷ — không tạo được link chia sẻ.",
  revoked: "Link đã thu hồi — không sửa được nữa. Hãy tạo link mới.",
  invalid_label: "Tên gợi nhớ cần từ 1 đến 80 ký tự.",
  sender_required: "Chọn người gửi để hiện liên hệ cho khách.",
  invalid_sender: "Người gửi không còn là thành viên của đơn vị. Chọn lại người gửi.",
  sender_no_contact: "Người gửi chưa có họ tên và số điện thoại trong hồ sơ — chưa hiện liên hệ được.",
  invalid_expiry: "Thời hạn link không hợp lệ.",
  too_many_links: "Tài sản đã có quá nhiều link đang mở. Thu hồi bớt link cũ rồi thử lại.",
  channel_invalid: "Chọn kênh gửi link.",
  target_invalid: "Chọn một tài sản để tạo link.",
  listing_not_in_workspace: "Tin này không còn thuộc đơn vị (chưa nhận hoặc đã bị từ chối). Tải lại trang để xem danh sách mới.",
  device_invalid: "Bộ lọc thiết bị không hợp lệ.",
};

export class PostingShareRpcError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(SHARE_REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.name = "PostingShareRpcError";
    this.reason = reason;
  }
}

/** RPC trả `{ ok:false, reason }` cho thất bại dự kiến — Supabase coi là thành công ⇒ phải tự ném. */
export function assertShareRpcOk(data: unknown): void {
  const d = data && typeof data === "object" ? (data as { ok?: unknown; reason?: unknown }) : {};
  if (d.ok === false) throw new PostingShareRpcError(typeof d.reason === "string" ? d.reason : "unknown");
}

export function shareErrorMessage(err: unknown, fallback = "Không lưu được link. Vui lòng thử lại."): string {
  if (err instanceof PostingShareRpcError) return err.message;
  return fallback;
}

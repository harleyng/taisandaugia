// Giai đoạn của một phiên đấu giá (bảng auction_sessions) — SUY DIỄN từ mốc thời
// gian, không lưu cột.
//
// Trả về đúng union AuctionSessionStatus của tin đấu giá để dùng lại nhãn +
// SessionStatusBadge. KHÁC sessionStatusOf(): hàm đó đọc custom_attributes của
// listings, còn đây đọc cột thời gian thật, và KHÔNG có bản sao SQL (server không
// GROUP BY theo giai đoạn) — đừng tạo thêm một cặp nhân bản SQL↔TS.
//
// Vòng đời công bố (draft / published / cancelled) là chuyện khác, xem
// sessionBucketOf bên dưới.

import type { AuctionSessionStatus } from "@/lib/listings/sessionStatus";

export interface SessionTiming {
  starts_at: string;
  ends_at: string;
  registration_end_at?: string | null;
}

export type SessionPublishStatus = "draft" | "published" | "cancelled";

export function sessionPhaseOf(s: SessionTiming, now: Date = new Date()): AuctionSessionStatus {
  const t = now.getTime();
  const ends = Date.parse(s.ends_at);
  if (!Number.isNaN(ends) && t > ends) return "ended";

  const starts = Date.parse(s.starts_at);
  if (!Number.isNaN(starts) && t >= starts) return "ongoing";

  // Không khai hạn nộp hồ sơ ⇒ coi như còn nhận tới giờ đấu.
  const reg = s.registration_end_at ? Date.parse(s.registration_end_at) : Number.NaN;
  if (Number.isNaN(reg) || t <= reg) return "registration_open";
  return "upcoming";
}

/** Nhóm hiển thị ở danh sách phiên trong /portal. */
export type SessionBucket = "draft" | "published" | "ended" | "cancelled";

export const SESSION_BUCKET_LABELS: Record<SessionBucket, string> = {
  draft: "Nháp",
  published: "Đang công bố",
  ended: "Đã kết thúc",
  cancelled: "Đã huỷ",
};

export const SESSION_BUCKET_ORDER: SessionBucket[] = ["draft", "published", "ended", "cancelled"];

export function sessionBucketOf(
  s: SessionTiming & { status: SessionPublishStatus },
  now: Date = new Date(),
): SessionBucket {
  if (s.status === "draft" || s.status === "cancelled") return s.status;
  return sessionPhaseOf(s, now) === "ended" ? "ended" : "published";
}

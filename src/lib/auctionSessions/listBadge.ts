// Nhãn trên ảnh bìa thẻ phiên ở /sessions (design 979d4c55 "San - Phien Dau Gia").
//
// Khác SessionStateBadge (nhãn giai đoạn chung): nhãn thẻ nói luôn MỐC kế tiếp
// ("Nhận hồ sơ đến 20/10/26", "Mở bán hồ sơ 21/10/26") và phân biệt "đã có kết
// quả" (đã chốt) với "đã kết thúc" (hết giờ, chưa chốt).

import { sessionPhaseOf, type SessionPublishStatus, type SessionTiming } from "./phase";

export type ListBadgeTone = "open" | "soon" | "upcoming" | "live" | "done" | "cancelled";

export interface ListBadge {
  label: string;
  tone: ListBadgeTone;
}

export interface ListBadgeSession extends SessionTiming {
  status: SessionPublishStatus;
  finalized_at?: string | null;
  registration_start_at?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "22/10/26" — cách ghi ngày ngắn của design. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

/** "16/10/26 14:20". */
export function formatShortDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatShortDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Ngày đấu trên thẻ: "Hôm nay" nếu trùng ngày. */
export function cardDateLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && sameDay(d, now) ? "Hôm nay" : formatShortDate(iso);
}

export function sessionListBadge(s: ListBadgeSession, now: Date = new Date()): ListBadge {
  if (s.status === "cancelled") return { label: "Đã huỷ", tone: "cancelled" };
  if (s.finalized_at) return { label: "Đã có kết quả", tone: "done" };

  const phase = sessionPhaseOf(s, now);
  if (phase === "ended") return { label: "Đã kết thúc", tone: "done" };
  if (phase === "ongoing") return { label: "Đang diễn ra", tone: "live" };

  const regStart = s.registration_start_at ? Date.parse(s.registration_start_at) : Number.NaN;
  if (!Number.isNaN(regStart) && now.getTime() < regStart) {
    return { label: `Mở bán hồ sơ ${formatShortDate(s.registration_start_at)}`, tone: "soon" };
  }
  if (phase === "registration_open") {
    return {
      label: s.registration_end_at ? `Nhận hồ sơ đến ${formatShortDate(s.registration_end_at)}` : "Đang nhận hồ sơ",
      tone: "open",
    };
  }
  return { label: "Sắp diễn ra", tone: "upcoming" };
}

/** "còn 12 suất" — chỉ khi đang nhận hồ sơ, có trần và còn chỗ. */
export function seatsLeftLabel(
  maxRegistrants: number | null | undefined,
  taken: number | null | undefined,
): string | null {
  if (maxRegistrants == null || taken == null) return null;
  const left = maxRegistrants - taken;
  return left > 0 ? `còn ${left} suất` : "hết suất";
}

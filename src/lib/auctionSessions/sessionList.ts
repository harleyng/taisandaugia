// Danh sách phiên ở /portal/phien-dau-gia (design "Phien Dau Gia - Cong Cong Ty"):
// tab theo vòng đời công bố, lọc thời gian / khu vực / hình thức, sắp theo mức gấp.
// Thuần hàm để test được — trang chỉ ghép lại.

import { stripViDiacritics } from "@/lib/normalizeVi";
import type { OrgSessionListRow } from "@/types/auction-session";
import {
  sessionBucketOf,
  sessionPhaseOf,
  type SessionBucket,
  type SessionPublishStatus,
  type SessionTiming,
} from "./phase";

/** Trạng thái hiển thị một dòng: vòng đời công bố + giai đoạn thời gian của phiên đã công bố. */
export type SessionRowState = "draft" | "reg" | "upcoming" | "ongoing" | "ended" | "finalized" | "cancelled";

export function sessionRowState(
  s: SessionTiming & { status: SessionPublishStatus; finalized_at?: string | null },
  now: Date = new Date(),
): SessionRowState {
  if (s.status === "draft" || s.status === "cancelled") return s.status;
  // Chốt kết quả là trạng thái cuối — thắng mốc ends_at (xem SessionStateBadge).
  if (s.finalized_at) return "finalized";
  const phase = sessionPhaseOf(s, now);
  return phase === "registration_open" ? "reg" : phase;
}

export const ROW_STATE_LABELS: Record<SessionRowState, string> = {
  draft: "Nháp",
  reg: "Đang nhận hồ sơ",
  upcoming: "Sắp đấu giá",
  ongoing: "Đang diễn ra",
  ended: "Đã kết thúc",
  finalized: "Đã chốt kết quả",
  cancelled: "Đã huỷ",
};

// ---- Tab ----

export type SessionListTab = "tat-ca" | SessionBucket;

export const SESSION_LIST_TABS: { key: SessionListTab; label: string }[] = [
  { key: "tat-ca", label: "Tất cả" },
  { key: "draft", label: "Nháp" },
  { key: "published", label: "Đang công bố" },
  { key: "ended", label: "Đã kết thúc" },
  { key: "cancelled", label: "Đã huỷ" },
];

export function matchesTab(tab: SessionListTab, s: OrgSessionListRow, now: Date = new Date()): boolean {
  return tab === "tat-ca" || sessionBucketOf(s, now) === tab;
}

// ---- Sắp xếp: đang diễn ra → sắp tới (gần nhất trước) → nháp → đã xong (mới nhất trước) ----

const RANK: Record<SessionRowState, number> = {
  ongoing: 0,
  reg: 1,
  upcoming: 1,
  draft: 2,
  ended: 3,
  finalized: 3,
  cancelled: 4,
};

export function sortSessionRows(rows: OrgSessionListRow[], now: Date = new Date()): OrgSessionListRow[] {
  const state = new Map(rows.map((r) => [r.id, sessionRowState(r, now)]));
  return [...rows].sort((a, b) => {
    const sa = state.get(a.id)!;
    const sb = state.get(b.id)!;
    if (RANK[sa] !== RANK[sb]) return RANK[sa] - RANK[sb];
    const diff = Date.parse(a.starts_at) - Date.parse(b.starts_at);
    return RANK[sa] >= 3 ? -diff : diff;
  });
}

// ---- Lọc thời gian (theo giờ bắt đầu đấu giá) ----

export type TimeFilter = "" | "today" | "w7" | "w30" | "month" | "past" | "custom";

export const TIME_FILTERS: { key: Exclude<TimeFilter, "custom">; label: string }[] = [
  { key: "", label: "Mọi thời gian" },
  { key: "today", label: "Hôm nay" },
  { key: "w7", label: "7 ngày tới" },
  { key: "w30", label: "30 ngày tới" },
  { key: "month", label: "Tháng này" },
  { key: "past", label: "Đã qua" },
];

/** "2026-10-05" → "05/10/2026"; trống ⇒ "…" (khoảng hở một đầu). */
const ymdLabel = (v: string) => (v ? v.split("-").reverse().join("/") : "…");

export function timeFilterLabel(time: TimeFilter, from: string, to: string): string {
  if (time === "custom") return `${ymdLabel(from)} – ${ymdLabel(to)}`;
  return TIME_FILTERS.find((t) => t.key === time)?.label ?? TIME_FILTERS[0].label;
}

const DAY = 86_400_000;

export function matchesTime(
  s: Pick<OrgSessionListRow, "starts_at" | "ends_at">,
  time: TimeFilter,
  from: string,
  to: string,
  now: Date = new Date(),
): boolean {
  if (!time) return true;
  const start = Date.parse(s.starts_at);
  if (Number.isNaN(start)) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (time) {
    case "today":
      return start >= today && start < today + DAY;
    case "w7":
      return start >= today && start < today + 7 * DAY;
    case "w30":
      return start >= today && start < today + 30 * DAY;
    case "month": {
      const d = new Date(start);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    case "past":
      return Date.parse(s.ends_at || s.starts_at) < now.getTime();
    case "custom": {
      // Ngày trong ô <input type="date"> là giờ địa phương: từ đầu ngày "từ" tới hết ngày "đến".
      const f = from ? new Date(`${from}T00:00`).getTime() : null;
      const t = to ? new Date(`${to}T23:59:59`).getTime() : null;
      return (f === null || start >= f) && (t === null || start <= t);
    }
    default:
      return true;
  }
}

/** Lỗi của khoảng ngày tuỳ chỉnh; null = áp dụng được. */
export function customRangeError(from: string, to: string): string | null {
  if (!from && !to) return "Chọn ít nhất một ngày";
  if (from && to && to < from) return "Đến ngày phải sau Từ ngày";
  return null;
}

// ---- Tìm kiếm: mã, tên phiên, tỉnh, địa điểm, tên tài sản — không dấu ----

export function matchesSessionQuery(s: OrgSessionListRow, foldedQuery: string): boolean {
  if (!foldedQuery) return true;
  const hay = [s.code, s.title, s.province, s.venue, ...s.item_titles].filter(Boolean).join(" ");
  return stripViDiacritics(hay).includes(foldedQuery);
}

// ---- Phân trang ----

export const PAGE_SIZES = [10, 20, 50] as const;

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { pages, page: current, start, slice: rows.slice(start, start + size) };
}

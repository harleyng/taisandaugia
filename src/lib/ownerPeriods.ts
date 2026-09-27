// Kỳ lọc của Trạm Điều Hành ("Kết quả phiên", sau này chỉ tiêu / báo cáo định kỳ).
//
// Dùng lại định dạng id của src/lib/reportPeriods.ts (m-YYYY-MM / q-YYYY-N / y-YYYY)
// nhưng KHÔNG dùng getAvailablePeriods (chốt mốc 09/2025 cho báo cáo mẫu):
// danh sách ở đây tính từ "hôm nay" của người dùng.

import { formatPeriodLabel, monthId, parsePeriod, quarterId, yearId } from "@/lib/reportPeriods";

export const PERIOD_ALL = "all";
export const PERIOD_LAST_12M = "last-12m";
export const DEFAULT_OWNER_PERIOD = PERIOD_LAST_12M;

/**
 * Khoảng tính NGƯỢC từ hôm nay (bộ lọc thời gian của "Kết quả phiên"):
 * luôn kết thúc ở hôm nay, khác các kỳ lịch m-/q-/y- phía dưới.
 */
export const RECENT_PERIODS = ["7d", "week", "month", "6m", "year"] as const;
export type RecentPeriod = (typeof RECENT_PERIODS)[number];
export const DEFAULT_RECENT_PERIOD: RecentPeriod = "6m";

const RECENT_PERIOD_LABEL: Record<RecentPeriod, string> = {
  "7d": "7 ngày qua",
  week: "Tuần này",
  month: "Tháng này",
  "6m": "6 tháng qua",
  year: "Năm nay",
};

const isRecentPeriod = (id: string): id is RecentPeriod => (RECENT_PERIODS as readonly string[]).includes(id);

export interface OwnerPeriodOption {
  id: string;
  label: string;
}

export interface OwnerPeriodGroup {
  label: string;
  options: OwnerPeriodOption[];
}

export interface DateRange {
  /** "YYYY-MM-DD", tính cả hai đầu. */
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function ymOf(today: string): { y: number; m: number } {
  return { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) };
}

/** Lùi `back` tháng từ (y, m). */
function shiftMonth(y: number, m: number, back: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) - back;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Nhóm lựa chọn cho Select — không id nào lặp lại giữa các nhóm. */
export function ownerPeriodGroups(today: string): OwnerPeriodGroup[] {
  const { y, m } = ymOf(today);
  const months = Array.from({ length: 12 }, (_, i) => {
    const p = shiftMonth(y, m, i);
    return monthId(p.y, p.m);
  });
  const q = Math.ceil(m / 3);
  const quarters = Array.from({ length: 4 }, (_, i) => {
    const idx = y * 4 + (q - 1) - i;
    return quarterId(Math.floor(idx / 4), (idx % 4) + 1);
  });
  const years = [yearId(y), yearId(y - 1)];
  const opt = (id: string) => ({ id, label: ownerPeriodLabel(id) });
  return [
    { label: "Khoảng thời gian", options: [opt(PERIOD_LAST_12M), opt(PERIOD_ALL)] },
    { label: "Theo tháng", options: months.map(opt) },
    { label: "Theo quý", options: quarters.map(opt) },
    { label: "Theo năm", options: years.map(opt) },
  ];
}

export function ownerPeriodIds(today: string): string[] {
  return ownerPeriodGroups(today).flatMap((g) => g.options.map((o) => o.id));
}

export function ownerPeriodLabel(id: string): string {
  if (isRecentPeriod(id)) return RECENT_PERIOD_LABEL[id];
  if (id === PERIOD_ALL) return "Tất cả thời gian";
  if (id === PERIOD_LAST_12M) return "12 tháng gần nhất";
  return formatPeriodLabel(id);
}

/** Cụm từ đứng sau động từ: "Đã bán {…}" ⇒ "trong tháng 09/2026", "từ trước tới nay". */
export function ownerPeriodPhrase(id: string): string {
  if (isRecentPeriod(id)) return `trong ${RECENT_PERIOD_LABEL[id].toLowerCase()}`;
  if (id === PERIOD_ALL) return "từ trước tới nay";
  if (id === PERIOD_LAST_12M) return "trong 12 tháng gần nhất";
  const label = formatPeriodLabel(id);
  return `trong ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** "Tuần này" bắt đầu từ thứ Hai; "6 tháng qua" lùi đúng ngày (31/08 ⇒ 28 hoặc 29/02). */
function recentRange(id: RecentPeriod, today: string): DateRange {
  const { y, m } = ymOf(today);
  const d = Number(today.slice(8, 10));
  const t = new Date(Date.UTC(y, m - 1, d));
  const daysBack = (n: number) => new Date(t.getTime() - n * 86_400_000).toISOString().slice(0, 10);
  switch (id) {
    case "7d":
      return { from: daysBack(6), to: today };
    case "week":
      return { from: daysBack((t.getUTCDay() + 6) % 7), to: today };
    case "month":
      return { from: iso(y, m, 1), to: today };
    case "6m": {
      const s = shiftMonth(y, m, 6);
      return { from: iso(s.y, s.m, Math.min(d, lastDay(s.y, s.m))), to: today };
    }
    case "year":
      return { from: iso(y, 1, 1), to: today };
  }
}

/** Khoảng ngày của kỳ; `null` = không lọc ("Tất cả" hoặc id lạ). */
export function periodRange(id: string, today: string): DateRange | null {
  if (isRecentPeriod(id)) return recentRange(id, today);
  if (id === PERIOD_LAST_12M) {
    const { y, m } = ymOf(today);
    const start = shiftMonth(y, m, 11);
    return { from: iso(start.y, start.m, 1), to: iso(y, m, lastDay(y, m)) };
  }
  const p = parsePeriod(id);
  if (!p) return null;
  if (p.kind === "month" && p.month) {
    return { from: iso(p.year, p.month, 1), to: iso(p.year, p.month, lastDay(p.year, p.month)) };
  }
  if (p.kind === "quarter" && p.quarter) {
    const first = (p.quarter - 1) * 3 + 1;
    return { from: iso(p.year, first, 1), to: iso(p.year, first + 2, lastDay(p.year, first + 2)) };
  }
  if (p.kind === "year") return { from: iso(p.year, 1, 1), to: iso(p.year, 12, 31) };
  return null;
}

/** Ngày "YYYY-MM-DD" có nằm trong kỳ không. Ngày trống chỉ lọt khi kỳ là "Tất cả". */
export function inPeriod(date: string | null, range: DateRange | null): boolean {
  if (!range) return true;
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= range.from && d <= range.to;
}

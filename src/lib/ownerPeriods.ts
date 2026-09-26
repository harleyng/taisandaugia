// Kỳ lọc của Trạm Điều Hành ("Kết quả phiên", sau này chỉ tiêu / báo cáo định kỳ).
//
// Dùng lại định dạng id của src/lib/reportPeriods.ts (m-YYYY-MM / q-YYYY-N / y-YYYY)
// nhưng KHÔNG dùng getAvailablePeriods (chốt mốc 09/2025 cho báo cáo mẫu):
// danh sách ở đây tính từ "hôm nay" của người dùng.

import { formatPeriodLabel, monthId, parsePeriod, quarterId, yearId } from "@/lib/reportPeriods";

export const PERIOD_ALL = "all";
export const PERIOD_LAST_12M = "last-12m";
export const DEFAULT_OWNER_PERIOD = PERIOD_LAST_12M;

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
  if (id === PERIOD_ALL) return "Tất cả thời gian";
  if (id === PERIOD_LAST_12M) return "12 tháng gần nhất";
  return formatPeriodLabel(id);
}

/** Cụm từ đứng sau động từ: "Đã bán {…}" ⇒ "trong tháng 09/2026", "từ trước tới nay". */
export function ownerPeriodPhrase(id: string): string {
  if (id === PERIOD_ALL) return "từ trước tới nay";
  if (id === PERIOD_LAST_12M) return "trong 12 tháng gần nhất";
  const label = formatPeriodLabel(id);
  return `trong ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** Khoảng ngày của kỳ; `null` = không lọc ("Tất cả" hoặc id lạ). */
export function periodRange(id: string, today: string): DateRange | null {
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

// "Tổng quan" của Trạm Điều Hành (/chu-tai-san/dashboard) — thuần, không React/Supabase.
//
// Bộ lọc Đơn vị áp MỌI khối; Kỳ (tháng / quý / năm ĐANG DIỄN RA) chỉ áp khối Chỉ
// tiêu và Phân tích danh mục — việc cần làm là tồn đọng, lịch luôn là 7 ngày tới.
// Kết quả phiên đọc từ CÙNG các dòng của trang "Kết quả phiên" (RPC
// owner_outcomes_overview) ⇒ số trên hai màn khớp nhau.

import { isoDayOf } from "@/lib/ownerOutcomeReport";
import { summarizeOutcomes, type OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import { dayDiff, formatDayMonth } from "@/lib/ownerPulse";
import {
  SCOPE_ALL,
  periodEndOf,
  periodLabel,
  periodStartOf,
  type TargetPeriodType,
} from "@/lib/ownerTargets";

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
const between = (day: string | null, from: string, to: string) => !!day && day >= from && day <= to;
const dayOf = (raw: string | null) => (raw ? raw.slice(0, 10) : null);

/** Cùng ngày năm trước; 29/02 ⇒ 28/02. */
export function sameDayLastYear(day: string): string {
  const y = Number(day.slice(0, 4)) - 1;
  const md = day.slice(5, 10);
  return md === "02-29" ? `${y}-02-28` : `${y}-${md}`;
}

// ─── Kỳ ──────────────────────────────────────────────────────────────────────

export interface OverviewWindow {
  type: TargetPeriodType;
  start: string;
  /** Tính cả ngày này. */
  end: string;
  today: string;
  /** "tháng 9/2026" · "quý III/2026" · "năm 2026". */
  label: string;
  prevStart: string;
  prevEnd: string;
  /**
   * Mốc "tới nay" của cùng kỳ năm trước: kỳ này mới đi được một phần nên KPI so
   * với cùng khoảng ngày năm trước, không so với cả kỳ năm trước.
   */
  prevToday: string;
}

export function overviewWindow(type: TargetPeriodType, today: string): OverviewWindow {
  const start = periodStartOf(type, today);
  const prevStart = sameDayLastYear(start);
  return {
    type,
    start,
    end: periodEndOf(type, start),
    today,
    label: periodLabel(type, start),
    prevStart,
    prevEnd: periodEndOf(type, prevStart),
    prevToday: sameDayLastYear(today),
  };
}

// ─── Đơn vị ──────────────────────────────────────────────────────────────────

/** Dòng kết quả thuộc đơn vị đang chọn — "all" gồm cả tài sản chưa gắn chi nhánh. */
export const rowInScope = (branchId: string | null, scope: string) => scope === SCOPE_ALL || branchId === scope;

/**
 * Tin trên sàn chỉ biết chủ tài sản của claim ⇒ suy chi nhánh qua
 * workspace_branches.asset_owner_id (cùng cách Chỉ tiêu làm).
 */
export function assetScopeFilter(
  scope: string,
  branches: readonly { id: string; assetOwnerId: string | null }[],
): (assetOwnerId: string | null) => boolean {
  if (scope === SCOPE_ALL) return () => true;
  const owner = branches.find((b) => b.id === scope)?.assetOwnerId ?? null;
  return (assetOwnerId) => owner !== null && assetOwnerId === owner;
}

// ─── Giá trúng lũy kế theo tuần ──────────────────────────────────────────────

export interface WeekPoint {
  /** 1-based. */
  week: number;
  /** Khoảng ngày của tuần trong kỳ NÀY (YYYY-MM-DD, tính cả hai đầu). */
  from: string;
  to: string;
  /** Lũy kế kỳ này; null sau tuần hiện tại để đường dừng ở hôm nay. */
  current: number | null;
  /** Lũy kế cùng kỳ năm trước (cả kỳ). */
  previous: number;
}

type WinRow = Pick<OutcomeOverviewRow, "outcome" | "price" | "date">;

/** Tuần thứ mấy (0-based) kể từ `start`; ngày lẻ cuối kỳ dồn vào tuần cuối. */
const weekIndex = (start: string, day: string, weeks: number) =>
  Math.min(weeks - 1, Math.max(0, Math.floor(dayDiff(start, day) / 7)));

export function cumulativeWinByWeek(rows: WinRow[], w: OverviewWindow): WeekPoint[] {
  const weeks = Math.floor(dayDiff(w.start, w.end) / 7) + 1;
  const cur = new Array<number>(weeks).fill(0);
  const prev = new Array<number>(weeks).fill(0);

  for (const r of rows) {
    if (r.outcome !== "sold" || !r.price || r.price <= 0) continue;
    const day = dayOf(r.date);
    if (between(day, w.start, w.end)) cur[weekIndex(w.start, day!, weeks)] += r.price;
    else if (between(day, w.prevStart, w.prevEnd)) prev[weekIndex(w.prevStart, day!, weeks)] += r.price;
  }

  const todayWeek = weekIndex(w.start, w.today, weeks);
  let c = 0;
  let p = 0;
  return cur.map((amount, i) => {
    c += amount;
    p += prev[i];
    const from = addDays(w.start, i * 7);
    const last = addDays(from, 6);
    return {
      week: i + 1,
      from,
      to: i === weeks - 1 || last > w.end ? w.end : last,
      current: i <= todayWeek ? c : null,
      previous: p,
    };
  });
}

/** "Tuần 3 · 15/09 – 21/09". */
export const weekLabel = (p: Pick<WeekPoint, "week" | "from" | "to">) =>
  `Tuần ${p.week} · ${formatDayMonth(p.from)} – ${formatDayMonth(p.to)}`;

// ─── KPI so với cùng kỳ năm trước ────────────────────────────────────────────

export interface KpiDelta {
  current: number | null;
  previous: number | null;
  /** % thay đổi ("relative") hoặc chênh điểm % ("points"); null khi không so được. */
  change: number | null;
  kind: "relative" | "points";
  /** Tăng là tốt? — quyết định màu, không phải chiều mũi tên. */
  higherIsBetter: boolean;
}

export interface OverviewKpis {
  /** Tài sản có kết quả trong kỳ (thành / không thành / hoãn huỷ). */
  auctioned: KpiDelta;
  successRate: KpiDelta;
  /** Tổng giá trúng của tài sản đã bán trong kỳ. */
  winValue: KpiDelta;
  /** Tồn đọng hiện tại so với cùng ngày năm trước. */
  stuck: KpiDelta;
}

/** % thay đổi làm tròn; null khi năm trước không có số để chia. */
export function relativeChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const relative = (current: number, previous: number, higherIsBetter = true): KpiDelta => ({
  current,
  previous,
  change: relativeChange(current, previous),
  kind: "relative",
  higherIsBetter,
});

type KpiRow = Pick<OutcomeOverviewRow, "outcome" | "price" | "date" | "paymentStatus" | "hasConflict">;

export function overviewKpis(
  rows: KpiRow[],
  w: OverviewWindow,
  stuck: { now: number; lastYear: number },
): OverviewKpis {
  const now = summarizeOutcomes(rows.filter((r) => between(dayOf(r.date), w.start, w.end)));
  const before = summarizeOutcomes(rows.filter((r) => between(dayOf(r.date), w.prevStart, w.prevToday)));

  return {
    auctioned: relative(now.total, before.total),
    successRate: {
      current: now.successRate,
      previous: before.successRate,
      change: now.successRate !== null && before.successRate !== null ? now.successRate - before.successRate : null,
      kind: "points",
      higherIsBetter: true,
    },
    winValue: relative(now.soldValue, before.soldValue),
    stuck: relative(stuck.now, stuck.lastYear, false),
  };
}

export interface StuckHistoryInput {
  /** Ngày các phiên (listing_price_sessions.session_date). */
  sessionDays: string[];
  /** Ngày bán (kết quả hợp nhất), null khi chưa bán. */
  soldOn: string | null;
}

/**
 * Ước tính số tài sản tồn đọng tại một ngày đã qua: tới ngày đó đã qua ≥ 2 phiên
 * mà chưa bán. Không biết lịch phiên lúc ấy nên không loại tài sản đang chờ đấu lại.
 */
export function stuckAsOf(assets: StuckHistoryInput[], day: string): number {
  let n = 0;
  for (const a of assets) {
    if (a.soldOn && a.soldOn.slice(0, 10) <= day) continue;
    if (a.sessionDays.filter((d) => d.slice(0, 10) <= day).length >= 2) n += 1;
  }
  return n;
}

// ─── Việc cần làm ────────────────────────────────────────────────────────────

export const TODO_KINDS = ["outcome_due", "awaiting_payment", "pending_confirmation", "stuck"] as const;
export type TodoKind = (typeof TODO_KINDS)[number];

export interface TodoItem {
  title: string;
  /** Số ngày đã chờ; null khi không rõ mốc. */
  days: number | null;
  amount: number | null;
}

export interface TodoSummary {
  kind: TodoKind;
  count: number;
  amount: number;
  /** Tên việc chờ lâu nhất (bỏ qua việc không rõ mốc) — dòng mô tả của nhóm. */
  oldestTitle: string | null;
}

export function summarizeTodo(kind: TodoKind, items: TodoItem[]): TodoSummary {
  let oldest: TodoItem | null = null;
  let amount = 0;
  for (const item of items) {
    if (item.amount && item.amount > 0) amount += item.amount;
    if (item.days !== null && (oldest === null || item.days > (oldest.days ?? -1))) oldest = item;
  }
  return {
    kind,
    count: items.length,
    amount,
    oldestTitle: oldest?.title ?? items[0]?.title ?? null,
  };
}

/** Số ngày từ `day` tới hôm nay (không âm); null khi không có mốc. */
export function daysSince(day: string | null | undefined, today: string): number | null {
  const d = isoDayOf(day ?? null);
  return d ? Math.max(0, dayDiff(d, today)) : null;
}

// ─── Lịch đấu giá 7 ngày ─────────────────────────────────────────────────────

export interface CalendarAsset {
  id: string;
  auctionTime: string | null;
}

export interface CalendarDay<T> {
  day: string;
  isToday: boolean;
  items: T[];
}

/**
 * Phiên từ hôm nay tới hết ngày thứ `days`, gom theo ngày. Hôm nay luôn có mặt
 * (kể cả trống) để người xem biết hôm nay không có phiên; ngày khác chỉ hiện khi có phiên.
 * Trả mảng rỗng khi cả 7 ngày không có phiên nào.
 */
export function upcomingCalendar<T extends CalendarAsset>(assets: T[], today: string, days = 7): CalendarDay<T>[] {
  const last = addDays(today, days - 1);
  const byDay = new Map<string, T[]>();
  for (const a of assets) {
    const day = isoDayOf(a.auctionTime);
    if (!between(day, today, last)) continue;
    byDay.set(day!, [...(byDay.get(day!) ?? []), a]);
  }
  if (byDay.size === 0) return [];
  if (!byDay.has(today)) byDay.set(today, []);

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({
      day,
      isToday: day === today,
      items: [...items].sort((x, y) => (x.auctionTime ?? "").localeCompare(y.auctionTime ?? "")),
    }));
}

/** "09:30" theo giờ máy; null khi chỉ có ngày hoặc chuỗi rác. */
export function sessionTimeOf(raw: string | null): string | null {
  if (!raw || DATE_ONLY.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;

/** "Hôm nay" · "Ngày mai" · "Thứ Năm", kèm "01/10". */
export function calendarDayLabel(day: string, today: string): { title: string; date: string } {
  const diff = dayDiff(today, day);
  const title = diff === 0 ? "Hôm nay" : diff === 1 ? "Ngày mai" : WEEKDAYS[new Date(Date.parse(day)).getUTCDay()];
  return { title, date: formatDayMonth(day) };
}

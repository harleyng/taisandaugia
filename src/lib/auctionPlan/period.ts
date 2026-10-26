// Kế hoạch so THỰC TẾ theo kỳ (A5 của docs/owner-auction-planning-plan.md).
//
// ⚠️ CẶP NHÂN BẢN SQL ↔ TS THỨ SÁU của dự án. Bản sao SQL là
// `public.auction_plan_period_metrics(plan, period_type, period_start)`
// (migration `20261026150000`). Sửa một bên thì PHẢI sửa bên kia trong cùng
// lần — không có test nào tự bắt được lệch.
//
// Ba luật KHÔNG viết lại ở đây:
//  ① luật TIỀN ("Đã thu") là `recoveryOf()` của `src/lib/ownerTargets.ts`
//    (cash-strict, quyết định 26/09) — module này chỉ gọi lại qua
//    `summarizeTargetInputs`, nên "Đã thu" của Theo kỳ và của Chỉ tiêu không
//    thể lệch nhau;
//  ② biên kỳ là `periodStartOf` / `periodEndOf` của cùng file đó (bao gồm hai đầu);
//  ③ KẾT QUẢ THỰC TẾ của một tài sản là dòng `owner_outcomes_overview` khớp theo
//    `asset_posting_id` hoặc `listing_id` — ở server là
//    `auction_plan_outcome_rows`, một nguồn với Chỉ tiêu (quyết định D8).
//
// ⚠️ MỌI so sánh ngày là so CHUỖI `YYYY-MM-DD`, không dựng `Date` (xem đầu
// `health.ts`): cột DB là `DATE`, và một tài sản ở Việt Nam không được "vào kỳ"
// sớm 7 tiếng.
//
// CỘT KẾ HOẠCH lấy từ BẢN MỐC mới nhất, không lấy danh mục hiện tại:
// `planItemTotals` (totals.ts) là catalogue ĐANG CÓ, dùng cho đầu trang; cam kết
// của đơn vị trong kỳ là cái đã được phê duyệt.

import {
  periodEndOf,
  periodStartOf,
  summarizeTargetInputs,
  type RecoverySummary,
  type TargetInput,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import type { OutcomePaymentStatus, ResolvedOutcomeKind } from "@/lib/ownerOutcomes";
import type { AuctionPlanBaseline, AuctionPlanItem } from "./types";

/* ─── Kỳ ──────────────────────────────────────────────────────────────────── */

export type PlanPeriodType = TargetPeriodType;

export interface PlanPeriod {
  type: PlanPeriodType;
  /** Ngày 01 của kỳ. */
  start: string;
}

const PAD = (n: number) => String(n).padStart(2, "0");
const ROMAN = ["I", "II", "III", "IV"] as const;

/**
 * Mã kỳ trên URL (`?ky=`): "2026-11" (tháng) · "2026-Q4" (quý) · "2026" (năm).
 * Cùng bộ chữ với khoá `by_month` / `by_quarter` của bản mốc và với khoá mở
 * báo cáo sâu (`{slug}:{periodId}`) — không sinh thêm cách viết thứ hai.
 */
export function planPeriodKey(period: PlanPeriod): string {
  const y = period.start.slice(0, 4);
  if (period.type === "year") return y;
  const m = Number(period.start.slice(5, 7));
  return period.type === "month" ? `${y}-${PAD(m)}` : `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

/** Đọc `?ky=`; sai định dạng / ngoài năm kế hoạch ⇒ null (gọi phải tự chọn mặc định). */
export function parsePlanPeriodKey(key: string | null | undefined): PlanPeriod | null {
  const raw = (key ?? "").trim();
  let m = /^(\d{4})$/.exec(raw);
  if (m) return { type: "year", start: `${m[1]}-01-01` };
  m = /^(\d{4})-Q([1-4])$/.exec(raw);
  if (m) return { type: "quarter", start: `${m[1]}-${PAD((Number(m[2]) - 1) * 3 + 1)}-01` };
  m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw);
  if (m) return { type: "month", start: `${m[1]}-${m[2]}-01` };
  return null;
}

/** "tháng 11/2026" · "quý IV/2026" · "năm 2026" — chữ của Chỉ tiêu, giữ nguyên. */
export function planPeriodLabel(period: PlanPeriod): string {
  const y = period.start.slice(0, 4);
  const m = Number(period.start.slice(5, 7));
  if (period.type === "month") return `tháng ${m}/${y}`;
  if (period.type === "quarter") return `quý ${ROMAN[Math.floor((m - 1) / 3)]}/${y}`;
  return `năm ${y}`;
}

export const planPeriodEnd = (period: PlanPeriod): string => periodEndOf(period.type, period.start);

/** "2026-06-15" → "15/06/2026"; thiếu / sai định dạng ⇒ "—". */
export function planDayLabel(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

/** Mọi kỳ chọn được của một năm kế hoạch: 12 tháng, 4 quý, cả năm. */
export function planPeriodOptions(planYear: number): { key: string; label: string; period: PlanPeriod }[] {
  const out: { key: string; label: string; period: PlanPeriod }[] = [];
  const push = (period: PlanPeriod) => out.push({ key: planPeriodKey(period), label: planPeriodLabel(period), period });
  push({ type: "year", start: `${planYear}-01-01` });
  for (const q of [1, 2, 3, 4]) push({ type: "quarter", start: `${planYear}-${PAD((q - 1) * 3 + 1)}-01` });
  for (let m = 1; m <= 12; m += 1) push({ type: "month", start: `${planYear}-${PAD(m)}-01` });
  return out;
}

/** Kỳ mặc định khi mở tab: tháng hiện tại nếu còn trong năm kế hoạch, ngược lại cả năm. */
export function defaultPlanPeriod(planYear: number, today: string): PlanPeriod {
  return Number(today.slice(0, 4)) === planYear
    ? { type: "month", start: periodStartOf("month", today) }
    : { type: "year", start: `${planYear}-01-01` };
}

/* ─── Dòng dữ liệu ────────────────────────────────────────────────────────── */

/** Kết quả thực tế của một tài sản (một dòng `auction_plan_item_outcomes`). */
export interface PlanPeriodOutcome {
  outcome: string | null;
  payment_status: string | null;
  auction_date: string | null;
  starting_price: number | string | null;
  winning_price: number | string | null;
  paid_amount: number | string | null;
}

/**
 * Một tài sản của kế hoạch, đã gắn giá trị BẢN MỐC và kết quả thực tế.
 *
 * `planned = false` nghĩa là tài sản KHÔNG còn là cam kết của kỳ nào: nó đã bỏ
 * khỏi kế hoạch và cũng không nằm trong bản mốc mới nhất. Tài sản bị bỏ SAU khi
 * duyệt vẫn còn trong bản mốc ⇒ vẫn là cam kết, vẫn đếm ở cột kế hoạch.
 */
export interface PlanPeriodRow {
  itemId: string;
  itemCode: string | null;
  title: string | null;
  planned: boolean;
  /** Tháng của bản mốc (thiếu bản mốc ⇒ tháng hiện tại). */
  baselineMonth: string | null;
  /** Giá trị khởi điểm dự kiến của bản mốc (thiếu bản mốc ⇒ giá trị hiện tại). */
  baselineExpected: number;
  outcome: PlanPeriodOutcome | null;
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Bản mốc mới nhất: `item.id` → { tháng, giá trị khởi điểm }. */
export function baselineItemMap(
  baseline: AuctionPlanBaseline | null | undefined,
): Map<string, { month: string | null; expected: number }> {
  const map = new Map<string, { month: string | null; expected: number }>();
  for (const it of baseline?.payload?.items ?? []) {
    if (it?.id) map.set(it.id, { month: it.planned_month ?? null, expected: num(it.expected_start_value) });
  }
  return map;
}

/** Dựng dòng "Theo kỳ" cho mọi tài sản — cùng luật bản mốc với `withBaselineMonth`. */
export function planPeriodRows(
  items: readonly AuctionPlanItem[],
  outcomes: ReadonlyMap<string, PlanPeriodOutcome | null>,
  baseline: AuctionPlanBaseline | null | undefined,
): PlanPeriodRow[] {
  const bl = baselineItemMap(baseline);
  return items.map((item) => {
    const frozen = bl.get(item.id);
    return {
      itemId: item.id,
      itemCode: item.item_code,
      title: item.title,
      planned: !!frozen || item.exec_status !== "dropped",
      baselineMonth: frozen ? frozen.month : item.planned_month,
      baselineExpected: frozen ? frozen.expected : num(item.expected_start_value),
      outcome: outcomes.get(item.id) ?? null,
    };
  });
}

/* ─── Luật A5 ─────────────────────────────────────────────────────────────── */

export interface PlanVsActual {
  period: PlanPeriod;
  periodEnd: string;
  /** Tài sản có tháng bản mốc trong kỳ. */
  plannedCount: number;
  /** Σ giá trị khởi điểm dự kiến của những tài sản đó. */
  plannedStartValue: number;
  /** Tài sản có kết quả phiên (bất kỳ) trong kỳ. */
  offeredCount: number;
  /** Tài sản đấu thành trong kỳ — KHÔNG tính người trúng bỏ cọc. */
  soldCount: number;
  /** Σ giá khởi điểm THẬT của các phiên trong kỳ. */
  actualStartValue: number;
  /** Σ giá trúng của tài sản đấu thành (luật `winning_total` của Chỉ tiêu). */
  winningTotal: number;
  /** "Đã thu" cash-strict = recorded + estimated (luật recoveryOf). */
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  /** soldCount ÷ plannedCount, làm tròn XUỐNG; null khi kỳ không có tài sản nào theo kế hoạch. */
  donePct: number | null;
}

const inPeriod = (day: string | null, start: string, end: string): boolean =>
  !!day && day >= start && day <= end;

/** Dòng kế hoạch → đầu vào của luật Chỉ tiêu (một nguồn luật tiền duy nhất). */
function targetInputOf(row: PlanPeriodRow): TargetInput | null {
  const o = row.outcome;
  if (!o?.outcome || !o.auction_date) return null;
  return {
    key: row.itemId,
    outcome: o.outcome as ResolvedOutcomeKind,
    day: o.auction_date,
    branchId: null,
    price: o.winning_price === null || o.winning_price === undefined ? null : num(o.winning_price),
    paymentStatus: (o.payment_status ?? null) as OutcomePaymentStatus | null,
    paidAmount: o.paid_amount === null || o.paid_amount === undefined ? null : num(o.paid_amount),
  };
}

/**
 * Bảng chỉ số A5 cho một kỳ.
 *
 * Cột THỰC TẾ đi qua `summarizeTargetInputs` của Chỉ tiêu: offered / sold /
 * winningTotal / collected là CÙNG MỘT phép tính với trang Chỉ tiêu và với
 * `owner_report_recovery` ở SQL. Chỉ "Giá trị khởi điểm (thực tế)" được cộng ở
 * đây, vì Chỉ tiêu không có tiêu chí đó.
 */
export function planVsActual(rows: readonly PlanPeriodRow[], period: PlanPeriod): PlanVsActual {
  const start = period.start;
  const end = planPeriodEnd(period);

  let plannedCount = 0;
  let plannedStartValue = 0;
  let actualStartValue = 0;
  const inputs: TargetInput[] = [];

  for (const row of rows) {
    if (row.planned && inPeriod(row.baselineMonth, start, end)) {
      plannedCount += 1;
      plannedStartValue += row.baselineExpected;
    }
    const input = targetInputOf(row);
    if (!input) continue;
    inputs.push(input);
    if (inPeriod(input.day, start, end)) actualStartValue += Math.max(0, num(row.outcome?.starting_price));
  }

  const summary: RecoverySummary = summarizeTargetInputs(inputs, { start, end, branchId: null });

  return {
    period,
    periodEnd: end,
    plannedCount,
    plannedStartValue,
    offeredCount: summary.offeredCount,
    soldCount: summary.soldCount,
    actualStartValue,
    winningTotal: summary.winningTotal,
    collected: summary.collected,
    recorded: summary.recorded,
    estimated: summary.estimated,
    awaiting: summary.awaiting,
    donePct: plannedCount > 0 ? Math.floor((summary.soldCount * 100) / plannedCount) : null,
  };
}

/* ─── Chuỗi 12 tháng cho biểu đồ ──────────────────────────────────────────── */

export interface PlanMonthPoint {
  /** "2026-11". */
  key: string;
  /** "T11". */
  label: string;
  plannedCount: number;
  plannedStartValue: number;
  soldCount: number;
  winningTotal: number;
}

/** Kế hoạch so thực tế của từng tháng trong năm — nguồn của biểu đồ cột. */
export function planVsActualByMonth(rows: readonly PlanPeriodRow[], planYear: number): PlanMonthPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const period: PlanPeriod = { type: "month", start: `${planYear}-${PAD(i + 1)}-01` };
    const m = planVsActual(rows, period);
    return {
      key: planPeriodKey(period),
      label: `T${i + 1}`,
      plannedCount: m.plannedCount,
      plannedStartValue: m.plannedStartValue,
      soldCount: m.soldCount,
      winningTotal: m.winningTotal,
    };
  });
}

/* ─── Tài sản của kỳ (bảng L4) ────────────────────────────────────────────── */

export type PlanPeriodMembership = "planned" | "actual" | "both";

export interface PlanPeriodItem {
  row: PlanPeriodRow;
  membership: PlanPeriodMembership;
}

/**
 * Tài sản liên quan tới kỳ: theo kế hoạch (tháng bản mốc trong kỳ), có kết quả
 * trong kỳ, hoặc cả hai. Tài sản theo kế hoạch của kỳ mà kết quả rơi sang kỳ
 * khác vẫn phải hiện — đó chính là cái đơn vị cần thấy.
 */
export function planPeriodItems(rows: readonly PlanPeriodRow[], period: PlanPeriod): PlanPeriodItem[] {
  const start = period.start;
  const end = planPeriodEnd(period);
  const out: PlanPeriodItem[] = [];
  for (const row of rows) {
    const isPlanned = row.planned && inPeriod(row.baselineMonth, start, end);
    const isActual = !!row.outcome?.outcome && inPeriod(row.outcome.auction_date, start, end);
    if (!isPlanned && !isActual) continue;
    out.push({ row, membership: isPlanned && isActual ? "both" : isPlanned ? "planned" : "actual" });
  }
  return out;
}

/* ─── Chỉ tiêu sinh từ kế hoạch (A5 → owner_save_target) ──────────────────── */

export interface PlanQuarterGoal {
  /** 1..4. */
  quarter: number;
  /** "2026-04-01" — khớp CHECK `owt_period_aligned`. */
  periodStart: string;
  label: string;
  /** Tiêu chí `offered_count` = số tài sản theo kế hoạch của quý. */
  offeredCount: number;
  /** Tiêu chí `winning_total` = Σ giá trị khởi điểm dự kiến của quý. */
  winningTotal: number;
}

/**
 * Các quý CÓ tài sản theo kế hoạch → mục tiêu đề nghị cho Chỉ tiêu.
 *
 * Quý không có tài sản nào thì KHÔNG sinh chỉ tiêu (một chỉ tiêu mục tiêu 0
 * không có nghĩa, và `owner_save_target` đòi `goal > 0`).
 */
export function planQuarterGoals(rows: readonly PlanPeriodRow[], planYear: number): PlanQuarterGoal[] {
  return [1, 2, 3, 4].flatMap((quarter) => {
    const period: PlanPeriod = { type: "quarter", start: `${planYear}-${PAD((quarter - 1) * 3 + 1)}-01` };
    const m = planVsActual(rows, period);
    if (m.plannedCount <= 0 || m.plannedStartValue <= 0) return [];
    return [
      {
        quarter,
        periodStart: period.start,
        label: planPeriodLabel(period),
        offeredCount: m.plannedCount,
        winningTotal: m.plannedStartValue,
      },
    ];
  });
}

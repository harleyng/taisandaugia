// Chỉ tiêu của Trạm Điều Hành (docs/owner-control-tower-plan.md Phase 9, §A5).
//
// Thuần (không React/Supabase) để test được. Mỗi chỉ tiêu (một kỳ + một phạm vi) có
// tên và 1..4 TIÊU CHÍ (bảng owner_workspace_target_criteria, mig 20260927124605).
// Bảng chỉ lưu MỤC TIÊU; số thực tế được TÍNH ở đây từ các dòng kết quả đã hợp nhất
// (RPC owner_outcomes_overview — cùng nguồn với trang "Kết quả phiên"). Báo cáo định
// kỳ ở SQL (owner_build_report_payload) chép ĐÚNG luật recoveryOf() cho 2 tiêu chí
// recovered_amount / sold_count.

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { dayDiff } from "@/lib/ownerPulse";
import type { OutcomePaymentStatus, ResolvedOutcomeKind } from "@/lib/ownerOutcomes";
import { formatMoneyShort } from "@/utils/money";

// ─── Kỳ ──────────────────────────────────────────────────────────────────────

export const TARGET_PERIOD_TYPES = ["month", "quarter", "year"] as const;
export type TargetPeriodType = (typeof TARGET_PERIOD_TYPES)[number];

export const TARGET_PERIOD_LABEL: Record<TargetPeriodType, string> = {
  month: "Tháng",
  quarter: "Quý",
  year: "Năm",
};

const MONTHS_PER_PERIOD: Record<TargetPeriodType, number> = { month: 1, quarter: 3, year: 12 };
const ROMAN_QUARTER = ["I", "II", "III", "IV"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const yearOf = (day: string) => Number(day.slice(0, 4));
const monthOf = (day: string) => Number(day.slice(5, 7));

/** Ngày đầu của kỳ chứa `day` (YYYY-MM-DD) — khớp CHECK owt_period_aligned. */
export function periodStartOf(type: TargetPeriodType, day: string): string {
  const y = yearOf(day);
  if (type === "year") return ymd(y, 1, 1);
  const m = monthOf(day);
  return type === "month" ? ymd(y, m, 1) : ymd(y, Math.floor((m - 1) / 3) * 3 + 1, 1);
}

/** Ngày CUỐI của kỳ (tính cả ngày đó). */
export function periodEndOf(type: TargetPeriodType, start: string): string {
  const y = yearOf(start);
  const lastMonth = monthOf(start) + MONTHS_PER_PERIOD[type] - 1;
  return ymd(y, lastMonth, daysInMonth(y, lastMonth));
}

/** Dời `n` kỳ (âm = lùi). */
export function shiftPeriod(type: TargetPeriodType, start: string, n: number): string {
  const total = yearOf(start) * 12 + (monthOf(start) - 1) + n * MONTHS_PER_PERIOD[type];
  return ymd(Math.floor(total / 12), (total % 12) + 1, 1);
}

/** "tháng 9/2026" · "quý III/2026" · "năm 2026". */
export function periodLabel(type: TargetPeriodType, start: string): string {
  const y = yearOf(start);
  const m = monthOf(start);
  if (type === "month") return `tháng ${m}/${y}`;
  if (type === "quarter") return `quý ${ROMAN_QUARTER[Math.floor((m - 1) / 3)]}/${y}`;
  return `năm ${y}`;
}

export function periodContains(type: TargetPeriodType, start: string, day: string): boolean {
  return day >= start && day <= periodEndOf(type, start);
}

export interface PeriodOption {
  start: string;
  label: string;
}

/** Kỳ hiện tại + các kỳ sắp tới để chọn khi đặt chỉ tiêu (năm: năm nay và năm sau). */
export function periodOptions(type: TargetPeriodType, today: string): PeriodOption[] {
  const first = periodStartOf(type, today);
  const count = type === "year" ? 2 : 4;
  return Array.from({ length: count }, (_, i) => {
    const start = shiftPeriod(type, first, i);
    return { start, label: periodLabel(type, start) };
  });
}

// ─── Tiêu chí ────────────────────────────────────────────────────────────────

/** Khớp CHECK metric của owner_workspace_target_criteria. */
export const TARGET_METRICS = ["recovered_amount", "winning_total", "sold_count", "offered_count"] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

export type TargetMetricUnit = "money" | "count";

export const TARGET_METRIC_META: Record<TargetMetric, { label: string; unit: TargetMetricUnit; hint: string }> = {
  recovered_amount: {
    label: "Số tiền thu hồi",
    unit: "money",
    hint: "Tiền thu về từ các phiên trong kỳ",
  },
  winning_total: {
    label: "Tổng giá trúng",
    unit: "money",
    hint: "Giá trúng của tài sản đấu thành, kể cả chưa thu tiền",
  },
  sold_count: {
    label: "Số tài sản đấu thành",
    unit: "count",
    hint: "Không tính tài sản người trúng bỏ cọc",
  },
  offered_count: {
    label: "Số tài sản đưa ra đấu giá",
    unit: "count",
    hint: "Mọi tài sản có kết quả phiên trong kỳ",
  },
};

/** Tiêu chí tiền: tối đa NUMERIC(18,0); đếm tài sản: CHECK owtc_count_goal. */
const MAX_GOAL_DIGITS: Record<TargetMetricUnit, number> = { money: 18, count: 6 };

/** "12.5 tỷ" hoặc "12" — theo đơn vị của tiêu chí. */
export function formatMetricValue(metric: TargetMetric, value: number | null): string {
  if (TARGET_METRIC_META[metric].unit === "money") return formatMoneyShort(value);
  return (value ?? 0).toLocaleString("en-US");
}

export interface TargetCriterion {
  metric: TargetMetric;
  goal: number;
}

// ─── Chỉ tiêu ────────────────────────────────────────────────────────────────

export type OwnerTargetRow = Database["public"]["Tables"]["owner_workspace_targets"]["Row"];
type CriterionRow = Pick<
  Database["public"]["Tables"]["owner_workspace_target_criteria"]["Row"],
  "metric" | "goal" | "sort_order"
>;

export interface OwnerTarget {
  id: string;
  workspaceId: string;
  /** null = cả đơn vị. */
  branchId: string | null;
  periodType: TargetPeriodType;
  periodStart: string;
  /** null ⇒ hiện tên tự sinh (targetDisplayName). */
  name: string | null;
  /** Theo sort_order. */
  criteria: TargetCriterion[];
  /** Mục tiêu của tiêu chí recovered_amount — dẫn xuất cho Tổng quan (null nếu không có). */
  targetAmount: number | null;
  /** Mục tiêu của tiêu chí sold_count — dẫn xuất cho Tổng quan (null nếu không có). */
  targetCount: number | null;
}

const goalOf = (criteria: TargetCriterion[], metric: TargetMetric) =>
  criteria.find((c) => c.metric === metric)?.goal ?? null;

/** Dựng OwnerTarget: targetAmount / targetCount luôn suy từ tiêu chí, không bao giờ nhập tay. */
export function ownerTargetOf(fields: Omit<OwnerTarget, "targetAmount" | "targetCount">): OwnerTarget {
  return {
    ...fields,
    targetAmount: goalOf(fields.criteria, "recovered_amount"),
    targetCount: goalOf(fields.criteria, "sold_count"),
  };
}

const isMetric = (v: string): v is TargetMetric => (TARGET_METRICS as readonly string[]).includes(v);

export function mapTargetRow(row: OwnerTargetRow & { criteria?: CriterionRow[] | null }): OwnerTarget | null {
  if (!(TARGET_PERIOD_TYPES as readonly string[]).includes(row.period_type)) return null;
  const criteria = [...(row.criteria ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((c) => (isMetric(c.metric) ? [{ metric: c.metric, goal: Number(c.goal) }] : []));
  return ownerTargetOf({
    id: row.id,
    workspaceId: row.workspace_id,
    branchId: row.branch_id,
    periodType: row.period_type as TargetPeriodType,
    periodStart: row.period_start,
    name: row.name?.trim() || null,
    criteria,
  });
}

/** Cả đơn vị trước rồi tới chi nhánh; mỗi phạm vi tháng → quý → năm. */
const byScopeThenType = (a: OwnerTarget, b: OwnerTarget) =>
  Number(a.branchId !== null) - Number(b.branchId !== null) ||
  (a.branchId ?? "").localeCompare(b.branchId ?? "") ||
  TARGET_PERIOD_TYPES.indexOf(a.periodType) - TARGET_PERIOD_TYPES.indexOf(b.periodType);

/** Chỉ tiêu của kỳ đang diễn ra, cả đơn vị trước rồi tới chi nhánh; mỗi phạm vi tháng → quý → năm. */
export function currentTargets(targets: OwnerTarget[], today: string): OwnerTarget[] {
  return targets.filter((t) => periodContains(t.periodType, t.periodStart, today)).sort(byScopeThenType);
}

export type TargetTiming = "current" | "upcoming" | "past";

export function targetTiming(target: OwnerTarget, today: string): TargetTiming {
  if (today < target.periodStart) return "upcoming";
  return today > periodEndOf(target.periodType, target.periodStart) ? "past" : "current";
}

// ─── Số đã thu ───────────────────────────────────────────────────────────────

/** Một tài sản ĐÃ BÁN (kết quả mới nhất của nó là "sold"). */
export interface RecoveryInput {
  /** Ngày phiên (YYYY-MM-DD) — quyết định thuộc kỳ nào; null ⇒ không thuộc kỳ nào. */
  day: string | null;
  branchId: string | null;
  /** Giá trúng đã hợp nhất. */
  price: number | null;
  /** null = nguồn không theo dõi thu tiền (tổ chức tự khai / tin cào). */
  paymentStatus: OutcomePaymentStatus | null;
  /** Số đã thu (chỉ bản ghi tự khai của đơn vị có). */
  paidAmount: number | null;
}

export interface RecoveryParts {
  /** false ⇒ người trúng bỏ cọc: không tính vào số tài sản đấu thành lẫn số tiền. */
  counted: boolean;
  /** Đơn vị đã ghi nhận thu (Đã thu đủ / Thu một phần; lô trên sàn "đã thanh toán"). */
  recorded: number;
  /** Nguồn không theo dõi thu tiền ⇒ tạm tính bằng giá trúng. */
  estimated: number;
  /** Đã bán nhưng tiền chưa về (chưa thu / phần còn lại của thu một phần). */
  awaiting: number;
}

const positive = (n: number | null) => (n !== null && Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Luật "Đã thu" (tính theo TIỀN THẬT, người dùng chốt 2026-09-26):
 * paid → paid_amount ?? giá trúng · partial → paid_amount · pending → 0 ·
 * defaulted → loại hẳn · không theo dõi thu tiền → giá trúng.
 */
export function recoveryOf(input: RecoveryInput): RecoveryParts {
  const price = positive(input.price);
  const paid = positive(input.paidAmount);
  switch (input.paymentStatus) {
    case "defaulted":
      return { counted: false, recorded: 0, estimated: 0, awaiting: 0 };
    case "paid":
      return { counted: true, recorded: input.paidAmount !== null ? paid : price, estimated: 0, awaiting: 0 };
    case "partial":
      return { counted: true, recorded: paid, estimated: 0, awaiting: Math.max(0, price - paid) };
    case "pending":
      return { counted: true, recorded: 0, estimated: 0, awaiting: price };
    default:
      return { counted: true, recorded: 0, estimated: price, awaiting: 0 };
  }
}

/**
 * Một tài sản có kết quả phiên (dòng "Kết quả phiên", mọi kết quả — không chỉ đã bán).
 * Tiêu chí "đưa ra đấu giá" đếm mọi dòng; các tiêu chí còn lại chỉ dòng đã bán.
 */
export interface TargetInput extends RecoveryInput {
  /** row_key của dòng Kết quả phiên — trang chi tiết nối lại để hiện tên tài sản. */
  key: string;
  outcome: ResolvedOutcomeKind;
}

export interface RecoverySummary {
  /** Đã thu = recorded + estimated. */
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  /** Số tài sản đấu thành (không tính bỏ cọc). */
  soldCount: number;
  /** Tổng giá trúng của tài sản đấu thành (không tính bỏ cọc). */
  winningTotal: number;
  /** Tài sản có kết quả phiên trong kỳ — mọi kết quả, kể cả bỏ cọc. */
  offeredCount: number;
}

export const EMPTY_RECOVERY: RecoverySummary = {
  collected: 0,
  recorded: 0,
  estimated: 0,
  awaiting: 0,
  soldCount: 0,
  winningTotal: 0,
  offeredCount: 0,
};

export interface RecoveryScope {
  start: string;
  /** Tính cả ngày này. */
  end: string;
  /** null = mọi chi nhánh (kể cả tài sản không thuộc chi nhánh nào). */
  branchId: string | null;
}

/** Ngày phiên nằm trong kỳ (tính cả hai đầu) và đúng chi nhánh; không ngày ⇒ không thuộc kỳ nào. */
function inScope(input: TargetInput, scope: RecoveryScope): boolean {
  if (!input.day || input.day < scope.start || input.day > scope.end) return false;
  return scope.branchId === null || input.branchId === scope.branchId;
}

/**
 * Phần một tài sản góp vào một tiêu chí; null = không góp (không hiện trong bảng số
 * liệu cấu thành). Tổng các phần = actualOf(metric, summarizeTargetInputs(...)).
 */
export function contributionOf(metric: TargetMetric, input: TargetInput): number | null {
  if (metric === "offered_count") return 1;
  if (input.outcome !== "sold") return null;
  const parts = recoveryOf(input);
  if (!parts.counted) return null;
  if (metric === "sold_count") return 1;
  if (metric === "winning_total") return positive(input.price);
  return parts.recorded + parts.estimated;
}

export function summarizeTargetInputs(inputs: TargetInput[], scope: RecoveryScope): RecoverySummary {
  const sum = { ...EMPTY_RECOVERY };
  for (const input of inputs) {
    if (!inScope(input, scope)) continue;
    sum.offeredCount += 1;
    if (input.outcome !== "sold") continue;
    const parts = recoveryOf(input);
    if (!parts.counted) continue;
    sum.soldCount += 1;
    sum.winningTotal += positive(input.price);
    sum.recorded += parts.recorded;
    sum.estimated += parts.estimated;
    sum.awaiting += parts.awaiting;
  }
  sum.collected = sum.recorded + sum.estimated;
  return sum;
}

/** Số thực tế của một tiêu chí. */
export function actualOf(metric: TargetMetric, summary: RecoverySummary): number {
  switch (metric) {
    case "recovered_amount":
      return summary.collected;
    case "winning_total":
      return summary.winningTotal;
    case "sold_count":
      return summary.soldCount;
    case "offered_count":
      return summary.offeredCount;
  }
}

/**
 * Phần của một dòng "Kết quả phiên" (RPC owner_outcomes_overview, Phase 8) mà chỉ
 * tiêu cần — OutcomeOverviewRow khớp cấu trúc này. Dựng từ CÙNG các dòng mà trang
 * /chu-tai-san/ket-qua đếm ⇒ số tài sản và kỳ của hai màn luôn khớp: tin trên sàn
 * lấy kết quả hợp nhất (chi nhánh suy từ claim), tài sản ngoài sàn lấy lượt MỚI NHẤT
 * (mỗi tài sản chỉ tính ở kỳ của kết quả mới nhất); paid_amount chỉ có khi bản ghi tự
 * khai thuộc lượt hiện tại.
 */
export interface RecoverySourceRow {
  rowKey: string;
  outcome: ResolvedOutcomeKind | null;
  date: string | null;
  branchId: string | null;
  price: number | null;
  paymentStatus: OutcomePaymentStatus | null;
  paidAmount: number | null;
}

/** Mỗi tài sản có kết quả một TargetInput (bỏ dòng chưa có kết quả). */
export function targetInputsFromOverview(rows: RecoverySourceRow[]): TargetInput[] {
  return rows.flatMap((r) =>
    r.outcome
      ? [
          {
            key: r.rowKey,
            outcome: r.outcome,
            day: r.date,
            branchId: r.branchId,
            price: r.price,
            paymentStatus: r.paymentStatus,
            paidAmount: r.paidAmount,
          },
        ]
      : [],
  );
}

// ─── Tiến độ ─────────────────────────────────────────────────────────────────

export interface CriterionProgress {
  metric: TargetMetric;
  goal: number;
  actual: number;
  /** Làm tròn XUỐNG (99.6% không hiện thành 100%); có thể > 100. */
  pct: number;
  remaining: number;
  /** Cần thêm mỗi tuần để kịp; null khi đã đạt hoặc kỳ đã hết. */
  weeklyPace: number | null;
  met: boolean;
}

export interface TargetProgress {
  target: OwnerTarget;
  periodEnd: string;
  periodLabel: string;
  summary: RecoverySummary;
  /** Số ngày còn lại, tính cả hôm nay; 0 khi kỳ đã hết. */
  daysLeft: number;
  /** Theo thứ tự tiêu chí của chỉ tiêu. */
  criteria: CriterionProgress[];
  /** Trung bình % các tiêu chí (mỗi tiêu chí tối đa 100), làm tròn xuống; null khi không có tiêu chí. */
  overallPct: number | null;
  /** Số tiêu chí đã đạt. */
  metCount: number;
  /** Mọi tiêu chí đều đạt (chỉ tiêu không có tiêu chí nào ⇒ false). */
  achieved: boolean;
  // Dẫn xuất từ 2 tiêu chí recovered_amount / sold_count — Tổng quan dùng.
  amountPct: number | null;
  countPct: number | null;
  amountRemaining: number | null;
  countRemaining: number | null;
  weeklyAmountPace: number | null;
  weeklyCountPace: number | null;
}

/** Kỳ + phạm vi của một chỉ tiêu — dùng để lọc số liệu cấu thành. */
export const targetRange = (p: TargetProgress): RecoveryScope => ({
  start: p.target.periodStart,
  end: p.periodEnd,
  branchId: p.target.branchId,
});

export function computeTargetProgress(target: OwnerTarget, inputs: TargetInput[], today: string): TargetProgress {
  const periodEnd = periodEndOf(target.periodType, target.periodStart);
  const summary = summarizeTargetInputs(inputs, { start: target.periodStart, end: periodEnd, branchId: target.branchId });

  const daysLeft = today > periodEnd ? 0 : dayDiff(today < target.periodStart ? target.periodStart : today, periodEnd) + 1;
  // Tuần cuối cùng: cả phần còn thiếu dồn vào một tuần, không chia nhỏ hơn.
  const weeks = Math.max(1, daysLeft / 7);

  const criteria = target.criteria.map((c): CriterionProgress => {
    const actual = actualOf(c.metric, summary);
    const remaining = Math.max(0, c.goal - actual);
    return {
      metric: c.metric,
      goal: c.goal,
      actual,
      pct: Math.floor((actual / c.goal) * 100),
      remaining,
      weeklyPace: remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / weeks) : null,
      met: remaining === 0,
    };
  });
  const metCount = criteria.filter((c) => c.met).length;
  const overallPct = criteria.length
    ? Math.floor(criteria.reduce((s, c) => s + Math.min(100, c.pct), 0) / criteria.length)
    : null;
  const amount = criteria.find((c) => c.metric === "recovered_amount");
  const count = criteria.find((c) => c.metric === "sold_count");

  return {
    target,
    periodEnd,
    periodLabel: periodLabel(target.periodType, target.periodStart),
    summary,
    daysLeft,
    criteria,
    overallPct,
    metCount,
    achieved: criteria.length > 0 && metCount === criteria.length,
    amountPct: amount?.pct ?? null,
    countPct: count?.pct ?? null,
    amountRemaining: amount?.remaining ?? null,
    countRemaining: count?.remaining ?? null,
    weeklyAmountPace: amount?.weeklyPace ?? null,
    weeklyCountPace: count?.weeklyPace ?? null,
  };
}

// ─── Số liệu cấu thành (trang chi tiết) ──────────────────────────────────────

export interface CriterionContribution {
  input: TargetInput;
  /** Phần góp vào tiêu chí (tiền hoặc 1 tài sản). */
  value: number;
}

export interface CriterionBreakdown {
  /** Ngày phiên mới nhất trước; cùng ngày thì phần góp lớn trước. */
  rows: CriterionContribution[];
  /** = actual của tiêu chí. */
  total: number;
  /** Tài sản đã bán trong kỳ nhưng người trúng bỏ cọc — không tính (trừ "đưa ra đấu giá"). */
  defaultedCount: number;
}

export function criterionBreakdown(metric: TargetMetric, inputs: TargetInput[], scope: RecoveryScope): CriterionBreakdown {
  const rows: CriterionContribution[] = [];
  let defaultedCount = 0;
  for (const input of inputs) {
    if (!inScope(input, scope)) continue;
    const value = contributionOf(metric, input);
    if (value !== null) rows.push({ input, value });
    else if (input.outcome === "sold" && input.paymentStatus === "defaulted") defaultedCount += 1;
  }
  rows.sort((a, b) => (b.input.day ?? "").localeCompare(a.input.day ?? "") || b.value - a.value);
  return { rows, total: rows.reduce((s, r) => s + r.value, 0), defaultedCount };
}

export const TARGET_STATUSES = ["in_progress", "completed", "failed"] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  in_progress: "Đang thực hiện",
  completed: "Đã hoàn thành",
  failed: "Không hoàn thành",
};

/**
 * Trạng thái theo KỲ (người dùng chốt 2026-09-27): kỳ chưa hết ⇒ đang thực hiện,
 * kể cả đã đạt sớm (số đã thu còn tăng, vẫn sửa được); hết kỳ mới chốt đạt / không đạt.
 */
export function targetStatus(progress: TargetProgress, today: string): TargetStatus {
  if (targetTiming(progress.target, today) !== "past") return "in_progress";
  return progress.achieved ? "completed" : "failed";
}

export type TargetGroups = Record<TargetStatus, TargetProgress[]>;

/**
 * Chia chỉ tiêu cho trang "Chỉ tiêu". Đang thực hiện: kỳ đang diễn ra trước (thứ
 * tự của currentTargets()), rồi kỳ sắp tới gần nhất trước. Đã chốt: kỳ mới nhất trước.
 */
export function groupTargetsByStatus(progress: TargetProgress[], today: string): TargetGroups {
  const groups: TargetGroups = { in_progress: [], completed: [], failed: [] };
  for (const p of progress) groups[targetStatus(p, today)].push(p);

  const start = (p: TargetProgress) => p.target.periodStart;
  const upcoming = (p: TargetProgress) => Number(targetTiming(p.target, today) === "upcoming");
  const newestFirst = (a: TargetProgress, b: TargetProgress) =>
    start(b).localeCompare(start(a)) || byScopeThenType(a.target, b.target);

  groups.in_progress.sort(
    (a, b) =>
      upcoming(a) - upcoming(b) ||
      (upcoming(a) ? start(a).localeCompare(start(b)) : 0) ||
      byScopeThenType(a.target, b.target),
  );
  groups.completed.sort(newestFirst);
  groups.failed.sort(newestFirst);
  return groups;
}

// ─── Form đặt chỉ tiêu ───────────────────────────────────────────────────────

/** Trang quản lý chỉ tiêu (Tổng quan chỉ hiện tiến độ). */
export const OWNER_TARGETS_HREF = "/chu-tai-san/chi-tieu";
/** Trang chi tiết một chỉ tiêu: tiêu chí + số liệu cấu thành. */
export const ownerTargetHref = (id: string) => `${OWNER_TARGETS_HREF}/${id}`;
/** Trang "Đặt chỉ tiêu" (form đầy đủ, không phải dialog). */
export const OWNER_TARGET_NEW_HREF = `${OWNER_TARGETS_HREF}/moi`;
/** Trang "Sửa chỉ tiêu" — chỉ khi kỳ chưa hết. */
export const ownerTargetEditHref = (id: string) => `${OWNER_TARGETS_HREF}/${id}/sua`;

/** Giá trị "Phạm vi" cho cả đơn vị (còn lại là workspace_branches.id). */
export const SCOPE_ALL = "all";

/** Phạm vi của một chỉ tiêu theo giá trị "Phạm vi" của form. */
export const targetScopeOf = (target: OwnerTarget): string => target.branchId ?? SCOPE_ALL;

/** "Toàn đơn vị" hoặc tên chi nhánh. */
export function targetScopeLabel(scope: string, branches: readonly { id: string; label: string }[]): string {
  if (scope === SCOPE_ALL) return "Toàn đơn vị";
  return branches.find((b) => b.id === scope)?.label ?? "Chi nhánh";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tên tự sinh: "Quý IV/2026 · Toàn đơn vị". */
export function autoTargetName(
  periodType: TargetPeriodType,
  periodStart: string,
  scope: string,
  branches: readonly { id: string; label: string }[],
): string {
  return `${capitalize(periodLabel(periodType, periodStart))} · ${targetScopeLabel(scope, branches)}`;
}

/** Tên đặt tay, hoặc tên tự sinh (theo tên chi nhánh HIỆN TẠI). */
export function targetDisplayName(target: OwnerTarget, branches: readonly { id: string; label: string }[]): string {
  return target.name ?? autoTargetName(target.periodType, target.periodStart, targetScopeOf(target), branches);
}

const digits = z.string().regex(/^\d*$/, "Chỉ nhập số");

export const targetFormSchema = z
  .object({
    name: z.string().max(120, "Tên tối đa 120 ký tự"),
    periodType: z.enum(TARGET_PERIOD_TYPES),
    periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, "Chọn kỳ"),
    scope: z.string().min(1, "Chọn phạm vi"),
    criteria: z
      .array(z.object({ metric: z.enum(TARGET_METRICS), goal: digits }))
      .min(1, "Thêm ít nhất một tiêu chí"),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<TargetMetric>();
    v.criteria.forEach((c, i) => {
      const significant = c.goal.replace(/^0+/, "");
      if (!significant) {
        ctx.addIssue({ code: "custom", path: ["criteria", i, "goal"], message: "Nhập mục tiêu lớn hơn 0" });
      } else if (significant.length > MAX_GOAL_DIGITS[TARGET_METRIC_META[c.metric].unit]) {
        ctx.addIssue({ code: "custom", path: ["criteria", i, "goal"], message: "Số quá lớn" });
      }
      if (seen.has(c.metric)) {
        ctx.addIssue({ code: "custom", path: ["criteria", i, "metric"], message: "Tiêu chí này đã có" });
      }
      seen.add(c.metric);
    });
  });

export type TargetForm = z.infer<typeof targetFormSchema>;
export type TargetCriterionForm = TargetForm["criteria"][number];

/** Tiêu chí mặc định của chỉ tiêu mới. */
export const NEW_CRITERION: TargetCriterionForm = { metric: "recovered_amount", goal: "" };

export const criteriaToForm = (criteria: TargetCriterion[]): TargetCriterionForm[] =>
  criteria.map((c) => ({ metric: c.metric, goal: String(Math.round(c.goal)) }));

/** Loại tiêu chí đầu tiên chưa dùng (nút "Thêm tiêu chí"); null khi đã đủ cả 4. */
export function nextUnusedMetric(used: readonly TargetMetric[]): TargetMetric | null {
  return TARGET_METRICS.find((m) => !used.includes(m)) ?? null;
}

/** `fallback.name` = tên tự sinh của kỳ + phạm vi đó (chỉ tiêu có sẵn không đặt tên thì hiện tên này). */
export function targetFormDefaults(
  target: OwnerTarget | null,
  fallback: { periodType: TargetPeriodType; periodStart: string; scope: string; name: string },
): TargetForm {
  if (!target) return { ...fallback, criteria: [NEW_CRITERION] };
  return {
    name: target.name ?? fallback.name,
    periodType: target.periodType,
    periodStart: target.periodStart,
    scope: target.branchId ?? SCOPE_ALL,
    criteria: target.criteria.length ? criteriaToForm(target.criteria) : [NEW_CRITERION],
  };
}

/** Chỉ tiêu đã có của đúng kỳ + phạm vi (form chuyển sang sửa nó). */
export function findTarget(
  targets: OwnerTarget[],
  periodType: TargetPeriodType,
  periodStart: string,
  scope: string,
): OwnerTarget | null {
  const branchId = scope === SCOPE_ALL ? null : scope;
  return (
    targets.find(
      (t) => t.periodType === periodType && t.periodStart === periodStart && t.branchId === branchId,
    ) ?? null
  );
}

/** Tham số RPC owner_save_target (NULL hợp lệ ở server dù kiểu sinh tự động coi là bắt buộc). */
export interface TargetSaveArgs {
  p_workspace_id: string;
  p_target_id: string | null;
  p_branch_id: string | null;
  p_period_type: TargetPeriodType;
  p_period_start: string;
  p_name: string | null;
  /** goal gửi dạng chuỗi số: số tiền 18 chữ số vượt Number.MAX_SAFE_INTEGER. */
  p_criteria: { metric: TargetMetric; goal: string }[];
}

/**
 * Tên để trống hoặc trùng tên tự sinh ⇒ lưu NULL: tên hiển thị đi theo kỳ + phạm vi
 * (và theo tên chi nhánh khi đổi tên), không đóng băng chuỗi cũ.
 */
export function toTargetSaveArgs(
  form: TargetForm,
  ctx: { workspaceId: string; targetId: string | null; autoName: string },
): TargetSaveArgs {
  const name = form.name.trim();
  return {
    p_workspace_id: ctx.workspaceId,
    p_target_id: ctx.targetId,
    p_branch_id: form.scope === SCOPE_ALL ? null : form.scope,
    p_period_type: form.periodType,
    p_period_start: form.periodStart,
    p_name: name && name !== ctx.autoName ? name : null,
    p_criteria: form.criteria.map((c) => ({ metric: c.metric, goal: c.goal.replace(/^0+/, "") })),
  };
}

export function targetErrorMessage(err: unknown): string {
  const e = (err && typeof err === "object" ? err : {}) as { code?: string; message?: string };
  if (e.code === "23505") return "Đã có chỉ tiêu cho kỳ và phạm vi này.";
  if (e.code === "42501") return "Chỉ Trưởng đơn vị mới đặt được chỉ tiêu.";
  if (e.code === "23514") return "Giá trị chỉ tiêu không hợp lệ. Vui lòng kiểm tra lại.";
  if (e.code === "P0001" && e.message) return e.message;
  return "Không lưu được chỉ tiêu. Vui lòng thử lại.";
}

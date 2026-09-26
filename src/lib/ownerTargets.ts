// Chỉ tiêu của Trạm Điều Hành (docs/owner-control-tower-plan.md Phase 9, §A5).
//
// Thuần (không React/Supabase) để test được. Bảng owner_workspace_targets chỉ
// lưu CHỈ TIÊU; số "đã thu" được TÍNH ở đây từ các dòng kết quả đã hợp nhất (RPC
// owner_outcomes_overview — cùng nguồn với trang "Kết quả phiên"). Phase 10 dựng
// payload báo cáo ở SQL phải chép ĐÚNG luật recoveryOf() + recoveryInputsFromOverview().

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { dayDiff } from "@/lib/ownerPulse";
import type { OutcomePaymentStatus } from "@/lib/ownerOutcomes";

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

// ─── Chỉ tiêu ────────────────────────────────────────────────────────────────

export type OwnerTargetRow = Database["public"]["Tables"]["owner_workspace_targets"]["Row"];

export interface OwnerTarget {
  id: string;
  workspaceId: string;
  /** null = cả đơn vị. */
  branchId: string | null;
  periodType: TargetPeriodType;
  periodStart: string;
  targetAmount: number | null;
  targetCount: number | null;
}

const numOrNull = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

export function mapTargetRow(row: OwnerTargetRow): OwnerTarget | null {
  if (!(TARGET_PERIOD_TYPES as readonly string[]).includes(row.period_type)) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    branchId: row.branch_id,
    periodType: row.period_type as TargetPeriodType,
    periodStart: row.period_start,
    targetAmount: numOrNull(row.target_amount),
    targetCount: numOrNull(row.target_count),
  };
}

/** Chỉ tiêu của kỳ đang diễn ra, cả đơn vị trước rồi tới chi nhánh; mỗi phạm vi tháng → quý → năm. */
export function currentTargets(targets: OwnerTarget[], today: string): OwnerTarget[] {
  return targets
    .filter((t) => periodContains(t.periodType, t.periodStart, today))
    .sort(
      (a, b) =>
        Number(a.branchId !== null) - Number(b.branchId !== null) ||
        (a.branchId ?? "").localeCompare(b.branchId ?? "") ||
        TARGET_PERIOD_TYPES.indexOf(a.periodType) - TARGET_PERIOD_TYPES.indexOf(b.periodType),
    );
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

export interface RecoverySummary {
  /** Đã thu = recorded + estimated. */
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  /** Số tài sản đấu thành (không tính bỏ cọc). */
  soldCount: number;
}

export const EMPTY_RECOVERY: RecoverySummary = {
  collected: 0,
  recorded: 0,
  estimated: 0,
  awaiting: 0,
  soldCount: 0,
};

export interface RecoveryScope {
  start: string;
  /** Tính cả ngày này. */
  end: string;
  /** null = mọi chi nhánh (kể cả tài sản không thuộc chi nhánh nào). */
  branchId: string | null;
}

export function summarizeRecovery(inputs: RecoveryInput[], scope: RecoveryScope): RecoverySummary {
  const sum = { ...EMPTY_RECOVERY };
  for (const input of inputs) {
    if (!input.day || input.day < scope.start || input.day > scope.end) continue;
    if (scope.branchId !== null && input.branchId !== scope.branchId) continue;
    const parts = recoveryOf(input);
    if (!parts.counted) continue;
    sum.soldCount += 1;
    sum.recorded += parts.recorded;
    sum.estimated += parts.estimated;
    sum.awaiting += parts.awaiting;
  }
  sum.collected = sum.recorded + sum.estimated;
  return sum;
}

/**
 * Phần của một dòng "Kết quả phiên" (RPC owner_outcomes_overview, Phase 8) mà số
 * đã thu cần — OutcomeOverviewRow khớp cấu trúc này. Dựng từ CÙNG các dòng mà
 * trang /chu-tai-san/ket-qua đếm ⇒ số tài sản và kỳ của hai màn luôn khớp:
 * tin trên sàn lấy kết quả hợp nhất (chi nhánh suy từ claim), tài sản ngoài sàn
 * lấy lượt MỚI NHẤT; paid_amount chỉ có khi bản ghi tự khai thuộc lượt hiện tại.
 */
export interface RecoverySourceRow {
  outcome: string | null;
  date: string | null;
  branchId: string | null;
  price: number | null;
  paymentStatus: OutcomePaymentStatus | null;
  paidAmount: number | null;
}

/** Mỗi tài sản đã bán một RecoveryInput. */
export function recoveryInputsFromOverview(rows: RecoverySourceRow[]): RecoveryInput[] {
  return rows.flatMap((r) =>
    r.outcome === "sold"
      ? [{ day: r.date, branchId: r.branchId, price: r.price, paymentStatus: r.paymentStatus, paidAmount: r.paidAmount }]
      : [],
  );
}

// ─── Tiến độ ─────────────────────────────────────────────────────────────────

export interface TargetProgress {
  target: OwnerTarget;
  periodEnd: string;
  periodLabel: string;
  summary: RecoverySummary;
  /** Số ngày còn lại, tính cả hôm nay; 0 khi kỳ đã hết. */
  daysLeft: number;
  /** Phần trăm làm tròn XUỐNG (99.6% không hiện thành 100%); có thể > 100. */
  amountPct: number | null;
  countPct: number | null;
  amountRemaining: number | null;
  countRemaining: number | null;
  /** Cần thu thêm mỗi tuần để kịp chỉ tiêu; null khi đã đạt hoặc kỳ đã hết. */
  weeklyAmountPace: number | null;
  weeklyCountPace: number | null;
  /** Mọi chỉ tiêu đã đặt của kỳ đều đạt. */
  achieved: boolean;
}

const pct = (value: number, goal: number | null) => (goal ? Math.floor((value / goal) * 100) : null);

export function computeTargetProgress(
  target: OwnerTarget,
  inputs: RecoveryInput[],
  today: string,
): TargetProgress {
  const periodEnd = periodEndOf(target.periodType, target.periodStart);
  const summary = summarizeRecovery(inputs, {
    start: target.periodStart,
    end: periodEnd,
    branchId: target.branchId,
  });

  const daysLeft = today > periodEnd ? 0 : dayDiff(today < target.periodStart ? target.periodStart : today, periodEnd) + 1;
  // Tuần cuối cùng: cả phần còn thiếu dồn vào một tuần, không chia nhỏ hơn.
  const weeks = Math.max(1, daysLeft / 7);

  const amountRemaining =
    target.targetAmount !== null ? Math.max(0, target.targetAmount - summary.collected) : null;
  const countRemaining = target.targetCount !== null ? Math.max(0, target.targetCount - summary.soldCount) : null;
  const pace = (remaining: number | null) =>
    remaining && daysLeft > 0 ? Math.ceil(remaining / weeks) : null;

  return {
    target,
    periodEnd,
    periodLabel: periodLabel(target.periodType, target.periodStart),
    summary,
    daysLeft,
    amountPct: pct(summary.collected, target.targetAmount),
    countPct: pct(summary.soldCount, target.targetCount),
    amountRemaining,
    countRemaining,
    weeklyAmountPace: pace(amountRemaining),
    weeklyCountPace: pace(countRemaining),
    achieved: (amountRemaining ?? 0) === 0 && (countRemaining ?? 0) === 0,
  };
}

// ─── Form đặt chỉ tiêu ───────────────────────────────────────────────────────

/** Giá trị "Phạm vi" cho cả đơn vị (còn lại là workspace_branches.id). */
export const SCOPE_ALL = "all";

const digits = z.string().regex(/^\d*$/, "Chỉ nhập số");

export const targetFormSchema = z
  .object({
    periodType: z.enum(TARGET_PERIOD_TYPES),
    periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, "Chọn kỳ"),
    scope: z.string().min(1, "Chọn phạm vi"),
    amount: digits.max(18, "Số tiền quá lớn"),
    count: digits.max(6, "Số tài sản quá lớn"),
  })
  .superRefine((v, ctx) => {
    if (Number(v.amount || 0) <= 0 && Number(v.count || 0) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Nhập số tiền thu hồi hoặc số tài sản đấu thành",
      });
    }
  });

export type TargetForm = z.infer<typeof targetFormSchema>;

export function targetFormDefaults(
  target: OwnerTarget | null,
  fallback: { periodType: TargetPeriodType; periodStart: string; scope: string },
): TargetForm {
  if (!target) return { ...fallback, amount: "", count: "" };
  return {
    periodType: target.periodType,
    periodStart: target.periodStart,
    scope: target.branchId ?? SCOPE_ALL,
    amount: target.targetAmount ? String(Math.round(target.targetAmount)) : "",
    count: target.targetCount ? String(target.targetCount) : "",
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

type TargetInsert = Database["public"]["Tables"]["owner_workspace_targets"]["Insert"];

export function toTargetWrite(form: TargetForm, workspaceId: string): TargetInsert {
  const amount = Number(form.amount || 0);
  const count = Number(form.count || 0);
  return {
    workspace_id: workspaceId,
    branch_id: form.scope === SCOPE_ALL ? null : form.scope,
    period_type: form.periodType,
    period_start: form.periodStart,
    target_amount: amount > 0 ? amount : null,
    target_count: count > 0 ? count : null,
  };
}

export function targetErrorMessage(err: unknown): string {
  const e = (err && typeof err === "object" ? err : {}) as { code?: string; message?: string };
  if (e.code === "23505") return "Đã có chỉ tiêu cho kỳ và phạm vi này.";
  if (e.code === "42501") return "Chỉ Trưởng đơn vị mới đặt được chỉ tiêu.";
  if (e.code === "P0001" && e.message) return e.message;
  return "Không lưu được chỉ tiêu. Vui lòng thử lại.";
}

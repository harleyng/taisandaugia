// Phần HIỂN THỊ của trang "Chỉ tiêu" (bản thiết kế "Chi Tieu - Danh sach & Chi tiet").
//
// Thuần (không React) để test được. Luật tính số thực tế nằm ở ownerTargets.ts; file
// này chỉ dịch tiến độ sang những gì màn hình vẽ: ô kỳ, vạch thời gian, "chậm tiến độ",
// lọc danh sách, chỗ trống mặc định khi đặt mới, số kỳ trước và dòng chú thích thẻ tiêu chí.

import { dayDiff } from "@/lib/ownerPulse";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import {
  SCOPE_ALL,
  TARGET_METRIC_META,
  TARGET_PERIOD_TYPES,
  actualOf,
  findTarget,
  periodEndOf,
  periodLabel,
  periodOptions,
  periodStartOf,
  shiftPeriod,
  summarizeTargetInputs,
  targetStatus,
  targetTiming,
  type CriterionProgress,
  type OwnerTarget,
  type TargetGroups,
  type TargetInput,
  type TargetMetric,
  type TargetPeriodType,
  type TargetProgress,
  type TargetTiming,
} from "@/lib/ownerTargets";

// ─── Kỳ ──────────────────────────────────────────────────────────────────────

const ROMAN_QUARTER = ["I", "II", "III", "IV"] as const;

/** "Tháng 9/2026" · "Quý III/2026" · "Năm 2026". */
export function periodTitle(type: TargetPeriodType, start: string): string {
  const label = periodLabel(type, start);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Ô kỳ: nhãn nhỏ + chữ lớn — "Tháng / 9", "Quý / III", "Năm / 26". */
export function periodTileParts(type: TargetPeriodType, start: string): { small: string; big: string } {
  const month = Number(start.slice(5, 7));
  if (type === "month") return { small: "Tháng", big: String(month) };
  if (type === "quarter") return { small: "Quý", big: ROMAN_QUARTER[Math.floor((month - 1) / 3)] };
  return { small: "Năm", big: start.slice(2, 4) };
}

/** Mô tả ngắn dưới nút chọn loại kỳ. */
export const PERIOD_TYPE_SPAN: Record<TargetPeriodType, string> = {
  month: "~30 ngày",
  quarter: "3 tháng",
  year: "12 tháng",
};

/** % thời gian của kỳ đã trôi qua: 0 trước kỳ, 100 sau kỳ. */
export function elapsedPct(type: TargetPeriodType, start: string, today: string): number {
  const end = periodEndOf(type, start);
  if (today < start) return 0;
  if (today > end) return 100;
  return Math.round((dayDiff(start, today) / (dayDiff(start, end) + 1)) * 100);
}

/** Tiến độ thua thời gian đã qua quá bao nhiêu điểm thì coi là chậm. */
export const BEHIND_MARGIN = 10;

export type TargetBarTone = "normal" | "behind" | "failed";

/** Màu thanh tiến độ: đỏ khi đã trượt, vàng khi kỳ đang chạy mà tiến độ chậm hơn thời gian. */
export function targetBarTone(p: TargetProgress, today: string): TargetBarTone {
  if (targetStatus(p, today) === "failed") return "failed";
  if (targetTiming(p.target, today) !== "current") return "normal";
  const elapsed = elapsedPct(p.target.periodType, p.target.periodStart, today);
  return (p.overallPct ?? 0) < elapsed - BEHIND_MARGIN ? "behind" : "normal";
}

export type TargetPillKind = "upcoming" | "running" | "met" | "missed";

export const TARGET_PILL_LABEL: Record<TargetPillKind, string> = {
  upcoming: "Sắp tới",
  running: "Đang thực hiện",
  met: "Đạt",
  missed: "Không đạt",
};

export function targetPillKind(p: TargetProgress, today: string): TargetPillKind {
  if (targetTiming(p.target, today) === "upcoming") return "upcoming";
  const status = targetStatus(p, today);
  return status === "completed" ? "met" : status === "failed" ? "missed" : "running";
}

/** Còn ≤ 7 ngày mà chưa đạt hết ⇒ tô đỏ số ngày còn lại. */
export const isTimeCritical = (p: TargetProgress, timing: TargetTiming) =>
  timing === "current" && p.daysLeft <= 7 && !p.achieved;

// ─── Danh sách ───────────────────────────────────────────────────────────────

/** Giá trị "tất cả" của hai bộ lọc (SCOPE_ALL đã dành cho "Toàn đơn vị"). */
export const ANY_FILTER = "tat-ca";

export interface TargetListFilter {
  /** ANY_FILTER · SCOPE_ALL · workspace_branches.id */
  scope: string;
  /** ANY_FILTER · month · quarter · year */
  type: string;
}

export function filterTargetGroups(groups: TargetGroups, f: TargetListFilter): TargetGroups {
  const keep = (p: TargetProgress) =>
    (f.scope === ANY_FILTER || (p.target.branchId ?? SCOPE_ALL) === f.scope) &&
    (f.type === ANY_FILTER || p.target.periodType === f.type);
  return {
    in_progress: groups.in_progress.filter(keep),
    completed: groups.completed.filter(keep),
    failed: groups.failed.filter(keep),
  };
}

/** Tab "Đang thực hiện" chia hai nhóm: kỳ đang diễn ra · sắp tới (giữ thứ tự đã sắp). */
export function splitInProgress(items: TargetProgress[], today: string) {
  return {
    current: items.filter((p) => targetTiming(p.target, today) === "current"),
    upcoming: items.filter((p) => targetTiming(p.target, today) === "upcoming"),
  };
}

// ─── Form đặt chỉ tiêu ───────────────────────────────────────────────────────

export interface TargetSlot {
  periodType: TargetPeriodType;
  periodStart: string;
  /** SCOPE_ALL hoặc workspace_branches.id. */
  scope: string;
}

/**
 * Chỉ tiêu mới mở sẵn ở kỳ + phạm vi ĐẦU TIÊN còn trống: tháng → quý → năm, kỳ hiện tại
 * trước kỳ sau, cả đơn vị trước chi nhánh. Kín hết ⇒ tháng này, cả đơn vị (form báo trùng).
 */
export function firstFreeSlot(targets: OwnerTarget[], branchIds: readonly string[], today: string): TargetSlot {
  for (const periodType of TARGET_PERIOD_TYPES) {
    for (const { start } of periodOptions(periodType, today)) {
      for (const scope of [SCOPE_ALL, ...branchIds]) {
        if (!findTarget(targets, periodType, start, scope)) return { periodType, periodStart: start, scope };
      }
    }
  }
  return { periodType: "month", periodStart: periodStartOf("month", today), scope: SCOPE_ALL };
}

/** Số thực tế của cùng tiêu chí ở kỳ liền trước (cùng loại kỳ, cùng phạm vi) — gợi ý khi nhập mục tiêu. */
export function previousPeriodActual(
  metric: TargetMetric,
  inputs: TargetInput[],
  slot: TargetSlot,
): number {
  const start = shiftPeriod(slot.periodType, slot.periodStart, -1);
  const summary = summarizeTargetInputs(inputs, {
    start,
    end: periodEndOf(slot.periodType, start),
    branchId: slot.scope === SCOPE_ALL ? null : slot.scope,
  });
  return actualOf(metric, summary);
}

// ─── Thẻ tiêu chí ────────────────────────────────────────────────────────────

export type CriterionNote =
  | { kind: "hint"; text: string }
  | { kind: "met"; excess: number }
  | { kind: "missed"; remaining: number }
  | { kind: "pace"; remaining: number; weekly: number }
  | { kind: "final"; remaining: number; daysLeft: number };

/**
 * Dòng cuối thẻ tiêu chí: kỳ chưa bắt đầu ⇒ giải thích tiêu chí; đã đạt ⇒ vượt bao nhiêu;
 * hết kỳ ⇒ thiếu bao nhiêu; còn > 7 ngày ⇒ nhịp cần mỗi tuần; tuần cuối ⇒ thiếu trong N ngày.
 */
export function criterionNote(c: CriterionProgress, timing: TargetTiming, daysLeft: number): CriterionNote {
  if (timing === "upcoming") return { kind: "hint", text: TARGET_METRIC_META[c.metric].hint };
  if (c.met) return { kind: "met", excess: Math.max(0, c.actual - c.goal) };
  if (timing === "past") return { kind: "missed", remaining: c.remaining };
  if (daysLeft > 7 && c.weeklyPace !== null) return { kind: "pace", remaining: c.remaining, weekly: c.weeklyPace };
  return { kind: "final", remaining: c.remaining, daysLeft };
}

// ─── Số liệu cấu thành ───────────────────────────────────────────────────────

/** Tài sản mỗi trang của bảng số liệu cấu thành. */
export const CONTRIBUTION_PAGE_SIZE = 5;

export type ContributionPayment = "paid" | "partial" | "pending" | "estimated" | "defaulted";

export const CONTRIBUTION_PAYMENT_LABEL: Record<ContributionPayment, string> = {
  paid: "Đã thu đủ",
  partial: "Thu một phần",
  pending: "Chưa thu",
  estimated: "Tạm tính theo giá trúng",
  defaulted: "Bỏ cọc",
};

/** Nguồn không theo dõi thu tiền (tổ chức tự khai / tin cào) ⇒ tạm tính theo giá trúng. */
export const contributionPayment = (input: TargetInput): ContributionPayment => input.paymentStatus ?? "estimated";

/** Cột "Kết quả" (tiêu chí đưa ra đấu giá). */
export function contributionOutcomeLabel(input: TargetInput): string {
  if (input.outcome !== "sold") return OUTCOME_KIND_LABEL[input.outcome];
  return input.paymentStatus === "defaulted" ? "Đấu thành · bỏ cọc" : "Đấu thành";
}

/** "Chi nhánh Quận 7" ⇒ "Quận 7" — cột chi nhánh của bảng đã có tiêu đề. */
export const shortBranchLabel = (label: string) => label.replace(/^chi nhánh\s+/i, "");

// Phần "Thực hiện kế hoạch đấu giá" của báo cáo định kỳ — payload v2
// (Phase 8 của docs/owner-auction-planning-plan.md).
//
// Thuần (không React / Supabase) để test được. MỌI số do SERVER tính ở
// owner_report_plan_execution, bên trong gọi auction_plan_period_metrics — đúng hàm
// mà tab "Theo kỳ" của kế hoạch đọc ⇒ cùng kế hoạch, cùng kỳ thì không thể lệch số.
// Module này chỉ thu hẹp kiểu JSON và đặt nhãn, KHÔNG tính lại chỉ số nào.
//
// Báo cáo chốt TRƯỚC Phase 8 có payload v1, không có khoá `plan_execution`:
// mapper trả `null` và phần này không hiện (xem ReportPlanExecutionSection).

import { PLAN_ITEM_HEALTH_LABELS, type PlanItemHealth } from "@/lib/auctionPlan/health";
import {
  AUCTION_PLAN_KIND_LABELS,
  AUCTION_PLAN_STATUS_LABELS,
  AUCTION_PLAN_STEP_LABELS,
  type AuctionPlanKind,
  type AuctionPlanStatus,
  type AuctionPlanStep,
} from "@/lib/auctionPlan/types";

// ─── Kiểu ────────────────────────────────────────────────────────────────────

/** Chỉ số kế hoạch so thực tế của một kỳ (bảng A5). */
export interface PlanExecutionMetrics {
  /** Số tài sản có tháng BẢN MỐC trong kỳ. */
  plannedCount: number;
  plannedStartValue: number;
  /** Số tài sản có BẤT KỲ kết quả trong kỳ. */
  offeredCount: number;
  soldCount: number;
  actualStartValue: number;
  winningTotal: number;
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  /** null khi kỳ không có tài sản theo kế hoạch ⇒ hiện "—", không hiện 0%. */
  donePct: number | null;
}

export interface PlanExecutionCounts {
  itemCount: number;
  lateCount: number;
  atRiskCount: number;
  failedRetryCount: number;
  /** Số tài sản có tháng dự kiến khác tháng bản mốc. */
  movedCount: number;
}

export interface PlanExecutionTotals extends PlanExecutionMetrics, PlanExecutionCounts {
  plans: number;
}

export interface PlanExecutionAttentionItem {
  itemCode: string | null;
  title: string | null;
  health: PlanItemHealth | null;
  baselineMonth: string | null;
  forecastMonth: string | null;
  stepsDone: number;
  stepsTotal: number;
  forecastReason: string | null;
  execNote: string | null;
  overdueStep: AuctionPlanStep | null;
  overdueStepDate: string | null;
  overdueStepNote: string | null;
}

export interface PlanExecutionMove {
  itemCode: string | null;
  title: string | null;
  health: PlanItemHealth | null;
  baselineMonth: string | null;
  forecastMonth: string | null;
  reason: string | null;
}

export interface PlanExecutionPlan extends PlanExecutionCounts {
  title: string | null;
  /** Tên đơn vị hành chính của kế hoạch ("Phường Vũ Ninh"). */
  unitName: string | null;
  branchName: string | null;
  adminUnitCode: string | null;
  kind: AuctionPlanKind | null;
  status: AuctionPlanStatus | null;
  planYear: number | null;
  baselineVersion: number | null;
  approvalDocNo: string | null;
  approvalDocDate: string | null;
  metrics: PlanExecutionMetrics;
  attention: PlanExecutionAttentionItem[];
  forecastMoves: PlanExecutionMove[];
}

export interface ReportPlanExecution {
  asOf: string | null;
  period: { type: string; start: string | null; end: string | null } | null;
  totals: PlanExecutionTotals;
  plans: PlanExecutionPlan[];
}

// ─── Thu hẹp kiểu ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const num0 = (v: unknown) => num(v) ?? 0;

function oneOf<T extends string>(allowed: readonly T[], v: unknown): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

const HEALTHS = Object.keys(PLAN_ITEM_HEALTH_LABELS) as PlanItemHealth[];
const STEPS = Object.keys(AUCTION_PLAN_STEP_LABELS) as AuctionPlanStep[];
const KINDS = Object.keys(AUCTION_PLAN_KIND_LABELS) as AuctionPlanKind[];
const STATUSES = Object.keys(AUCTION_PLAN_STATUS_LABELS) as AuctionPlanStatus[];

function mapMetrics(raw: unknown): PlanExecutionMetrics {
  const m = obj(raw);
  return {
    plannedCount: num0(m.planned_count),
    plannedStartValue: num0(m.planned_start_value),
    offeredCount: num0(m.offered_count),
    soldCount: num0(m.sold_count),
    actualStartValue: num0(m.actual_start_value),
    winningTotal: num0(m.winning_total),
    collected: num0(m.collected),
    recorded: num0(m.recorded),
    estimated: num0(m.estimated),
    awaiting: num0(m.awaiting),
    donePct: num(m.done_pct),
  };
}

function mapCounts(raw: Obj): PlanExecutionCounts {
  return {
    itemCount: num0(raw.item_count),
    lateCount: num0(raw.late_count),
    atRiskCount: num0(raw.at_risk_count),
    failedRetryCount: num0(raw.failed_retry_count),
    movedCount: num0(raw.moved_count),
  };
}

function mapAttention(raw: unknown): PlanExecutionAttentionItem {
  const i = obj(raw);
  return {
    itemCode: str(i.item_code),
    title: str(i.title),
    health: oneOf(HEALTHS, i.health),
    baselineMonth: str(i.baseline_month),
    forecastMonth: str(i.forecast_month),
    stepsDone: num0(i.steps_done),
    stepsTotal: num0(i.steps_total),
    forecastReason: str(i.forecast_reason),
    execNote: str(i.exec_note),
    overdueStep: oneOf(STEPS, i.overdue_step),
    overdueStepDate: str(i.overdue_step_date),
    overdueStepNote: str(i.overdue_step_note),
  };
}

function mapMove(raw: unknown): PlanExecutionMove {
  const i = obj(raw);
  return {
    itemCode: str(i.item_code),
    title: str(i.title),
    health: oneOf(HEALTHS, i.health),
    baselineMonth: str(i.baseline_month),
    forecastMonth: str(i.forecast_month),
    reason: str(i.reason),
  };
}

function mapPlan(raw: unknown): PlanExecutionPlan {
  const p = obj(raw);
  return {
    title: str(p.title),
    unitName: str(p.unit_name),
    branchName: str(p.branch_name),
    adminUnitCode: str(p.admin_unit_code),
    kind: oneOf(KINDS, p.kind),
    status: oneOf(STATUSES, p.status),
    planYear: num(p.plan_year),
    baselineVersion: num(p.baseline_version),
    approvalDocNo: str(p.approval_doc_no),
    approvalDocDate: str(p.approval_doc_date),
    ...mapCounts(p),
    metrics: mapMetrics(p.metrics),
    attention: arr(p.attention).map(mapAttention),
    forecastMoves: arr(p.forecast_moves).map(mapMove),
  };
}

/**
 * JSON `plan_execution` của payload v2 ⇒ dạng an toàn cho UI / Excel / bản in.
 * `null` = payload v1 (báo cáo chốt trước Phase 8) ⇒ KHÔNG hiện phần này, để báo cáo
 * đã chốt hiển thị y nguyên như lúc chốt.
 */
export function mapReportPlanExecution(raw: unknown): ReportPlanExecution | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Obj;
  const period = obj(p.period);
  const totals = obj(p.totals);
  return {
    asOf: str(p.as_of),
    period: str(period.type)
      ? { type: str(period.type)!, start: str(period.start), end: str(period.end) }
      : null,
    totals: { plans: num0(totals.plans), ...mapMetrics(totals), ...mapCounts(totals) },
    plans: arr(p.plans).map(mapPlan),
  };
}

// ─── Nhãn ────────────────────────────────────────────────────────────────────

/** Tên hiển thị của một kế hoạch trong báo cáo: đơn vị hành chính trước, rồi tiêu đề. */
export function planExecutionUnitLabel(plan: PlanExecutionPlan): string {
  return plan.unitName ?? plan.branchName ?? plan.title ?? "Kế hoạch chưa đặt tên";
}

/** "2026-08-01" ⇒ "8/2026". Tháng bản mốc / tháng dự kiến luôn là ngày 01. */
export function planMonthLabel(iso: string | null): string {
  if (!iso) return "—";
  const [y, m] = iso.split("-");
  if (!y || !m) return iso;
  return `${Number(m)}/${y}`;
}

/**
 * Một câu LÝ DO cho tài sản trễ / nguy cơ trễ, theo thứ tự: vì sao dời tháng → mốc
 * đang quá hạn → ghi chú thực hiện. Không có gì ⇒ nói rõ là chưa khai lý do.
 */
export function planAttentionReason(item: PlanExecutionAttentionItem): string {
  const parts: string[] = [];
  if (item.forecastReason) parts.push(item.forecastReason);
  if (item.overdueStep) {
    const label = AUCTION_PLAN_STEP_LABELS[item.overdueStep];
    parts.push(
      item.overdueStepDate
        ? `Quá hạn mốc "${label}" (hạn ${planDayLabel(item.overdueStepDate)})`
        : `Quá hạn mốc "${label}"`,
    );
  }
  if (item.overdueStepNote) parts.push(item.overdueStepNote);
  if (item.execNote) parts.push(item.execNote);
  if (!parts.length) return "Chưa khai lý do";
  return parts.join(" · ");
}

/** "2026-05-09" ⇒ "09/05/2026". */
export function planDayLabel(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Câu L1 của phần: "Đã đấu thành 4/19 tài sản theo kế hoạch · 4 tài sản trễ". */
export function planExecutionHeadline(pe: ReportPlanExecution): string {
  const t = pe.totals;
  const head = `Đã đấu thành ${t.soldCount}/${t.plannedCount} tài sản theo kế hoạch`;
  const tail: string[] = [];
  if (t.lateCount) tail.push(`${t.lateCount} tài sản trễ`);
  if (t.atRiskCount) tail.push(`${t.atRiskCount} nguy cơ trễ`);
  if (t.movedCount) tail.push(`${t.movedCount} đã dời tháng dự kiến`);
  return tail.length ? `${head} · ${tail.join(" · ")}` : head;
}

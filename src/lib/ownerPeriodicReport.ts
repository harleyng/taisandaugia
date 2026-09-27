// Báo cáo định kỳ của Trạm Điều Hành (docs/owner-control-tower-plan.md Phase 10, §A5).
//
// Thuần (không React/Supabase) để test được. Payload do SERVER dựng
// (RPC owner_build_report_payload — bản nháp tính lại mỗi lần mở; owner_finalize_report
// đóng băng lúc chốt). Module này chỉ thu hẹp kiểu JSON về dạng an toàn cho UI /
// Excel / trang in, không tính lại số nào.

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  OUTCOME_CONFIDENCES,
  OUTCOME_PAYMENT_STATUSES,
  RESOLVED_OUTCOME_KINDS,
  type OutcomeConfidence,
  type OutcomePaymentStatus,
  type ResolvedOutcomeKind,
} from "@/lib/ownerOutcomes";
import {
  SCOPE_ALL,
  TARGET_PERIOD_TYPES,
  periodEndOf,
  periodLabel,
  periodStartOf,
  shiftPeriod,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import { ownerCanIn, type OwnerWsAccessCtx } from "@/lib/ownerWorkspace/roles";

// ─── Bản ghi báo cáo ─────────────────────────────────────────────────────────

export type OwnerReportRow = Database["public"]["Tables"]["owner_report_snapshots"]["Row"];

export const REPORT_STATUSES = ["draft", "final"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Chờ chốt",
  final: "Đã chốt",
};

/** Độ dài tối đa của mỗi ô ghi chú — khớp CHECK của bảng. */
export const REPORT_NOTE_MAX = 4000;

/**
 * Trạng thái link chia sẻ /r/:token (Phase 11). KHÔNG có token: cột share_token bị rút
 * quyền SELECT — chỉ Trưởng đơn vị đọc được qua RPC owner_report_share_link.
 */
export interface ReportShareInfo {
  /** null = chưa chia sẻ / đã thu hồi. Quá hạn ⇒ link hết hiệu lực nhưng vẫn còn đây. */
  expiresAt: string | null;
  /** Lượt mở của người ngoài đơn vị, cộng dồn qua các lần tạo link. */
  viewCount: number;
  lastViewedAt: string | null;
  sharedAt: string | null;
  sharedBy: string | null;
}

export interface OwnerReport {
  id: string;
  workspaceId: string;
  /** null = cả đơn vị. */
  branchId: string | null;
  periodType: TargetPeriodType;
  periodStart: string;
  status: ReportStatus;
  notes: string | null;
  planNote: string | null;
  /** JSON thô — chỉ có ở báo cáo đã chốt (và chỉ khi truy vấn có chọn cột này). */
  payload: unknown;
  finalizedAt: string | null;
  finalizedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  share: ReportShareInfo;
}

/** Không bao giờ có share_token (không đọc được qua bảng) — xem ReportShareInfo. */
type ReportRowInput = Omit<OwnerReportRow, "payload" | "share_token"> & { payload?: unknown };

export function mapReportRow(row: ReportRowInput): OwnerReport | null {
  const periodType = oneOf(TARGET_PERIOD_TYPES, row.period_type);
  const status = oneOf(REPORT_STATUSES, row.status);
  if (!periodType || !status) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    branchId: row.branch_id,
    periodType,
    periodStart: row.period_start,
    status,
    notes: row.notes,
    planNote: row.plan_note,
    payload: row.payload ?? null,
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    share: {
      expiresAt: row.token_expires_at,
      viewCount: row.view_count ?? 0,
      lastViewedAt: row.last_viewed_at,
      sharedAt: row.shared_at,
      sharedBy: row.shared_by,
    },
  };
}

// ─── Đường dẫn ───────────────────────────────────────────────────────────────

export const REPORTS_HREF = "/chu-tai-san/bao-cao-dinh-ky";
export const reportHref = (id: string) => `${REPORTS_HREF}/${id}`;
/** Trang in A4 (ngoài layout cổng); `?auto=1` tự mở hộp thoại in. */
export const reportPrintHref = (id: string) => `${REPORTS_HREF}/${id}/in`;

// ─── Kỳ ──────────────────────────────────────────────────────────────────────

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Báo cáo tháng 9/2026" · "Báo cáo quý III/2026" · "Báo cáo năm 2026". */
export function reportTitle(type: TargetPeriodType, start: string): string {
  return `Báo cáo ${periodLabel(type, start)}`;
}

/** Báo cáo nhìn LẠI: kỳ hiện tại + các kỳ trước (12 tháng / 6 quý / 3 năm). */
const LOOK_BACK: Record<TargetPeriodType, number> = { month: 12, quarter: 6, year: 3 };

export function reportPeriodOptions(type: TargetPeriodType, today: string): { start: string; label: string }[] {
  const current = periodStartOf(type, today);
  return Array.from({ length: LOOK_BACK[type] }, (_, i) => {
    const start = shiftPeriod(type, current, -i);
    return { start, label: capitalize(periodLabel(type, start)) };
  });
}

/** Kỳ vừa kết thúc — kỳ mặc định khi lập báo cáo. */
export function previousPeriodStart(type: TargetPeriodType, today: string): string {
  return shiftPeriod(type, periodStartOf(type, today), -1);
}

export function isPeriodOver(type: TargetPeriodType, start: string, today: string): boolean {
  return today > periodEndOf(type, start);
}

// ─── Payload (version 1) ─────────────────────────────────────────────────────

export type ReportScopeKind = "unit" | "branch";

export interface ReportPeriod {
  type: TargetPeriodType;
  start: string;
  end: string;
}

export interface ReportMeta {
  generatedAt: string | null;
  /** Ngày tính các mục theo trạng thái (tồn đọng, chờ thu kỳ trước, lịch sắp tới). */
  asOf: string | null;
  period: ReportPeriod;
  unitName: string | null;
  scope: { kind: ReportScopeKind; branchName: string | null };
}

export interface ReportTarget {
  scope: ReportScopeKind;
  branchName: string | null;
  targetAmount: number | null;
  targetCount: number | null;
  /** Đã thu = recorded + estimated. */
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  soldCount: number;
  amountPct: number | null;
  countPct: number | null;
  amountRemaining: number | null;
  countRemaining: number | null;
}

export interface ReportResultItem {
  assetCode: string | null;
  title: string;
  category: string | null;
  branchName: string | null;
  orgName: string | null;
  date: string | null;
  roundNo: number | null;
  outcome: ResolvedOutcomeKind | null;
  startingPrice: number | null;
  price: number | null;
  confidence: OutcomeConfidence | null;
  hasConflict: boolean;
  paymentStatus: OutcomePaymentStatus | null;
}

export interface ReportResultTotals {
  total: number;
  sold: number;
  unsold: number;
  voided: number;
  conflicts: number;
  soldValue: number;
  soldWithoutPrice: number;
  defaulted: number;
  successRate: number | null;
}

export interface ReportResultLabel {
  label: OutcomeConfidence;
  count: number;
  sold: number;
  soldValue: number;
}

export interface ReportResults {
  totals: ReportResultTotals;
  byLabel: ReportResultLabel[];
  items: ReportResultItem[];
}

export interface ReportMoneyLabel {
  label: OutcomeConfidence;
  count: number;
  collected: number;
  awaiting: number;
}

export interface ReportMoneyItem {
  assetCode: string | null;
  title: string;
  branchName: string | null;
  date: string | null;
  price: number | null;
  paidAmount: number | null;
  awaiting: number;
  paymentStatus: OutcomePaymentStatus | null;
  confidence: OutcomeConfidence | null;
}

export interface ReportMoney {
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  soldCount: number;
  defaulted: { count: number; value: number };
  byLabel: ReportMoneyLabel[];
  items: ReportMoneyItem[];
  /** Tài sản bán ở kỳ TRƯỚC, tới ngày lập vẫn chưa thu đủ. */
  carryOver: { count: number; awaiting: number };
}

export interface ReportStuckItem {
  assetCode: string | null;
  title: string;
  branchName: string | null;
  rounds: number;
  ageDays: number | null;
  firstDate: string | null;
  lastOutcome: ResolvedOutcomeKind | null;
  lastDate: string | null;
  confidence: OutcomeConfidence | null;
  startingPrice: number | null;
  nextDate: string | null;
}

export interface ReportStuck {
  rule: { minRounds: number; maxDays: number };
  count: number;
  items: ReportStuckItem[];
}

export interface ReportScheduledItem {
  assetCode: string | null;
  title: string;
  branchName: string | null;
  date: string | null;
  /** "platform" = phiên trên sàn; "listing" = ngày phiên ghi trên tin. */
  source: "platform" | "listing";
  orgName: string | null;
  startingPrice: number | null;
  isStuck: boolean;
}

export interface ReportNextTarget {
  scope: ReportScopeKind;
  branchName: string | null;
  targetAmount: number | null;
  targetCount: number | null;
}

export interface ReportPlan {
  nextPeriod: ReportPeriod | null;
  nextTargets: ReportNextTarget[];
  scheduled: ReportScheduledItem[];
  stuckUnscheduled: number;
}

export interface ReportNotes {
  /** "Ghi chú của cán bộ". */
  officer: string | null;
  /** "Kế hoạch kỳ tới". */
  plan: string | null;
}

export interface ReportPeople {
  preparedBy: string | null;
  finalizedBy: string | null;
}

export interface ReportPayload {
  version: number;
  meta: ReportMeta;
  targets: ReportTarget[];
  results: ReportResults;
  money: ReportMoney;
  stuck: ReportStuck;
  plan: ReportPlan;
  /** Bản nháp: ghép từ cột của bản ghi. Đã chốt: đóng băng trong payload. */
  notes: ReportNotes;
  people: ReportPeople;
  finalizedAt: string | null;
}

// ─── Thu hẹp kiểu ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const num0 = (v: unknown) => num(v) ?? 0;

function oneOf<T extends string>(allowed: readonly T[], v: unknown): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

const scopeKind = (v: unknown): ReportScopeKind => (v === "branch" ? "branch" : "unit");

function mapPeriod(v: unknown): ReportPeriod | null {
  const p = obj(v);
  const type = oneOf(TARGET_PERIOD_TYPES, p.type);
  const start = str(p.start);
  const end = str(p.end);
  return type && start && end ? { type, start, end } : null;
}

const confidence = (v: unknown) => oneOf(OUTCOME_CONFIDENCES, v);
const outcomeKind = (v: unknown) => oneOf(RESOLVED_OUTCOME_KINDS, v);
const paymentStatus = (v: unknown) => oneOf(OUTCOME_PAYMENT_STATUSES, v);
const title = (v: unknown) => str(v) ?? "Tài sản chưa đặt tên";

function mapTarget(v: unknown): ReportTarget {
  const t = obj(v);
  return {
    scope: scopeKind(t.scope),
    branchName: str(t.branch_name),
    targetAmount: num(t.target_amount),
    targetCount: num(t.target_count),
    collected: num0(t.collected),
    recorded: num0(t.recorded),
    estimated: num0(t.estimated),
    awaiting: num0(t.awaiting),
    soldCount: num0(t.sold_count),
    amountPct: num(t.amount_pct),
    countPct: num(t.count_pct),
    amountRemaining: num(t.amount_remaining),
    countRemaining: num(t.count_remaining),
  };
}

function mapResults(v: unknown): ReportResults {
  const r = obj(v);
  const t = obj(r.totals);
  return {
    totals: {
      total: num0(t.total),
      sold: num0(t.sold),
      unsold: num0(t.unsold),
      voided: num0(t.voided),
      conflicts: num0(t.conflicts),
      soldValue: num0(t.sold_value),
      soldWithoutPrice: num0(t.sold_without_price),
      defaulted: num0(t.defaulted),
      successRate: num(t.success_rate),
    },
    byLabel: arr(r.by_label).flatMap((raw) => {
      const g = obj(raw);
      const label = confidence(g.label);
      return label ? [{ label, count: num0(g.count), sold: num0(g.sold), soldValue: num0(g.sold_value) }] : [];
    }),
    items: arr(r.items).map((raw) => {
      const i = obj(raw);
      return {
        assetCode: str(i.asset_code),
        title: title(i.title),
        category: str(i.category),
        branchName: str(i.branch_name),
        orgName: str(i.org_name),
        date: str(i.date),
        roundNo: num(i.round_no),
        outcome: outcomeKind(i.outcome),
        startingPrice: num(i.starting_price),
        price: num(i.price),
        confidence: confidence(i.confidence_label),
        hasConflict: i.has_conflict === true,
        paymentStatus: paymentStatus(i.payment_status),
      };
    }),
  };
}

function mapMoney(v: unknown): ReportMoney {
  const m = obj(v);
  const d = obj(m.defaulted);
  const c = obj(m.carry_over);
  return {
    collected: num0(m.collected),
    recorded: num0(m.recorded),
    estimated: num0(m.estimated),
    awaiting: num0(m.awaiting),
    soldCount: num0(m.sold_count),
    defaulted: { count: num0(d.count), value: num0(d.value) },
    byLabel: arr(m.by_label).flatMap((raw) => {
      const g = obj(raw);
      const label = confidence(g.label);
      return label
        ? [{ label, count: num0(g.count), collected: num0(g.collected), awaiting: num0(g.awaiting) }]
        : [];
    }),
    items: arr(m.items).map((raw) => {
      const i = obj(raw);
      return {
        assetCode: str(i.asset_code),
        title: title(i.title),
        branchName: str(i.branch_name),
        date: str(i.date),
        price: num(i.price),
        paidAmount: num(i.paid_amount),
        awaiting: num0(i.awaiting),
        paymentStatus: paymentStatus(i.payment_status),
        confidence: confidence(i.confidence_label),
      };
    }),
    carryOver: { count: num0(c.count), awaiting: num0(c.awaiting) },
  };
}

function mapStuck(v: unknown): ReportStuck {
  const s = obj(v);
  const rule = obj(s.rule);
  return {
    rule: { minRounds: num(rule.min_rounds) ?? 3, maxDays: num(rule.max_days) ?? 90 },
    count: num0(s.count),
    items: arr(s.items).map((raw) => {
      const i = obj(raw);
      return {
        assetCode: str(i.asset_code),
        title: title(i.title),
        branchName: str(i.branch_name),
        rounds: num0(i.rounds),
        ageDays: num(i.age_days),
        firstDate: str(i.first_date),
        lastOutcome: outcomeKind(i.last_outcome),
        lastDate: str(i.last_date),
        confidence: confidence(i.confidence_label),
        startingPrice: num(i.starting_price),
        nextDate: str(i.next_date),
      };
    }),
  };
}

function mapPlan(v: unknown): ReportPlan {
  const p = obj(v);
  return {
    nextPeriod: mapPeriod(p.next_period),
    nextTargets: arr(p.next_targets).map((raw) => {
      const t = obj(raw);
      return {
        scope: scopeKind(t.scope),
        branchName: str(t.branch_name),
        targetAmount: num(t.target_amount),
        targetCount: num(t.target_count),
      };
    }),
    scheduled: arr(p.scheduled).map((raw) => {
      const i = obj(raw);
      return {
        assetCode: str(i.asset_code),
        title: title(i.title),
        branchName: str(i.branch_name),
        date: str(i.date),
        source: i.source === "platform" ? "platform" : "listing",
        orgName: str(i.org_name),
        startingPrice: num(i.starting_price),
        isStuck: i.is_stuck === true,
      };
    }),
    stuckUnscheduled: num0(p.stuck_unscheduled),
  };
}

/** JSON của RPC / cột payload ⇒ payload an toàn cho UI; null khi không đọc được kỳ. */
export function mapReportPayload(raw: unknown): ReportPayload | null {
  const p = obj(raw);
  const meta = obj(p.meta);
  const period = mapPeriod(meta.period);
  if (!period) return null;
  const scope = obj(meta.scope);
  const notes = obj(p.notes);
  const people = obj(p.people);
  return {
    version: num(p.version) ?? 1,
    meta: {
      generatedAt: str(meta.generated_at),
      asOf: str(meta.as_of),
      period,
      unitName: str(meta.unit_name),
      scope: { kind: scopeKind(scope.kind), branchName: str(scope.branch_name) },
    },
    targets: arr(p.targets).map(mapTarget),
    results: mapResults(p.results),
    money: mapMoney(p.money),
    stuck: mapStuck(p.stuck),
    plan: mapPlan(p.plan),
    notes: { officer: str(notes.officer), plan: str(notes.plan) },
    people: { preparedBy: str(people.prepared_by), finalizedBy: str(people.finalized_by) },
    finalizedAt: str(p.finalized_at),
  };
}

/** Chỉ tiêu tiền của ĐÚNG phạm vi báo cáo: cả đơn vị ⇒ dòng "unit", chi nhánh ⇒ dòng của chi nhánh. */
export function primaryReportTarget(targets: readonly ReportTarget[], scope: ReportScopeKind): ReportTarget | null {
  return targets.find((t) => t.scope === scope && t.targetAmount !== null) ?? null;
}

/** Dòng danh sách: bản ghi (không kèm payload) + vài trường đóng băng của báo cáo đã chốt. */
export interface OwnerReportListItem extends OwnerReport {
  /** Phạm vi lúc chốt — vẫn đúng khi chi nhánh bị xoá sau đó. */
  frozenScope: ReportMeta["scope"] | null;
  frozenPreparedBy: string | null;
  /** "Đã thu" và số tài sản đấu thành của kỳ, lúc chốt. */
  collected: number | null;
  soldCount: number | null;
  /** Tổng giá trúng của kỳ, lúc chốt. */
  soldValue: number | null;
  /** % chỉ tiêu tiền của đúng phạm vi báo cáo; null khi không đặt chỉ tiêu. */
  targetPct: number | null;
}

type ReportListRowInput = ReportRowInput & {
  scope?: unknown;
  people?: unknown;
  collected?: unknown;
  sold_count?: unknown;
  sold_value?: unknown;
  targets?: unknown;
};

export function mapReportListRow(row: ReportListRowInput): OwnerReportListItem | null {
  const base = mapReportRow(row);
  if (!base) return null;
  const final = base.status === "final";
  const scope = obj(row.scope);
  return {
    ...base,
    frozenScope: final && row.scope ? { kind: scopeKind(scope.kind), branchName: str(scope.branch_name) } : null,
    frozenPreparedBy: final ? str(obj(row.people).prepared_by) : null,
    collected: final ? num(row.collected) : null,
    soldCount: final ? num(row.sold_count) : null,
    soldValue: final ? num(row.sold_value) : null,
    targetPct: final ? primaryReportTarget(arr(row.targets).map(mapTarget), scopeKind(scope.kind))?.amountPct ?? null : null,
  };
}

/** Bản nháp: số liệu tính trực tiếp + ghi chú đang lưu ở cột của bản ghi. */
export function withDraftNotes(payload: ReportPayload, report: Pick<OwnerReport, "notes" | "planNote">): ReportPayload {
  return {
    ...payload,
    notes: { officer: str(report.notes), plan: str(report.planNote) },
  };
}

// ─── Nhãn ────────────────────────────────────────────────────────────────────

export function reportScopeLabel(scope: ReportMeta["scope"]): string {
  return scope.kind === "branch" ? scope.branchName ?? "Chi nhánh" : "Toàn đơn vị";
}

export const REPORT_PAYMENT_LABEL: Record<OutcomePaymentStatus, string> = {
  pending: "Chờ thu",
  partial: "Thu một phần",
  paid: "Đã thu đủ",
  defaulted: "Người trúng bỏ cọc",
};

/** "3F9A12BC" → "Mã 3F9A12BC"; không mã (tài sản ngoài sàn) → "Ngoài sàn". */
export const assetCodeLabel = (code: string | null) => (code ? `Mã ${code}` : "Ngoài sàn");

/** "2026-09-13" → "13/09/2026"; trống → "—". */
export const formatReportDay = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

/** Tên file tải về: "bao-cao-thang-9-2026.xlsx" / "bao-cao-quy-iii-2026-chi-nhanh-ha-noi.xlsx". */
export function reportFileName(payload: ReportPayload, ext: string): string {
  const parts = [reportTitle(payload.meta.period.type, payload.meta.period.start)];
  if (payload.meta.scope.kind === "branch" && payload.meta.scope.branchName) parts.push(payload.meta.scope.branchName);
  const slug = parts
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "bao-cao"}.${ext}`;
}

// ─── Quyền (bản sao RLS — chỉ để ẩn nút) ─────────────────────────────────────

type ReportAccess = OwnerWsAccessCtx | null | undefined;

/**
 * Lập / sửa / xoá nháp: bao-cao-dinh-ky:create|update|delete + phạm vi chi nhánh của
 * báo cáo (owner_ws_has_in; cả đơn vị = branchId null ⇒ chỉ người không bị giới hạn).
 */
export function canDraftReport(
  access: ReportAccess,
  branchId: string | null,
  action: "create" | "update" | "delete" = "update",
): boolean {
  return ownerCanIn(access, "bao-cao-dinh-ky", action, branchId);
}

/** Chốt báo cáo: bao-cao-dinh-ky:finalize + phạm vi chi nhánh (owner_finalize_report). */
export const canFinalizeReport = (access: ReportAccess, branchId: string | null) =>
  ownerCanIn(access, "bao-cao-dinh-ky", "finalize", branchId);

/** Tạo / thu hồi link chia sẻ: bao-cao-dinh-ky:share + phạm vi chi nhánh (owner_share_report). */
export const canShareReport = (access: ReportAccess, branchId: string | null) =>
  ownerCanIn(access, "bao-cao-dinh-ky", "share", branchId);

// ─── Form ────────────────────────────────────────────────────────────────────

export { SCOPE_ALL };

export const createReportSchema = z.object({
  periodType: z.enum(TARGET_PERIOD_TYPES),
  periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, "Chọn kỳ"),
  scope: z.string().min(1, "Chọn phạm vi"),
});

export type CreateReportForm = z.infer<typeof createReportSchema>;

type ReportInsert = Database["public"]["Tables"]["owner_report_snapshots"]["Insert"];

export function toReportInsert(form: CreateReportForm, workspaceId: string): ReportInsert {
  return {
    workspace_id: workspaceId,
    branch_id: form.scope === SCOPE_ALL ? null : form.scope,
    period_type: form.periodType,
    period_start: form.periodStart,
  };
}

const note = z.string().max(REPORT_NOTE_MAX, `Tối đa ${REPORT_NOTE_MAX.toLocaleString("en-US")} ký tự`);

export const reportNotesSchema = z.object({ planNote: note, notes: note });

export type ReportNotesForm = z.infer<typeof reportNotesSchema>;

/** Chuỗi rỗng / chỉ khoảng trắng ⇒ null. */
export const noteOrNull = (v: string) => (v.trim() ? v.trim() : null);

// ─── Lỗi ─────────────────────────────────────────────────────────────────────

export const OWNER_REPORT_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_found: "Không tìm thấy báo cáo — có thể bản nháp vừa bị xoá. Tải lại trang để xem mới nhất.",
  forbidden: "Chỉ Trưởng đơn vị mới được chốt hoặc chia sẻ báo cáo.",
  already_final: "Báo cáo này đã được chốt trước đó.",
  not_final: "Chỉ chia sẻ được báo cáo đã chốt.",
  invalid_days: "Thời hạn link không hợp lệ (tối đa 90 ngày).",
};

export class OwnerReportRpcError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(OWNER_REPORT_REASON_MESSAGES[reason] ?? "Thao tác không thành công. Vui lòng thử lại.");
    this.name = "OwnerReportRpcError";
    this.reason = reason;
  }
}

/** RPC trả `{ ok:false, reason }` cho thất bại dự kiến — Supabase coi là thành công ⇒ phải tự ném. */
export function assertOwnerReportRpcOk(data: unknown): void {
  const d = obj(data);
  if (d.ok === false) throw new OwnerReportRpcError(typeof d.reason === "string" ? d.reason : "unknown");
}

export function reportErrorMessage(err: unknown, fallback = "Không lưu được báo cáo. Vui lòng thử lại."): string {
  if (err instanceof OwnerReportRpcError) return err.message;
  const e = obj(err) as { code?: unknown; message?: unknown };
  if (e.code === "42501") return "Bạn không có quyền thao tác với báo cáo này.";
  if (e.code === "22023") return "Kỳ hoặc chi nhánh không hợp lệ.";
  if (e.code === "23514") return "Kỳ hoặc ghi chú không hợp lệ.";
  if (e.code === "P0001" && typeof e.message === "string" && e.message) return e.message;
  return fallback;
}

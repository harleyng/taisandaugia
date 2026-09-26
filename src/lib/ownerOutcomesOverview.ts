// "Kết quả phiên" (docs/owner-control-tower-plan.md Phase 8): đọc RPC
// `owner_outcomes_overview` — mỗi tài sản CÓ KẾT QUẢ một dòng, trên sàn lẫn ngoài
// sàn. Gộp nguồn / xếp hạng / lệch số liệu đã xong ở server; module này chỉ thu
// hẹp kiểu, lọc và cộng tổng (thuần, không React).

import type { Database } from "@/integrations/supabase/types";
import {
  OUTCOME_CONFIDENCES,
  OUTCOME_PAYMENT_STATUSES,
  OUTCOME_SOURCE_KINDS,
  RESOLVED_OUTCOME_KINDS,
  mapOutcomeSource,
  type OutcomeConfidence,
  type OutcomePaymentStatus,
  type OutcomeSourceEntry,
  type OutcomeSourceKind,
  type ResolvedOutcomeKind,
} from "@/lib/ownerOutcomes";
import { inPeriod, periodRange } from "@/lib/ownerPeriods";
import { shortAssetId } from "@/lib/ownerAssetId";
import { normalizeVi } from "@/lib/normalizeVi";

export type OverviewRowRaw = Database["public"]["Functions"]["owner_outcomes_overview"]["Returns"][number];

/** Nguồn kèm cờ server tính cho việc xử lý lệch (Phase 8). */
export interface OverviewSource extends OutcomeSourceEntry {
  /** Dấu vân tay — gửi lại khi "Dùng số của tổ chức". */
  fp: string | null;
  /** Đơn vị đã chọn bỏ qua nguồn này. */
  dismissed: boolean;
  /** Cùng lượt với lượt hiện tại của tài sản. */
  inRound: boolean;
  /** Lệch với nguồn thắng (kết quả khác, hoặc giá lệch > 1%). */
  disagrees: boolean;
}

export interface OutcomeOverviewRow {
  rowKey: string;
  listingId: string | null;
  /** Định danh tài sản ngoài sàn (tên chuẩn hoá); null với tài sản trên sàn. */
  titleKey: string | null;
  /** Bản ghi tự khai mới nhất của đơn vị (nếu có). */
  ownOutcomeId: string | null;
  ownRoundNo: number | null;
  roundsReported: number;
  title: string;
  category: string | null;
  branchId: string | null;
  orgName: string | null;
  startingPrice: number | null;
  outcome: ResolvedOutcomeKind | null;
  price: number | null;
  date: string | null;
  paymentStatus: OutcomePaymentStatus | null;
  paidAmount: number | null;
  bestKind: OutcomeSourceKind | null;
  confidence: OutcomeConfidence | null;
  hasConflict: boolean;
  sources: OverviewSource[];
}

function oneOf<T extends string>(allowed: readonly T[], v: unknown): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapOverviewSource(raw: unknown): OverviewSource {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...mapOutcomeSource(raw),
    fp: typeof r.fp === "string" && r.fp ? r.fp : null,
    dismissed: r.dismissed === true,
    inRound: r.in_round === true,
    disagrees: r.disagrees === true,
  };
}

export function mapOverviewRow(row: OverviewRowRaw): OutcomeOverviewRow {
  return {
    rowKey: row.row_key,
    listingId: row.listing_id ?? null,
    titleKey: row.title_key ?? null,
    ownOutcomeId: row.own_outcome_id ?? null,
    ownRoundNo: num(row.own_round_no),
    roundsReported: num(row.rounds_reported) ?? 0,
    title: row.asset_title || "Tài sản chưa đặt tên",
    category: row.asset_category ?? null,
    branchId: row.branch_id ?? null,
    orgName: row.auction_org_name ?? null,
    startingPrice: num(row.starting_price),
    outcome: oneOf(RESOLVED_OUTCOME_KINDS, row.resolved_outcome),
    price: num(row.resolved_price),
    date: row.resolved_date ?? null,
    paymentStatus: oneOf(OUTCOME_PAYMENT_STATUSES, row.payment_status),
    paidAmount: num(row.paid_amount),
    bestKind: oneOf(OUTCOME_SOURCE_KINDS, row.best_kind),
    confidence: oneOf(OUTCOME_CONFIDENCES, row.confidence_label),
    hasConflict: row.has_conflict === true,
    sources: Array.isArray(row.sources) ? row.sources.map(mapOverviewSource) : [],
  };
}

export const isOffPlatform = (row: Pick<OutcomeOverviewRow, "listingId">) => row.listingId === null;

// ─── Lọc ─────────────────────────────────────────────────────────────────────

/** "void" = Hoãn / Huỷ / Rút khỏi phiên (phiên không diễn ra). */
export const OUTCOME_FILTERS = ["all", "sold", "unsold", "void"] as const;
export type OutcomeFilter = (typeof OUTCOME_FILTERS)[number];

export const OUTCOME_FILTER_LABEL: Record<OutcomeFilter, string> = {
  all: "Mọi kết quả",
  sold: "Thành",
  unsold: "Không thành",
  void: "Hoãn / Huỷ",
};

/** Chi nhánh: "all" | "none" (chưa gắn chi nhánh) | id chi nhánh. */
export const BRANCH_ALL = "all";
export const BRANCH_NONE = "none";

export interface OverviewFilters {
  period: string;
  branch: string;
  outcome: OutcomeFilter;
  /** "all" | một nhãn nguồn §A3. */
  source: string;
  conflictOnly: boolean;
  q: string;
}

function outcomeGroup(kind: ResolvedOutcomeKind | null): OutcomeFilter | null {
  if (kind === "sold") return "sold";
  if (kind === "unsold") return "unsold";
  if (kind) return "void";
  return null;
}

function matchesQuery(row: OutcomeOverviewRow, q: string): boolean {
  const needle = q.trim();
  if (!needle) return true;
  if (normalizeVi(row.title).includes(normalizeVi(needle))) return true;
  if (!row.listingId) return false;
  const code = needle.replace(/^m[aã]\s*/i, "").replace(/[#\s]/g, "").toUpperCase();
  return code.length >= 4 && shortAssetId(row.listingId).startsWith(code);
}

export function filterOverview(
  rows: OutcomeOverviewRow[],
  f: OverviewFilters,
  today: string,
): OutcomeOverviewRow[] {
  const range = periodRange(f.period, today);
  return rows.filter((r) => {
    if (!inPeriod(r.date, range)) return false;
    if (f.branch === BRANCH_NONE ? r.branchId !== null : f.branch !== BRANCH_ALL && r.branchId !== f.branch) return false;
    if (f.outcome !== "all" && outcomeGroup(r.outcome) !== f.outcome) return false;
    if (f.source !== "all" && r.confidence !== f.source) return false;
    if (f.conflictOnly && !r.hasConflict) return false;
    return matchesQuery(r, f.q);
  });
}

/** Mới nhất lên đầu; ngày trống xuống cuối. */
export function sortOverview(rows: OutcomeOverviewRow[]): OutcomeOverviewRow[] {
  return [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title, "vi"));
}

// ─── Tổng ────────────────────────────────────────────────────────────────────

export interface OutcomeTotals {
  /** Tài sản có kết quả trong phạm vi lọc. */
  total: number;
  sold: number;
  unsold: number;
  voided: number;
  conflicts: number;
  /** Tổng giá trúng của tài sản đã bán (bỏ qua dòng "đã bán" chưa rõ giá). */
  soldValue: number;
  soldWithoutPrice: number;
  /** Đã bán nhưng người trúng bỏ cọc (payment_status "defaulted") — Chỉ tiêu (Phase 9) KHÔNG tính các dòng này. */
  defaulted: number;
  /** % tài sản đã bán trên tổng tài sản có kết quả; null khi chưa có dòng nào. */
  successRate: number | null;
}

export function summarizeOutcomes(
  rows: Pick<OutcomeOverviewRow, "outcome" | "price" | "paymentStatus" | "hasConflict">[],
): OutcomeTotals {
  const t: OutcomeTotals = {
    total: rows.length,
    sold: 0,
    unsold: 0,
    voided: 0,
    conflicts: 0,
    soldValue: 0,
    soldWithoutPrice: 0,
    defaulted: 0,
    successRate: null,
  };
  for (const r of rows) {
    const g = outcomeGroup(r.outcome);
    if (g === "sold") {
      t.sold += 1;
      if (r.price !== null) t.soldValue += r.price;
      else t.soldWithoutPrice += 1;
      if (r.paymentStatus === "defaulted") t.defaulted += 1;
    } else if (g === "unsold") t.unsold += 1;
    else if (g === "void") t.voided += 1;
    if (r.hasConflict) t.conflicts += 1;
  }
  t.successRate = t.total ? Math.round((t.sold / t.total) * 100) : null;
  return t;
}

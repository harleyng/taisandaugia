// Giá trúng hợp nhất của Trạm Điều Hành (docs/owner-control-tower-plan.md §A3).
//
// Client chỉ ĐỌC kết quả của RPC `owner_asset_outcomes_resolved`
// (migration 20260926134757). Việc gộp nguồn, xếp hạng, và phát hiện lệch số
// liệu nằm ở server — đừng tái hiện ở đây. Module này chỉ thu hẹp kiểu và giữ
// nhãn tiếng Việt, nên phải thuần (không import lucide/React).

import type { Database } from "@/integrations/supabase/types";
import type { SaleContractStatus } from "@/types/auction-sale-contract";

/** Đủ 5 nhãn của §A3 ngay từ bây giờ: union hẹp hơn server = nhãn trống mà typecheck vẫn xanh. */
export const OUTCOME_CONFIDENCES = [
  "platform",
  "reconciled",
  "owner_evidence",
  "self_reported",
  "estimated",
] as const;
export type OutcomeConfidence = (typeof OUTCOME_CONFIDENCES)[number];

export const RESOLVED_OUTCOME_KINDS = ["sold", "unsold", "postponed", "cancelled", "withdrawn"] as const;
export type ResolvedOutcomeKind = (typeof RESOLVED_OUTCOME_KINDS)[number];

/** `owner_report` = đơn vị tự khai (bảng owner_asset_outcomes, Phase 6) — chỉ lượt mới nhất của tin. */
export const OUTCOME_SOURCE_KINDS = ["platform", "owner_report", "org_report", "crawled"] as const;
export type OutcomeSourceKind = (typeof OUTCOME_SOURCE_KINDS)[number];

/** `partial` chỉ có từ tự khai của đơn vị (Phase 6); lô trên sàn dùng pending/paid/defaulted. */
export const OUTCOME_PAYMENT_STATUSES = ["pending", "partial", "paid", "defaulted"] as const;
export type OutcomePaymentStatus = (typeof OUTCOME_PAYMENT_STATUSES)[number];

/** Khớp CHECK của auction_sale_contracts.status (migration 20260914000001). */
const SALE_CONTRACT_STATUSES = [
  "drafting",
  "awaiting_signatures",
  "awaiting_confirmation",
  "signed",
  "completed",
  "cancelled",
] as const satisfies readonly SaleContractStatus[];

export interface OutcomeSourceEntry {
  kind: OutcomeSourceKind | null;
  label: OutcomeConfidence | null;
  outcome: ResolvedOutcomeKind | null;
  price: number | null;
  date: string | null;
  orgName: string | null;
  sessionCode: string | null;
  /** Lượt đấu — chỉ nguồn `owner_report` mang số lượt. */
  roundNo: number | null;
  /** Id bản ghi gốc: owner_asset_outcomes.id (owner_report), auction_session_items.id (platform), … */
  refId: string | null;
  /** Chỉ nguồn platform / owner_report có trạng thái thu tiền, và chỉ khi "Đã bán". */
  paymentStatus: OutcomePaymentStatus | null;
  /** Hợp đồng mua bán CHƯA huỷ của lô — chỉ nguồn platform. Tuỳ chọn để các fixture cũ vẫn hợp lệ. */
  contractCode?: string | null;
  contractStatus?: SaleContractStatus | null;
}

export interface ResolvedAssetOutcome {
  listingId: string;
  outcome: ResolvedOutcomeKind | null;
  price: number | null;
  date: string | null;
  paymentStatus: OutcomePaymentStatus | null;
  confidence: OutcomeConfidence | null;
  hasConflict: boolean;
  /** Mọi nguồn, xếp theo hạng — phần tử đầu là nguồn thắng. */
  sources: OutcomeSourceEntry[];
}

export type ResolvedOutcomeRow =
  Database["public"]["Functions"]["owner_asset_outcomes_resolved"]["Returns"][number];

export const OUTCOME_CONFIDENCE_META: Record<OutcomeConfidence, { label: string; description: string }> = {
  platform: {
    label: "Sàn xác nhận",
    description: "Kết quả phiên đấu giá trực tuyến chạy trên taisandaugia.",
  },
  reconciled: {
    label: "Đã đối chiếu",
    description: "Số đơn vị tự khai khớp báo cáo của tổ chức đấu giá (lệch không quá 1%).",
  },
  owner_evidence: {
    label: "Tự khai · có biên bản",
    description: "Đơn vị tự khai, có đính kèm biên bản đấu giá.",
  },
  self_reported: {
    label: "Tự khai",
    description: "Số liệu tự khai, chưa đối chiếu được với nguồn khác.",
  },
  estimated: {
    label: "Ước tính",
    description: "Suy ra từ tin đăng thu thập công khai, có thể chưa chính xác.",
  },
};

export const OUTCOME_SOURCE_KIND_LABEL: Record<OutcomeSourceKind, string> = {
  platform: "Phiên trên sàn",
  owner_report: "Đơn vị tự khai",
  org_report: "Tổ chức đấu giá tự khai",
  crawled: "Tin đăng thu thập",
};

export const OUTCOME_KIND_LABEL: Record<ResolvedOutcomeKind, string> = {
  sold: "Đã bán",
  unsold: "Không thành",
  postponed: "Hoãn",
  cancelled: "Huỷ phiên",
  withdrawn: "Rút khỏi phiên",
};

// ─── Lý do "Không thành" (owner_asset_outcomes.failure_reason) ───────────────
// Lưu MÃ cho các lựa chọn nhanh; "Khác" lưu nguyên câu người dùng gõ (hoặc
// "other" nếu để trống) ⇒ đọc lại luôn qua unsoldReasonLabel().

export const UNSOLD_REASONS = ["no_registrants", "single_bidder", "deposit_forfeited", "other"] as const;
export type UnsoldReason = (typeof UNSOLD_REASONS)[number];

export const UNSOLD_REASON_LABEL: Record<UnsoldReason, string> = {
  no_registrants: "Không ai đăng ký",
  single_bidder: "Chỉ 1 người",
  deposit_forfeited: "Bỏ cọc",
  other: "Khác",
};

export function unsoldReasonLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return (UNSOLD_REASON_LABEL as Record<string, string>)[raw] ?? raw;
}

export function isSoldOutcome(kind: ResolvedOutcomeKind | null | undefined): boolean {
  return kind === "sold";
}

// ─── Thu hẹp kiểu ────────────────────────────────────────────────────────────

function oneOf<T extends string>(allowed: readonly T[], v: unknown): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toText(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function mapOutcomeSource(raw: unknown): OutcomeSourceEntry {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    kind: oneOf(OUTCOME_SOURCE_KINDS, r.kind),
    label: oneOf(OUTCOME_CONFIDENCES, r.label),
    outcome: oneOf(RESOLVED_OUTCOME_KINDS, r.outcome),
    price: toNumber(r.price),
    date: toText(r.date),
    orgName: toText(r.org_name),
    sessionCode: toText(r.session_code),
    roundNo: toNumber(r.round_no),
    refId: toText(r.ref_id),
    paymentStatus: oneOf(OUTCOME_PAYMENT_STATUSES, r.payment_status),
    contractCode: toText(r.contract_code),
    contractStatus: oneOf(SALE_CONTRACT_STATUSES, r.contract_status),
  };
}

export function mapResolvedOutcomeRow(row: ResolvedOutcomeRow): ResolvedAssetOutcome {
  return {
    listingId: row.listing_id,
    outcome: oneOf(RESOLVED_OUTCOME_KINDS, row.resolved_outcome),
    price: toNumber(row.resolved_price),
    date: toText(row.resolved_date),
    paymentStatus: oneOf(OUTCOME_PAYMENT_STATUSES, row.payment_status),
    confidence: oneOf(OUTCOME_CONFIDENCES, row.confidence_label),
    hasConflict: row.has_conflict === true,
    sources: Array.isArray(row.sources) ? row.sources.map(mapOutcomeSource) : [],
  };
}

/** Câu giải thích một nguồn: "Phiên trên sàn — PDG000013 · Công ty X", "Đơn vị tự khai — Lượt 2 · Công ty X". */
export function describeOutcomeSource(entry: OutcomeSourceEntry | undefined): string | null {
  if (!entry?.kind) return null;
  const base = OUTCOME_SOURCE_KIND_LABEL[entry.kind];
  const round = entry.roundNo !== null ? `Lượt ${entry.roundNo}` : null;
  const where = [entry.sessionCode, round, entry.orgName].filter(Boolean).join(" · ");
  return where ? `${base} — ${where}` : base;
}

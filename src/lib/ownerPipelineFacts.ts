// Adapter "Đường ống": quy tin đã nhận và hồ sơ số hoá về PipelineFacts
// (docs/owner-control-tower-plan.md Phase 12). Thuần — hook useOwnerPipeline tải
// dữ liệu, ownerPipeline.ts chọn cột.
//
// Câu select của hồ sơ nằm NGAY cạnh kiểu dòng của nó để hai thứ không trôi lệch.

import { SAME_ROUND_DAYS, dayDiff } from "@/lib/ownerPulse";
import { isoDayOf } from "@/lib/ownerOutcomeReport";
import { SESSION_STATUS_LABELS, sessionStatusOf } from "@/lib/listings/sessionStatus";
import { sessionPhaseOf } from "@/lib/auctionSessions/phase";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import type {
  PipelineFacts,
  PipelinePrep,
  PipelineRound,
  PipelineSaleStage,
} from "@/lib/ownerPipeline";
import type { AssetOwnerClaim } from "@/types/asset-owner";
import type {
  AssetPostingReviewStatus,
  AssetPostingStatus,
  BrokerRequestStatus,
  ServiceRequestStatus,
} from "@/types/asset-posting";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";
import type { SaleContractStatus } from "@/types/auction-sale-contract";

// ─── Hồ sơ số hoá ────────────────────────────────────────────────────────────

/**
 * Hồ sơ + chuỗi ký gửi + các lô đã vào phiên + hợp đồng mua bán, trong MỘT lượt
 * đọc. Thành viên không gian đọc được các bảng con qua owner_posting_can (Phase 4);
 * phiên / lô / trạng thái lô công khai khi phiên đã công bố.
 * Kiểu `string` (không literal): bộ phân tích select ở tầng kiểu của supabase-js
 * không cần dựng kiểu cho chuỗi lồng 3 tầng này — dòng được ép về PipelinePostingRow.
 */
export const PIPELINE_POSTING_SELECT: string = `
  id, title, status, review_status, starting_price, chosen_org_id, created_at, updated_at,
  user_id, workspace_id, branch_id, province, child_slug, parent_slug, image_urls,
  chosen_org:auction_organizations!asset_postings_chosen_org_id_fkey(name),
  requests:asset_service_requests(status, created_at, updated_at, reopened_at),
  brokers:asset_broker_requests(status, created_at),
  contracts:consignment_contracts(status, created_at, signed_at, cancelled_at),
  lots:auction_session_items(
    id, created_at,
    session:auction_sessions!auction_session_items_session_id_fkey(
      status, code, starts_at, ends_at, registration_end_at, published_at, updated_at
    ),
    state:auction_lot_states!auction_lot_states_lot_id_fkey(
      status, result, winning_amount, payment_status, payment_confirmed_at, closed_at, updated_at
    ),
    sales:auction_sale_contracts!auction_sale_contracts_lot_id_fkey(
      status, price, created_at, signed_at, paid_at, completed_at, cancelled_at, cancel_kind
    )
  )
`;

export interface PipelineSessionRow {
  status: "draft" | "published" | "cancelled";
  code: string | null;
  starts_at: string;
  ends_at: string;
  registration_end_at: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface PipelineLotStateRow {
  status: "pending" | "open" | "paused" | "closed" | "withdrawn";
  result: "sold" | "unsold" | null;
  winning_amount: number | null;
  payment_status: "pending" | "paid" | "defaulted" | null;
  payment_confirmed_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

export interface PipelineSaleRow {
  status: SaleContractStatus;
  price: number | null;
  created_at: string;
  signed_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_kind: "buyer_refused" | "seller_refused" | "mutual" | null;
}

export interface PipelineLotRow {
  id: string;
  created_at: string;
  session: PipelineSessionRow | null;
  state: PipelineLotStateRow | null;
  sales: PipelineSaleRow[] | null;
}

export interface PipelinePostingRow {
  id: string;
  title: string;
  status: AssetPostingStatus;
  review_status: AssetPostingReviewStatus | null;
  starting_price: number | null;
  chosen_org_id: string | null;
  created_at: string;
  updated_at: string;
  // Chỉ trang Tài sản dùng (khu vực, chi nhánh, loại, tổ chức, quyền ghi) — tuỳ chọn
  // để các test dựng dòng bằng tay không phải khai đủ.
  user_id?: string;
  workspace_id?: string | null;
  branch_id?: string | null;
  province?: string | null;
  child_slug?: string | null;
  parent_slug?: string | null;
  /** [0] = ảnh bìa (bucket public). */
  image_urls?: string[] | null;
  chosen_org?: { name: string } | null;
  requests: {
    status: ServiceRequestStatus;
    created_at: string;
    updated_at: string;
    reopened_at: string | null;
  }[] | null;
  brokers: { status: BrokerRequestStatus; created_at: string }[] | null;
  contracts: {
    status: ConsignmentContractStatus;
    created_at: string;
    signed_at: string | null;
    cancelled_at: string | null;
  }[] | null;
  lots: PipelineLotRow[] | null;
}

const SELECTED_REQUEST: readonly ServiceRequestStatus[] = ["selected", "accepted"];
const ACTIVE_BROKER: readonly BrokerRequestStatus[] = ["pending", "sourcing", "quoted"];
/** Trạng thái cũ của asset_postings (seed) ngụ ý đã chốt tổ chức. */
const LEGACY_SELECTED: readonly AssetPostingStatus[] = ["matched", "contracted"];

function minIso(values: (string | null | undefined)[]): string | null {
  let out: string | null = null;
  for (const v of values) if (v && (!out || v < out)) out = v;
  return out;
}

function maxIso(values: (string | null | undefined)[]): string | null {
  let out: string | null = null;
  for (const v of values) if (v && (!out || v > out)) out = v;
  return out;
}

function toPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function prepOf(row: PipelinePostingRow): PipelinePrep {
  const requests = row.requests ?? [];
  const brokers = (row.brokers ?? []).filter((b) => b.status !== "cancelled");
  const contracts = row.contracts ?? [];
  const live = contracts.find((c) => c.status !== "cancelled");
  const selected = requests.find((r) => SELECTED_REQUEST.includes(r.status));

  let orgSelectedAt: string | null = null;
  if (!live) {
    if (selected) orgSelectedAt = selected.updated_at;
    else if (row.chosen_org_id || LEGACY_SELECTED.includes(row.status)) orgSelectedAt = row.updated_at;
  }

  return {
    draft: row.status === "draft",
    reviewStatus: row.review_status ?? null,
    requestedAt: minIso([...requests.map((r) => r.created_at), ...brokers.map((b) => b.created_at)]),
    quotedCount: requests.filter((r) => r.status === "quoted").length,
    brokerActive: brokers.some((b) => ACTIVE_BROKER.includes(b.status)),
    restartedAt: maxIso(contracts.filter((c) => c.status === "cancelled").map((c) => c.cancelled_at)),
    orgSelectedAt,
    contract:
      live && live.status !== "cancelled"
        ? { status: live.status, createdAt: live.created_at, signedAt: live.signed_at }
        : null,
  };
}

function saleStageOf(sale: PipelineSaleRow | undefined): { stage: PipelineSaleStage; at: string | null } | null {
  if (!sale) return null;
  if (sale.status === "completed") return { stage: "done", at: sale.completed_at ?? sale.paid_at };
  if (sale.status === "signed") {
    return sale.paid_at
      ? { stage: "done", at: sale.paid_at }
      : { stage: "paying", at: sale.signed_at ?? sale.created_at };
  }
  return { stage: "signing", at: sale.created_at };
}

/** Lô ⇒ lượt, cùng thứ tự ưu tiên với nhánh "platform" của RPC owner_asset_outcomes_resolved. */
export function lotToRound(lot: PipelineLotRow, now: Date = new Date()): PipelineRound | null {
  const s = lot.session;
  if (!s) return null;
  const st = lot.state;
  const sessionCode = s.code;

  if (s.status === "cancelled") {
    // auction_sessions không có cancelled_at — updated_at là lần đổi trạng thái cuối.
    return { state: "void", voidKind: "cancelled", at: s.updated_at, sessionCode };
  }
  if (st?.status === "withdrawn") {
    return { state: "void", voidKind: "withdrawn", at: st.closed_at ?? st.updated_at, sessionCode };
  }
  if (st?.status === "closed" && st.result === "unsold") {
    return { state: "unsold", at: st.closed_at ?? st.updated_at, sessionCode };
  }
  if (st?.status === "closed" && st.result === "sold") {
    const sales = lot.sales ?? [];
    const live = sales.find((x) => x.status !== "cancelled");
    // Người mua từ chối ⇒ lô đã thành "defaulted"; các kiểu huỷ khác đưa lô về chờ ký lại.
    const saleCancelledAt = maxIso(
      sales
        .filter((x) => x.status === "cancelled" && x.cancel_kind !== "buyer_refused")
        .map((x) => x.cancelled_at),
    );
    return {
      state: "sold",
      at: st.closed_at ?? st.updated_at,
      price: toPrice(live?.price) ?? toPrice(st.winning_amount),
      payment: st.payment_status,
      paymentAt: st.payment_confirmed_at,
      sale: saleStageOf(live),
      saleCancelledAt,
      sessionCode,
    };
  }

  // Chưa có kết quả trên sàn (kể cả lô đấu trực tiếp — không bao giờ có trạng thái lô).
  const phase = sessionPhaseOf(s, now);
  if (phase === "ongoing") return { state: "live", at: s.starts_at, sessionCode };
  if (phase === "ended") return { state: "awaiting_result", at: s.starts_at, sessionCode };
  return {
    state: "announced",
    at: s.published_at ?? lot.created_at,
    startsAt: s.starts_at,
    phaseLabel: SESSION_STATUS_LABELS[phase],
    sessionCode,
  };
}

/** Mới nhất trước: công bố → giờ đấu → lúc thêm lô. Theo công bố vì phiên bị huỷ có thể có giờ đấu muộn hơn phiên thay thế. */
function compareLotsDesc(a: PipelineLotRow, b: PipelineLotRow): number {
  const key = (l: PipelineLotRow) => [l.session?.published_at ?? "", l.session?.starts_at ?? "", l.created_at];
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] < kb[i] ? 1 : -1;
  }
  return 0;
}

/** Hồ sơ số hoá ⇒ dữ kiện. Hồ sơ đã huỷ ⇒ null (không lên bảng). */
export function postingToFacts(row: PipelinePostingRow, now: Date = new Date()): PipelineFacts | null {
  if (row.status === "cancelled") return null;

  // Phiên nháp: quản lý của tổ chức (và admin) đọc được qua policy khác — phải tự lọc.
  const lots = (row.lots ?? [])
    .filter((l) => l.session && l.session.status !== "draft")
    .sort(compareLotsDesc);
  const [current, previous] = lots;
  const prevRound = previous ? lotToRound(previous, now) : null;

  return {
    kind: "posting",
    id: row.id,
    title: row.title || "Hồ sơ chưa đặt tên",
    href: `/chu-tai-san/dang-tai-san/${row.id}`,
    startingPrice: toPrice(row.starting_price),
    createdAt: row.created_at,
    prep: prepOf(row),
    round: current ? lotToRound(current, now) : null,
    prior: previous ? { at: prevRound?.at ?? previous.session?.starts_at ?? null } : null,
  };
}

// ─── Tin đã nhận ─────────────────────────────────────────────────────────────

/** Claim ⇒ dữ kiện. Chờ xác nhận / bị từ chối / tin bị RLS ẩn ⇒ null. */
export function claimToFacts(
  claim: AssetOwnerClaim,
  outcome: ResolvedAssetOutcome | undefined,
  now: Date = new Date(),
): PipelineFacts | null {
  if (claim.status !== "auto_claimed" && claim.status !== "confirmed") return null;
  const listing = claim.listing;
  if (!claim.listing_id || !listing) return null;

  const ca = (listing.custom_attributes ?? {}) as Record<string, unknown>;
  const rawTime = ca.auction_time ?? ca.auction_date;
  const auctionTime = typeof rawTime === "string" && rawTime ? rawTime : null;
  const auctionDay = isoDayOf(auctionTime);

  // Cùng luật "cùng lượt" với RPC và Nhịp đập: kết quả cũ hơn ngày đấu > 7 ngày thuộc lượt trước.
  const hasOutcome = !!outcome?.outcome;
  const olderRound =
    hasOutcome && !!outcome?.date && !!auctionDay && dayDiff(outcome.date, auctionDay) > SAME_ROUND_DAYS;

  let round: PipelineRound;
  if (hasOutcome && !olderRound && outcome?.outcome) {
    const top = outcome.sources[0];
    const sessionCode = top?.sessionCode ?? null;
    if (outcome.outcome === "sold") {
      const contract =
        top?.kind === "platform" && top.contractStatus && top.contractStatus !== "cancelled"
          ? top.contractStatus
          : null;
      round = {
        state: "sold",
        at: outcome.date,
        price: outcome.price,
        payment: outcome.paymentStatus,
        paymentAt: null,
        sale: contract
          ? {
              stage: contract === "completed" ? "done" : contract === "signed" ? "paying" : "signing",
              at: outcome.date,
            }
          : null,
        sessionCode,
      };
    } else if (outcome.outcome === "unsold") {
      round = { state: "unsold", at: outcome.date, sessionCode };
    } else {
      round = { state: "void", voidKind: outcome.outcome, at: outcome.date, sessionCode };
    }
  } else {
    const phase = sessionStatusOf(listing.status, ca, now);
    if (phase === "ongoing") round = { state: "live", at: auctionTime };
    else if (phase === "ended") round = { state: "awaiting_result", at: auctionTime };
    else {
      round = {
        state: "announced",
        at: listing.created_at ?? claim.created_at,
        startsAt: auctionTime,
        phaseLabel: SESSION_STATUS_LABELS[phase],
      };
    }
  }

  return {
    kind: "listing",
    id: claim.listing_id,
    title: listing.title || claim.asset_owner?.name || "Tài sản",
    href: `/listings/${claim.listing_id}`,
    startingPrice: toPrice(listing.price),
    createdAt: listing.created_at ?? claim.created_at,
    prep: null,
    round,
    prior: olderRound ? { at: outcome?.date ?? null } : null,
  };
}

// ─── Gom hai nguồn ───────────────────────────────────────────────────────────

export interface CollectPipelineInput {
  claims: AssetOwnerClaim[];
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>;
  postings: PipelinePostingRow[];
  now?: Date;
}

export interface CollectedPipelineFacts {
  facts: PipelineFacts[];
  /** Tin "Chờ xác nhận" — chưa vào đường ống, trang gợi ý xác nhận ở dạng Bảng. */
  pendingClaimCount: number;
}

export function collectPipelineFacts({
  claims,
  outcomesByListing,
  postings,
  now = new Date(),
}: CollectPipelineInput): CollectedPipelineFacts {
  const facts: PipelineFacts[] = [];
  let pendingClaimCount = 0;

  // UNIQUE (workspace_id, listing_id) ⇒ mỗi tin tối đa một claim, không cần khử trùng.
  for (const claim of claims) {
    if (claim.status === "pending_confirmation") {
      if (claim.listing) pendingClaimCount++;
      continue;
    }
    const outcome = claim.listing_id ? outcomesByListing[claim.listing_id] : undefined;
    const f = claimToFacts(claim, outcome, now);
    if (f) facts.push(f);
  }

  for (const row of postings) {
    const f = postingToFacts(row, now);
    if (f) facts.push(f);
  }

  return { facts, pendingClaimCount };
}

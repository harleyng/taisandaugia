// "Đường ống" — giai đoạn vòng đời của một tài sản (docs/owner-control-tower-plan.md Phase 12).
//
// Thuần (không React/Supabase) để test được. Hai loại tài sản — tin đã nhận
// (asset_owner_claims → listings) và hồ sơ số hoá (asset_postings) — không nối
// với nhau; adapter ở ownerPipelineFacts.ts quy cả hai về `PipelineFacts`, module
// này chỉ quyết định CỘT. Mỗi tài sản rơi vào đúng MỘT cột.
//
// Nhánh thất bại (người dùng chốt 2026-09-26, "theo lượt kế tiếp"):
//   "Không thành"  = lượt mới nhất kết thúc không bán được (kể cả người trúng bỏ
//                    cọc) và CHƯA có lượt mới.
//   "Chờ đấu lại"  = đã công bố lượt mới sau một lượt trước, HOẶC phiên gần nhất
//                    bị hoãn / huỷ / rút. Sang "Phiên" khi phiên mới bắt đầu.

import { dayDiff, formatDayMonth } from "@/lib/ownerPulse";
import { ownerConsignmentPath } from "@/lib/consignment/ownerConsignment";
import { isoDayOf, todayIso } from "@/lib/ownerOutcomeReport";
import { OUTCOME_KIND_LABEL, type OutcomePaymentStatus } from "@/lib/ownerOutcomes";
import type { AssetPostingReviewStatus } from "@/types/asset-posting";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";

// ─── Giai đoạn ───────────────────────────────────────────────────────────────

/** Thứ tự cột cố định: 8 cột luồng chính, rồi 2 cột nhánh thất bại. */
export const PIPELINE_STAGES = [
  "so_hoa",
  "chon_to_chuc",
  "hd_dich_vu",
  "niem_yet",
  "phien",
  "trung",
  "hd_mua_ban",
  "da_thu_tien",
  "khong_thanh",
  "cho_dau_lai",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_BRANCH_STAGES: readonly PipelineStage[] = ["khong_thanh", "cho_dau_lai"];

export const PIPELINE_STAGE_META: Record<PipelineStage, { label: string; empty: string }> = {
  so_hoa: { label: "Số hoá", empty: "Không có hồ sơ đang số hoá." },
  chon_to_chuc: { label: "Chọn tổ chức", empty: "Không có hồ sơ đang chọn tổ chức." },
  hd_dich_vu: { label: "HĐ dịch vụ", empty: "Không có hợp đồng dịch vụ đang chờ." },
  niem_yet: { label: "Niêm yết", empty: "Chưa có tài sản đang niêm yết." },
  phien: { label: "Phiên", empty: "Không có phiên đang chờ kết quả." },
  trung: { label: "Trúng", empty: "Chưa có tài sản trúng đấu giá." },
  hd_mua_ban: { label: "HĐ mua bán", empty: "Không có hợp đồng mua bán đang chạy." },
  da_thu_tien: { label: "Đã thu tiền", empty: "Chưa có tài sản thu đủ tiền." },
  khong_thanh: { label: "Không thành", empty: "Không có phiên không thành — tốt lắm." },
  cho_dau_lai: { label: "Chờ đấu lại", empty: "Không có tài sản chờ đấu lại." },
};

/**
 * Số ngày tối đa ở một giai đoạn trước khi thẻ bị tô đỏ (lớn hơn mới đỏ).
 * null = giai đoạn cuối, không bao giờ trễ.
 */
export const PIPELINE_STALE_DAYS: Record<PipelineStage, number | null> = {
  so_hoa: 14, // số hoá xong 2 tuần mà chưa gửi tổ chức nào
  chon_to_chuc: 14, // báo giá thường về trong một tuần
  hd_dich_vu: 21, // ký + tổ chức chuẩn bị thông báo đấu giá
  niem_yet: 45, // niêm yết theo luật 15–30 ngày, cộng dư
  phien: 7, // = OUTCOME_OVERDUE_WARN_DAYS: phiên qua một tuần chưa có kết quả
  trung: 14, // hợp đồng mua bán nên ký sớm sau khi trúng
  hd_mua_ban: 30, // hạn thanh toán 30 ngày
  da_thu_tien: null,
  khong_thanh: 30, // chưa lên lịch đấu lại
  cho_dau_lai: 60, // tính từ lượt thất bại
};

// ─── Dữ kiện chung của hai loại tài sản ─────────────────────────────────────

export type PipelineAssetKind = "listing" | "posting";

/** Trạng thái của LƯỢT hiện tại (mới nhất). */
export type PipelineRoundState = "announced" | "live" | "awaiting_result" | "void" | "unsold" | "sold";
export type PipelineVoidKind = "postponed" | "cancelled" | "withdrawn";
export type PipelineSaleStage = "signing" | "paying" | "done";

export interface PipelineRound {
  state: PipelineRoundState;
  /** Mốc neo của trạng thái (công bố / bắt đầu / đóng lô / ngày kết quả). */
  at: string | null;
  /** Ngày giờ đấu — chỉ để in "dd/mm" ở cột Niêm yết / Chờ đấu lại. */
  startsAt?: string | null;
  voidKind?: PipelineVoidKind | null;
  price?: number | null;
  payment?: OutcomePaymentStatus | null;
  paymentAt?: string | null;
  /** Hợp đồng mua bán CHƯA huỷ của lô. */
  sale?: { stage: PipelineSaleStage; at: string | null } | null;
  /** Hợp đồng mua bán bị huỷ không do người mua (lô quay về chờ ký lại). */
  saleCancelledAt?: string | null;
  sessionCode?: string | null;
  /** "Đang bán hồ sơ" / "Sắp diễn ra" cho lượt đã công bố. */
  phaseLabel?: string | null;
}

/** Các bước TRƯỚC phiên — chỉ hồ sơ số hoá có. */
export interface PipelinePrep {
  draft: boolean;
  reviewStatus: AssetPostingReviewStatus | null;
  /** Yêu cầu báo giá / nhờ sàn chọn giúp sớm nhất. */
  requestedAt: string | null;
  quotedCount: number;
  brokerActive: boolean;
  /** Lần gần nhất hợp đồng dịch vụ bị huỷ (báo giá được mở lại). */
  restartedAt: string | null;
  /** Đã chốt tổ chức mà chưa có hợp đồng — chỉ còn ở dữ liệu cũ. */
  orgSelectedAt: string | null;
  contract: {
    status: Exclude<ConsignmentContractStatus, "cancelled">;
    createdAt: string | null;
    signedAt: string | null;
  } | null;
}

export interface PipelineFacts {
  kind: PipelineAssetKind;
  id: string;
  title: string;
  href: string;
  startingPrice: number | null;
  createdAt: string | null;
  prep: PipelinePrep | null;
  round: PipelineRound | null;
  /** Có lượt trước lượt hiện tại (tài sản đấu lại). */
  prior: { at: string | null } | null;
}

export interface PipelineResolution {
  stage: PipelineStage;
  /** Mốc vào giai đoạn — gốc tính "N ngày". */
  since: string | null;
  /** Một dòng giải thích ngắn dưới tên tài sản. */
  detail: string | null;
}

// ─── Luật chọn cột ───────────────────────────────────────────────────────────

const CONTRACT_DETAIL: Record<Exclude<ConsignmentContractStatus, "cancelled" | "signed">, string> = {
  drafting: "Đang soạn hợp đồng",
  awaiting_signatures: "Chờ ký hợp đồng",
  awaiting_confirmation: "Chờ xác nhận bản ký",
};

const REVIEW_DETAIL: Record<AssetPostingReviewStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
};

/** Mốc muộn hơn trong hai mốc (chuỗi ISO so được theo thứ tự từ điển). */
function later(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

function dayMonthOf(raw: string | null | undefined): string | null {
  const day = isoDayOf(raw);
  return day ? formatDayMonth(day) : null;
}

function withCode(code: string | null | undefined, text: string): string {
  return code ? `${code} · ${text}` : text;
}

/**
 * Cột của một tài sản. Luật xét theo thứ tự, luật đầu tiên khớp thắng. Có lượt
 * hiện tại thì lượt quyết định; các bước trước phiên (R11–R15) chỉ xét khi chưa có lượt.
 */
export function resolvePipelineStage(f: PipelineFacts): PipelineResolution {
  const r = f.round;

  if (r?.state === "sold") {
    // R1 — người trúng bỏ cọc: lượt này coi như không thành.
    if (r.payment === "defaulted") {
      return { stage: "khong_thanh", since: r.paymentAt ?? r.at, detail: "Người trúng bỏ cọc" };
    }
    // R2 — đã thu đủ.
    if (r.payment === "paid" || r.sale?.stage === "done") {
      return { stage: "da_thu_tien", since: r.paymentAt ?? r.sale?.at ?? r.at, detail: null };
    }
    // R3 — đang ký / đang thanh toán theo hợp đồng mua bán, hoặc đã thu một phần.
    if (r.sale || r.payment === "partial") {
      const detail =
        r.payment === "partial"
          ? "Đã thu một phần"
          : r.sale?.stage === "paying"
            ? "Đang thanh toán"
            : "Đang ký hợp đồng";
      return { stage: "hd_mua_ban", since: r.sale?.at ?? r.at, detail };
    }
    // R4 — trúng, chưa có hợp đồng mua bán.
    const detail = r.saleCancelledAt
      ? "HĐ mua bán đã huỷ"
      : r.payment === "pending"
        ? "Chờ thu tiền"
        : "Chưa rõ thanh toán";
    return { stage: "trung", since: later(r.at, r.saleCancelledAt), detail };
  }

  // R5 — không bán được, chưa có lượt mới.
  if (r?.state === "unsold") {
    return { stage: "khong_thanh", since: r.at, detail: withCode(r.sessionCode, "Chưa có lịch đấu lại") };
  }

  // R6 — phiên hoãn / huỷ / rút: chờ lên lịch lượt sau.
  if (r?.state === "void") {
    const label = r.voidKind ? OUTCOME_KIND_LABEL[r.voidKind] : "Phiên không diễn ra";
    return { stage: "cho_dau_lai", since: r.at, detail: withCode(r.sessionCode, label) };
  }

  // R7 — đang diễn ra.
  if (r?.state === "live") {
    return { stage: "phien", since: r.at, detail: withCode(r.sessionCode, "Đang diễn ra") };
  }

  // R8 — phiên đã qua, chưa nguồn nào có kết quả.
  if (r?.state === "awaiting_result") {
    return { stage: "phien", since: r.at, detail: withCode(r.sessionCode, "Chờ kết quả") };
  }

  if (r?.state === "announced") {
    const day = dayMonthOf(r.startsAt);
    // R9 — lượt mới sau một lượt trước.
    if (f.prior) {
      return {
        stage: "cho_dau_lai",
        since: f.prior.at ?? r.at,
        detail: day ? `Lịch đấu lại ${day}` : "Đã có lịch đấu lại",
      };
    }
    // R10 — niêm yết lượt đầu.
    const phase = r.phaseLabel ?? "Đã công bố";
    return { stage: "niem_yet", since: r.at, detail: day ? `${phase} · ${day}` : phase };
  }

  const p = f.prep;
  if (p) {
    // R11 / R12 — hợp đồng dịch vụ đã ký (chờ tổ chức đưa vào phiên) / đang ký.
    if (p.contract?.status === "signed") {
      return {
        stage: "hd_dich_vu",
        since: p.contract.signedAt ?? p.contract.createdAt,
        detail: "Đã ký · chờ niêm yết",
      };
    }
    if (p.contract) {
      return { stage: "hd_dich_vu", since: p.contract.createdAt, detail: CONTRACT_DETAIL[p.contract.status] };
    }
    // R13 — dữ liệu cũ: đã chốt tổ chức mà chưa có hợp đồng.
    if (p.orgSelectedAt) {
      return { stage: "hd_dich_vu", since: p.orgSelectedAt, detail: "Chờ lập hợp đồng" };
    }
    // R14 — đang xin báo giá / nhờ sàn chọn giúp.
    if (p.requestedAt || p.brokerActive) {
      const detail =
        p.quotedCount > 0
          ? `${p.quotedCount} báo giá`
          : p.brokerActive
            ? "Sàn đang chọn giúp"
            : "Chờ báo giá";
      return { stage: "chon_to_chuc", since: later(p.requestedAt, p.restartedAt), detail };
    }
  }

  // R15 — hồ sơ số hoá chưa gửi tổ chức nào.
  if (f.kind === "posting") {
    const detail = p?.draft ? "Bản nháp" : p?.reviewStatus ? REVIEW_DETAIL[p.reviewStatus] : null;
    return { stage: "so_hoa", since: f.createdAt, detail };
  }

  // R16 — phòng thủ: tin mà adapter không dựng được lượt nào.
  return { stage: "niem_yet", since: f.createdAt, detail: null };
}

// ─── Số ngày & trễ hạn ──────────────────────────────────────────────────────

/** Số ngày ở giai đoạn hiện tại; không có mốc ⇒ null, không bao giờ âm. */
export function daysInStage(since: string | null | undefined, now: Date = new Date()): number | null {
  const day = isoDayOf(since);
  if (!day) return null;
  return Math.max(0, dayDiff(day, todayIso(now)));
}

export function isStageOverdue(stage: PipelineStage, days: number | null): boolean {
  const limit = PIPELINE_STALE_DAYS[stage];
  return limit !== null && days !== null && days > limit;
}

// ─── Gom thành bảng ──────────────────────────────────────────────────────────

const SOLD_STAGES: readonly PipelineStage[] = ["trung", "hd_mua_ban", "da_thu_tien"];
/** Cột mà việc đang diễn ra ở menu "Ký gửi đấu giá" — thẻ hồ sơ mở thẳng trang ký gửi. */
const CONSIGNMENT_STAGES: readonly PipelineStage[] = ["chon_to_chuc", "hd_dich_vu"];

export interface PipelineCard {
  id: string;
  kind: PipelineAssetKind;
  title: string;
  href: string;
  stage: PipelineStage;
  since: string | null;
  days: number | null;
  overdue: boolean;
  detail: string | null;
  /** Giá trúng ở các cột đã bán (khi biết), còn lại là giá khởi điểm. */
  price: number | null;
  priceKind: "winning" | "starting";
}

export interface PipelineColumnData {
  stage: PipelineStage;
  cards: PipelineCard[];
  overdueCount: number;
}

export interface PipelineBoardData {
  /** Luôn đủ 10 cột theo PIPELINE_STAGES, kể cả cột trống. */
  columns: PipelineColumnData[];
  total: number;
  overdueCount: number;
}

export function toPipelineCard(f: PipelineFacts, now: Date = new Date()): PipelineCard {
  const { stage, since, detail } = resolvePipelineStage(f);
  const days = daysInStage(since, now);
  const winning = SOLD_STAGES.includes(stage) && f.round?.price != null ? f.round.price : null;
  return {
    id: f.id,
    kind: f.kind,
    title: f.title,
    href: f.kind === "posting" && CONSIGNMENT_STAGES.includes(stage) ? ownerConsignmentPath(f.id) : f.href,
    stage,
    since,
    days,
    overdue: isStageOverdue(stage, days),
    detail,
    price: winning ?? f.startingPrice,
    priceKind: winning !== null ? "winning" : "starting",
  };
}

/** Trễ hạn lên đầu, rồi ở lâu nhất, rồi theo tên. "Đã thu tiền": mới thu lên đầu. */
function compareCards(stage: PipelineStage) {
  return (a: PipelineCard, b: PipelineCard): number => {
    if (stage === "da_thu_tien") {
      return (a.days ?? Infinity) - (b.days ?? Infinity) || a.title.localeCompare(b.title, "vi");
    }
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (b.days ?? -1) - (a.days ?? -1) || a.title.localeCompare(b.title, "vi");
  };
}

export function groupPipeline(facts: PipelineFacts[], now: Date = new Date()): PipelineBoardData {
  const byStage = new Map(PIPELINE_STAGES.map((s): [PipelineStage, PipelineCard[]] => [s, []]));
  for (const f of facts) {
    const card = toPipelineCard(f, now);
    byStage.get(card.stage)!.push(card);
  }

  const columns = PIPELINE_STAGES.map((stage) => {
    const cards = byStage.get(stage)!.sort(compareCards(stage));
    return { stage, cards, overdueCount: cards.filter((c) => c.overdue).length };
  });

  return {
    columns,
    total: facts.length,
    overdueCount: columns.reduce((s, c) => s + c.overdueCount, 0),
  };
}

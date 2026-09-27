// Trang "Tài sản" của Cổng Chủ tài sản — mỗi tài sản một dòng: đang ở giai đoạn
// nào và ai cần làm gì tiếp theo. Thuần (không React/Supabase) để test được.
//
// Cột giai đoạn lấy nguyên từ Đường ống (ownerPipeline.ts); module này chỉ gom
// 10 giai đoạn thành 5 nhóm tab, gắn khu vực / chi nhánh / vòng, và quyết định
// "Việc của bạn" cho từng dòng.

import { CHILD_NAME } from "@/constants/category.constants";
import { postingBadge, type OwnerConsignmentSummaryRow } from "@/lib/consignment/postingBadge";
import { formatDayMonth } from "@/lib/ownerPulse";
import { isoDayOf } from "@/lib/ownerOutcomeReport";
import { shortAssetId } from "@/lib/ownerAssetId";
import { parentOf } from "@/lib/reports/listingsReport";
import {
  toPipelineCard,
  type PipelineCard,
  type PipelineFacts,
  type PipelineStage,
} from "@/lib/ownerPipeline";
import { claimToFacts, postingToFacts, type PipelinePostingRow } from "@/lib/ownerPipelineFacts";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import type { AssetOwnerClaim } from "@/types/asset-owner";

// ─── Nhóm giai đoạn (tab) ────────────────────────────────────────────────────

export const ASSET_PHASES = ["prep", "auc", "fail", "won", "done"] as const;
export type AssetPhase = (typeof ASSET_PHASES)[number];

/** `step` = vị trí trên thanh 4 bước Chuẩn bị → Đấu giá → Sau trúng → Thu tiền. */
export const ASSET_PHASE_META: Record<AssetPhase, { label: string; step: number }> = {
  prep: { label: "Chuẩn bị", step: 0 },
  auc: { label: "Đang đấu giá", step: 1 },
  fail: { label: "Không thành", step: 1 },
  won: { label: "Sau trúng", step: 2 },
  done: { label: "Đã thu tiền", step: 3 },
};

export const ASSET_PATH_STEPS = ["Chuẩn bị", "Đấu giá", "Sau trúng", "Thu tiền"] as const;

export const STAGE_PHASE: Record<PipelineStage, AssetPhase> = {
  so_hoa: "prep",
  chon_to_chuc: "prep",
  hd_dich_vu: "prep",
  niem_yet: "auc",
  phien: "auc",
  khong_thanh: "fail",
  cho_dau_lai: "fail",
  trung: "won",
  hd_mua_ban: "won",
  da_thu_tien: "done",
};

/** Tên bước hiện ở cột "Giai đoạn". */
export const STAGE_STEP_LABEL: Record<PipelineStage, string> = {
  so_hoa: "Số hoá hồ sơ",
  chon_to_chuc: "Chọn tổ chức",
  hd_dich_vu: "HĐ dịch vụ",
  niem_yet: "Niêm yết",
  phien: "Phiên đấu giá",
  khong_thanh: "Không thành",
  cho_dau_lai: "Chờ đấu lại",
  trung: "Trúng đấu giá",
  hd_mua_ban: "HĐ mua bán",
  da_thu_tien: "Đã thu đủ",
};

// ─── Việc tiếp theo ──────────────────────────────────────────────────────────

export const OWNER_ROUTES = {
  outcomes: "/chu-tai-san/ket-qua",
  cashFlow: "/chu-tai-san/dong-tien",
  saleContracts: "/chu-tai-san/hop-dong-mua-ban",
  postings: "/chu-tai-san/dang-tai-san",
} as const;

export type AssetCtaAction = { kind: "report_outcome" } | { kind: "navigate"; href: string };

export interface AssetNextStep {
  /** Chủ tài sản (người đang xem, có quyền ghi) phải làm — vào tab "Cần bạn xử lý". */
  mine: boolean;
  /** Một câu: việc gì. */
  text: string;
  /** Không phải việc của bạn ⇒ đang chờ ai. */
  waitingOn: string | null;
  cta: { label: string; action: AssetCtaAction } | null;
}

const CONSIGNMENT_CTA: Record<NonNullable<OwnerConsignmentSummaryRow["owner_action"]>, string> = {
  choose_quote: "So sánh",
  confirm_contract: "Xác nhận HĐ",
  add_address: "Bổ sung",
  add_orgs: "Gửi thêm",
  send_orgs: "Gửi tổ chức",
};

const mine = (text: string, cta: AssetNextStep["cta"] = null): AssetNextStep => ({
  mine: true,
  text,
  waitingOn: null,
  cta,
});
const waiting = (waitingOn: string, text: string): AssetNextStep => ({ mine: false, text, waitingOn, cta: null });
const go = (label: string, href: string): AssetNextStep["cta"] => ({ label, action: { kind: "navigate", href } });

export interface NextStepInput {
  card: PipelineCard;
  facts: PipelineFacts;
  /** Hồ sơ số hoá: dòng của RPC owner_consignment_summary (việc chủ tài sản đang nợ). */
  consignment?: OwnerConsignmentSummaryRow | null;
  /** Vai trò trong không gian cho phép ghi tài sản này. */
  canWrite: boolean;
}

/** Luật xét theo thứ tự; người không có quyền ghi không bao giờ "nợ" việc. */
export function assetNextStep(input: NextStepInput): AssetNextStep {
  const step = rawNextStep(input);
  if (step.mine && !input.canWrite) {
    return { mine: false, text: step.text, waitingOn: "Thành viên phụ trách", cta: null };
  }
  return step;
}

function rawNextStep({ card, facts, consignment }: NextStepInput): AssetNextStep {
  const isPosting = facts.kind === "posting";

  if (card.stage === "da_thu_tien") return { mine: false, text: "Hoàn tất", waitingOn: null, cta: null };

  // Ký gửi: RPC là nguồn sự thật cho việc chủ tài sản đang nợ (chọn báo giá, xác nhận HĐ, địa chỉ).
  if (isPosting && consignment?.owner_action) {
    const label = postingBadge(consignment)?.label ?? "Hồ sơ cần bạn xử lý";
    return mine(label, go(CONSIGNMENT_CTA[consignment.owner_action], card.href));
  }

  switch (card.stage) {
    case "so_hoa": {
      const p = facts.prep;
      if (p?.draft) return mine("Hoàn thiện hồ sơ số hoá", go("Tiếp tục", card.href));
      if (p?.reviewStatus === "rejected") return mine("Sửa hồ sơ bị từ chối", go("Sửa hồ sơ", card.href));
      if (p?.reviewStatus === "pending") return waiting("Sàn", "Sàn đang duyệt hồ sơ");
      return mine("Gửi hồ sơ cho tổ chức đấu giá", go("Chọn tổ chức", card.href));
    }
    case "chon_to_chuc":
      return facts.prep?.brokerActive && !facts.prep.quotedCount
        ? waiting("Sàn", "Sàn đang chọn tổ chức giúp bạn")
        : waiting("Tổ chức", "Chờ tổ chức gửi báo giá");
    case "hd_dich_vu":
      return facts.prep?.contract?.status === "signed"
        ? waiting("Tổ chức", "Tổ chức chuẩn bị niêm yết")
        : waiting("Tổ chức", "Tổ chức đang soạn hợp đồng dịch vụ");
    case "niem_yet":
      return waiting("Tổ chức", nextSessionText(facts) ?? "Đang niêm yết");
    case "phien":
      if (facts.round?.state === "awaiting_result") {
        return isPosting
          ? waiting("Tổ chức", "Chờ tổ chức công bố kết quả")
          : mine("Phiên đã diễn ra — khai kết quả", { label: "Khai kết quả", action: { kind: "report_outcome" } });
      }
      return waiting("Tổ chức", "Phiên đang diễn ra");
    case "khong_thanh":
      // Chưa có luồng "giảm giá / đấu lại" trong sản phẩm — việc hiện ra nhưng không có nút.
      return mine("Quyết định giảm giá hoặc đấu lại");
    case "cho_dau_lai":
      return waiting("Tổ chức", nextSessionText(facts) ?? "Chờ tổ chức lên lịch đấu lại");
    case "trung":
      return isPosting
        ? waiting("Các bên", "Lập hợp đồng mua bán với người trúng")
        : mine("Ghi nhận thanh toán của người trúng", go("Ghi thu", OWNER_ROUTES.cashFlow));
    case "hd_mua_ban":
      return isPosting
        ? waiting("Các bên", "Theo dõi hợp đồng mua bán")
        : mine("Ghi nhận đợt thanh toán còn lại", go("Ghi thu", OWNER_ROUTES.cashFlow));
  }
}

function nextSessionText(facts: PipelineFacts): string | null {
  const day = isoDayOf(facts.round?.startsAt ?? null);
  return day ? `Phiên ${formatDayMonth(day)}` : null;
}

// ─── Dòng bảng ───────────────────────────────────────────────────────────────

export interface AssetLink {
  label: string;
  href: string;
}

export interface OwnerAssetRow extends PipelineCard {
  phase: AssetPhase;
  stepLabel: string;
  /** Mã tài sản trên sàn — chỉ tin đã nhận (dùng khi nhập kết quả từ Excel). */
  code: string | null;
  category: string | null;
  /** Ảnh bìa; null ⇒ ô icon theo nhóm tài sản (`parentSlug`). */
  thumbnail: string | null;
  parentSlug: string;
  province: string | null;
  branch: string | null;
  /** Số lượt đấu đã biết; 0 = chưa đấu. */
  rounds: number;
  orgName: string | null;
  startingPrice: number | null;
  next: AssetNextStep;
  /** Nơi xem chi tiết theo giai đoạn. */
  links: AssetLink[];
  /** Tin đã nhận — để mở dialog "Khai kết quả". */
  claim: AssetOwnerClaim | null;
}

/** Tin sàn tìm thấy, chờ chủ tài sản xác nhận (claim pending_confirmation). */
export interface OwnerClaimRow {
  id: string;
  listingId: string;
  title: string;
  category: string | null;
  thumbnail: string | null;
  parentSlug: string;
  province: string | null;
  branch: string | null;
  matchedName: string | null;
  /** 0–100; null = không có điểm. */
  score: number | null;
  price: number | null;
  auctionDay: string | null;
  canWrite: boolean;
}

export interface BuildOwnerAssetsInput {
  claims: AssetOwnerClaim[];
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>;
  postings: PipelinePostingRow[];
  roundCountsByListing: Record<string, number>;
  /** workspace_branches.id → tên. */
  branchNameById: Record<string, string>;
  /** asset_owners.id → tên chi nhánh trong không gian. */
  branchNameByOwner: Record<string, string>;
  consignmentByPosting: Record<string, OwnerConsignmentSummaryRow | undefined>;
  canWriteClaim: (claim: AssetOwnerClaim) => boolean;
  canWritePosting: (row: PipelinePostingRow) => boolean;
  now?: Date;
}

export interface OwnerAssetsData {
  rows: OwnerAssetRow[];
  claimRows: OwnerClaimRow[];
}

export function categoryName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return CHILD_NAME[slug] ?? slug;
}

function listingProvince(claim: AssetOwnerClaim): string | null {
  const addr = claim.listing?.address as Record<string, unknown> | null | undefined;
  const v = addr?.province ?? addr?.city;
  return typeof v === "string" && v ? v : null;
}

function listingThumb(claim: AssetOwnerClaim): { thumbnail: string | null; parentSlug: string } {
  return {
    thumbnail: claim.listing?.image_url || null,
    parentSlug: parentOf(claim.listing?.property_type_slug ?? ""),
  };
}

function claimBranch(claim: AssetOwnerClaim, byOwner: Record<string, string>): string | null {
  return (claim.asset_owner_id && byOwner[claim.asset_owner_id]) || claim.matched_name || null;
}

function stageLinks(row: Pick<OwnerAssetRow, "kind" | "stage" | "href">): AssetLink[] {
  const links: AssetLink[] = [];
  const phase = STAGE_PHASE[row.stage];
  if (row.kind === "posting") links.push({ label: "Hồ sơ số hoá", href: row.href });
  if (phase === "auc" || phase === "fail" || row.stage === "trung") {
    links.push({ label: "Kết quả phiên", href: OWNER_ROUTES.outcomes });
  }
  if (phase === "won" && row.kind === "posting") links.push({ label: "Hợp đồng mua bán", href: OWNER_ROUTES.saleContracts });
  if (phase === "won" || phase === "done") links.push({ label: "Dòng tiền", href: OWNER_ROUTES.cashFlow });
  if (row.kind === "listing") links.push({ label: "Trang tin trên sàn", href: row.href });
  return links;
}

/** Việc của bạn lên đầu, rồi trễ hạn, rồi ở lâu nhất, rồi theo tên. */
function compareRows(a: OwnerAssetRow, b: OwnerAssetRow): number {
  if (a.next.mine !== b.next.mine) return a.next.mine ? -1 : 1;
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return (b.days ?? -1) - (a.days ?? -1) || a.title.localeCompare(b.title, "vi");
}

export function buildOwnerAssets(input: BuildOwnerAssetsInput): OwnerAssetsData {
  const now = input.now ?? new Date();
  const rows: OwnerAssetRow[] = [];
  const claimRows: OwnerClaimRow[] = [];

  // UNIQUE (workspace_id, listing_id) ⇒ mỗi tin tối đa một claim.
  for (const claim of input.claims) {
    if (claim.status === "pending_confirmation") {
      if (!claim.listing || !claim.listing_id) continue;
      const ca = (claim.listing.custom_attributes ?? {}) as Record<string, unknown>;
      const t = ca.auction_time ?? ca.auction_date;
      const price = Number(claim.listing.price);
      claimRows.push({
        id: claim.id,
        listingId: claim.listing_id,
        title: claim.listing.title || "Tài sản",
        category: categoryName(claim.listing.property_type_slug),
        ...listingThumb(claim),
        province: listingProvince(claim),
        branch: claimBranch(claim, input.branchNameByOwner),
        matchedName: claim.matched_name,
        score: claim.confidence_score === null ? null : Math.round(claim.confidence_score * 100),
        price: Number.isFinite(price) && price > 0 ? price : null,
        auctionDay: isoDayOf(typeof t === "string" ? t : null),
        canWrite: input.canWriteClaim(claim),
      });
      continue;
    }
    const outcome = claim.listing_id ? input.outcomesByListing[claim.listing_id] : undefined;
    const facts = claimToFacts(claim, outcome, now);
    if (!facts) continue;
    const card = toPipelineCard(facts, now);
    const base: Omit<OwnerAssetRow, "links"> = {
      ...card,
      phase: STAGE_PHASE[card.stage],
      stepLabel: STAGE_STEP_LABEL[card.stage],
      code: shortAssetId(facts.id),
      category: categoryName(claim.listing?.property_type_slug),
      ...listingThumb(claim),
      province: listingProvince(claim),
      branch: claimBranch(claim, input.branchNameByOwner),
      rounds: claim.listing_id ? input.roundCountsByListing[claim.listing_id] ?? 0 : 0,
      orgName: null,
      startingPrice: facts.startingPrice,
      next: assetNextStep({ card, facts, canWrite: input.canWriteClaim(claim) }),
      claim,
    };
    rows.push({ ...base, links: stageLinks(base) });
  }

  for (const posting of input.postings) {
    const facts = postingToFacts(posting, now);
    if (!facts) continue;
    const card = toPipelineCard(facts, now);
    const rounds = (posting.lots ?? []).filter((l) => l.session && l.session.status !== "draft").length;
    const base: Omit<OwnerAssetRow, "links"> = {
      ...card,
      phase: STAGE_PHASE[card.stage],
      stepLabel: STAGE_STEP_LABEL[card.stage],
      code: null,
      category: categoryName(posting.child_slug),
      thumbnail: posting.image_urls?.[0] ?? null,
      parentSlug: posting.parent_slug ?? parentOf(posting.child_slug ?? ""),
      province: posting.province ?? null,
      branch: posting.branch_id ? input.branchNameById[posting.branch_id] ?? null : null,
      rounds,
      orgName: posting.chosen_org?.name ?? null,
      startingPrice: facts.startingPrice,
      next: assetNextStep({
        card,
        facts,
        consignment: input.consignmentByPosting[posting.id],
        canWrite: input.canWritePosting(posting),
      }),
      claim: null,
    };
    rows.push({ ...base, links: stageLinks(base) });
  }

  rows.sort(compareRows);
  claimRows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.title.localeCompare(b.title, "vi"));
  return { rows, claimRows };
}

// ─── Lọc ─────────────────────────────────────────────────────────────────────

export interface AssetFilter {
  query: string;
  branch: string;
  category: string;
}

/** Tìm theo tên, khu vực hoặc mã ("TS-8F2A1C", "Mã 8F2A1C", "8f2a"). */
export function matchesAssetFilter(
  x: { title: string; province: string | null; branch: string | null; category: string | null; code?: string | null },
  f: AssetFilter,
): boolean {
  if (f.branch && x.branch !== f.branch) return false;
  if (f.category && x.category !== f.category) return false;
  const q = f.query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${x.title} ${x.province ?? ""} ${x.branch ?? ""}`.toLowerCase();
  if (hay.includes(q)) return true;
  const code = q.replace(/^(ts-|m[aã]\s*)/, "").replace(/[#\s]/g, "").toUpperCase();
  return !!x.code && code.length >= 4 && x.code.startsWith(code);
}

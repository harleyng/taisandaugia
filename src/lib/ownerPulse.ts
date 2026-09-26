// "Nhịp đập" — việc cần làm của Trạm Điều Hành (docs/owner-control-tower-plan.md Phase 7).
//
// Thuần (không React/Supabase) để test được. Chỉ CHỌN việc từ kết quả đã hợp
// nhất của RPC owner_asset_outcomes_resolved — không gộp nguồn lại ở client.

import type { ClaimStatus } from "@/types/asset-owner";
import { isoDayOf, todayIso } from "@/lib/ownerOutcomeReport";
import type {
  OutcomeSourceKind,
  ResolvedAssetOutcome,
} from "@/lib/ownerOutcomes";

/** Cùng luật "cùng lượt" với RPC: hai mốc cách nhau ≤ 7 ngày là một lượt đấu. */
export const SAME_ROUND_DAYS = 7;
/** Quá hạn khai lâu hơn ngần này ⇒ thẻ tô cảnh báo. */
export const OUTCOME_OVERDUE_WARN_DAYS = 7;
/** Số thẻ hiện trước khi bấm "Xem tất cả" (§A8.2). */
export const PULSE_VISIBLE_LIMIT = 5;

/** Phần của ListingRow mà Nhịp đập cần — ListingRow khớp cấu trúc này. */
export interface PulseAsset {
  id: string;
  title: string;
  price: number;
  auctionTime: string | null;
  claimStatus: ClaimStatus;
  assetOwnerId: string | null;
}

export interface OutcomeDueItem {
  listingId: string;
  title: string;
  startingPrice: number | null;
  auctionTime: string;
  /** YYYY-MM-DD */
  auctionDay: string;
  daysOverdue: number;
  /** Kết quả của LƯỢT TRƯỚC khi tài sản được đấu lại; null khi chưa có gì. */
  previous: ResolvedAssetOutcome | null;
  assetOwnerId: string | null;
}

export interface AwaitingPaymentItem {
  listingId: string;
  title: string;
  winningPrice: number | null;
  /** Ngày của kết quả thắng (YYYY-MM-DD). */
  auctionDay: string | null;
  paymentStatus: "pending" | "partial";
  /** Nguồn thắng; chỉ `owner_report` mới ghi được thu tiền từ cổng này. */
  source: OutcomeSourceKind | null;
  /** owner_asset_outcomes.id khi nguồn thắng là đơn vị tự khai, ngược lại null. */
  outcomeId: string | null;
  sessionCode: string | null;
  assetOwnerId: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Số ngày từ `from` tới `to` (cả hai YYYY-MM-DD). */
export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** "2026-09-24" ⇒ "24/09". */
export function formatDayMonth(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** "2026-09-24" ⇒ "24/09/2026". */
export function formatDayFull(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/**
 * Phiên đã diễn ra chưa. Có giờ ⇒ so với lúc này; chỉ có ngày ⇒ phải là ngày
 * TRƯỚC hôm nay (phiên hôm nay có thể còn đang chạy). Chuỗi rác ⇒ false.
 */
export function auctionHasPassed(raw: string | null | undefined, now: Date = new Date()): boolean {
  if (!raw) return false;
  if (DATE_ONLY.test(raw)) return raw < todayIso(now);
  const t = Date.parse(raw);
  return Number.isFinite(t) && t < now.getTime();
}

/**
 * Tài sản cần khai kết quả: phiên đã qua mà chưa nguồn nào nói kết quả, HOẶC
 * kết quả hiện có thuộc một lượt cũ hơn (tài sản được đấu lại).
 * Bỏ qua claim "Chờ xác nhận" — xác nhận tài sản trước, rồi mới khai.
 * Mới nhất lên đầu.
 */
export function selectOutcomeDue(
  assets: PulseAsset[],
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>,
  now: Date = new Date(),
): OutcomeDueItem[] {
  const today = todayIso(now);
  const items: OutcomeDueItem[] = [];

  for (const a of assets) {
    if (a.claimStatus !== "auto_claimed" && a.claimStatus !== "confirmed") continue;
    const day = isoDayOf(a.auctionTime);
    if (!a.auctionTime || !day || !auctionHasPassed(a.auctionTime, now)) continue;

    const o = outcomesByListing[a.id];
    const hasOutcome = !!o?.outcome;
    // Kết quả không ngày (tin cào) coi như phủ lượt này — giống RPC coi thiếu ngày là cùng lượt.
    const olderRound = hasOutcome && !!o?.date && dayDiff(o.date, day) > SAME_ROUND_DAYS;
    if (hasOutcome && !olderRound) continue;

    items.push({
      listingId: a.id,
      title: a.title,
      startingPrice: a.price > 0 ? a.price : null,
      auctionTime: a.auctionTime,
      auctionDay: day,
      daysOverdue: Math.max(0, dayDiff(day, today)),
      previous: olderRound && o ? o : null,
      assetOwnerId: a.assetOwnerId,
    });
  }

  return items.sort((x, y) => y.auctionDay.localeCompare(x.auctionDay) || x.title.localeCompare(y.title));
}

/**
 * Tài sản đã bán còn chờ thu tiền (chưa thu / thu một phần). Chờ lâu nhất lên đầu.
 * Lô trên sàn vẫn hiện (để biết tiền đang treo) nhưng không có outcomeId: tiền
 * của lô đó ghi ở sổ hợp đồng mua bán phía bên bán, không phải ở đây.
 */
export function selectAwaitingPayment(
  assets: PulseAsset[],
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>,
): AwaitingPaymentItem[] {
  const items: AwaitingPaymentItem[] = [];

  for (const a of assets) {
    const o = outcomesByListing[a.id];
    if (!o || o.outcome !== "sold") continue;
    if (o.paymentStatus !== "pending" && o.paymentStatus !== "partial") continue;
    const top = o.sources[0];
    const source = top?.kind ?? null;

    items.push({
      listingId: a.id,
      title: a.title,
      winningPrice: o.price,
      auctionDay: o.date,
      paymentStatus: o.paymentStatus,
      source,
      outcomeId: source === "owner_report" ? top?.refId ?? null : null,
      sessionCode: top?.sessionCode ?? null,
      assetOwnerId: a.assetOwnerId,
    });
  }

  return items.sort((x, y) => (x.auctionDay ?? "9999").localeCompare(y.auctionDay ?? "9999"));
}

export type WithAccess<T> = T & { canWrite: boolean };

/**
 * Gắn quyền ghi cho từng việc. Cán bộ bị giới hạn chi nhánh chỉ thấy việc của
 * chi nhánh mình; mọi vai trò khác thấy hết (Người xem thấy nhưng không có nút).
 */
export function applyPulseAccess<T extends { assetOwnerId: string | null }>(
  items: T[],
  canWrite: (assetOwnerId: string | null) => boolean,
  branchScoped: boolean,
): WithAccess<T>[] {
  const withAccess = items.map((i) => ({ ...i, canWrite: canWrite(i.assetOwnerId) }));
  return branchScoped ? withAccess.filter((i) => i.canWrite) : withAccess;
}

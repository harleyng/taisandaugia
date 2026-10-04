// Việc "Đẩy truyền thông" trên Tổng quan (docs/owner-marketing-plan.md §B7, Phase M6).
//
// Tài sản CHƯA BÁN của Trạm đáng được truyền thông thêm khi:
//   • đã qua ≥ 2 phiên mà không bán được (lượt đấu không thành), hoặc
//   • còn ≤ 5 ngày tới hạn đăng ký mà mới có < 3 hồ sơ tham gia đã thanh toán trên sàn.
// Đăng ký ngoài sàn không biết được ⇒ tài sản không có phiên trên sàn tính là 0 hồ sơ
// (owner_listing_registrations không trả dòng). Thuần, không React / Supabase.

import { isoDayOf } from "@/lib/ownerOutcomeReport";
import { isSoldOutcome, type ResolvedOutcomeKind } from "@/lib/ownerOutcomes";
import { dayDiff } from "@/lib/ownerPulse";
import type { ClaimStatus } from "@/types/asset-owner";

export const PUSH_FAILED_ROUNDS = 2;
export const PUSH_DEADLINE_DAYS = 5;
export const PUSH_MIN_REGISTRATIONS = 3;

/** Phần của ListingRow (useOwnerPortfolioMetrics) mà luật cần — ListingRow khớp cấu trúc này. */
export interface PushInput {
  id: string;
  title: string;
  price: number;
  claimStatus: ClaimStatus;
  resolvedOutcome: ResolvedOutcomeKind | null;
  /** Lịch sử phiên (listing_price_sessions), ngày YYYY-MM-DD. */
  priceHistory: { date: string }[];
  registrationDeadline: string | null;
  auctionTime: string | null;
  assetOwnerId: string | null;
}

export type PushReason = "failed_rounds" | "few_registrations";

export interface PushCandidate {
  listingId: string;
  title: string;
  price: number;
  assetOwnerId: string | null;
  reasons: PushReason[];
  /** Số phiên đã qua mà chưa bán. */
  failedRounds: number;
  /** Số ngày còn tới hạn đăng ký (0 = hôm nay); null khi không có hạn sắp tới. */
  deadlineInDays: number | null;
  /** Hồ sơ đã thanh toán trên sàn (0 khi không có phiên trên sàn). */
  registrations: number;
  /** Phiên kế tiếp còn ở phía trước. */
  hasUpcomingSession: boolean;
}

/**
 * Chọn và xếp tài sản cần đẩy truyền thông. Thứ tự: sắp hết hạn đăng ký (gần nhất trước) →
 * đã đấu không thành mà còn phiên sắp tới (nhiều lượt trước) → còn lại.
 */
export function pushMarketingCandidates(
  rows: PushInput[],
  registrations: ReadonlyMap<string, number>,
  today: string,
): PushCandidate[] {
  const out: PushCandidate[] = [];
  for (const r of rows) {
    if (r.claimStatus !== "confirmed" && r.claimStatus !== "auto_claimed") continue;
    if (isSoldOutcome(r.resolvedOutcome)) continue;

    const failedRounds = r.priceHistory.filter((h) => h.date.slice(0, 10) < today).length;
    const deadline = isoDayOf(r.registrationDeadline);
    const deadlineInDays = deadline && deadline >= today ? dayDiff(today, deadline) : null;
    const auctionDay = isoDayOf(r.auctionTime);
    const regs = registrations.get(r.id) ?? 0;

    const reasons: PushReason[] = [];
    if (deadlineInDays !== null && deadlineInDays <= PUSH_DEADLINE_DAYS && regs < PUSH_MIN_REGISTRATIONS) {
      reasons.push("few_registrations");
    }
    if (failedRounds >= PUSH_FAILED_ROUNDS) reasons.push("failed_rounds");
    if (reasons.length === 0) continue;

    out.push({
      listingId: r.id,
      title: r.title,
      price: r.price,
      assetOwnerId: r.assetOwnerId,
      reasons,
      failedRounds,
      deadlineInDays,
      registrations: regs,
      hasUpcomingSession: !!auctionDay && auctionDay >= today,
    });
  }

  const rank = (c: PushCandidate) =>
    c.reasons.includes("few_registrations") ? 0 : c.hasUpcomingSession ? 1 : 2;
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.deadlineInDays ?? Infinity) - (b.deadlineInDays ?? Infinity) ||
      b.failedRounds - a.failedRounds ||
      a.title.localeCompare(b.title, "vi"),
  );
}

/** Dòng mô tả của việc: tài sản đứng đầu + lý do ngắn. */
export function pushCandidateNote(c: PushCandidate): string {
  if (c.reasons.includes("few_registrations")) {
    const when = c.deadlineInDays === 0 ? "hết hạn đăng ký hôm nay" : `còn ${c.deadlineInDays} ngày đăng ký`;
    return `${c.title} — ${when}, ${c.registrations} hồ sơ`;
  }
  return `${c.title} — ${c.failedRounds} phiên không thành`;
}

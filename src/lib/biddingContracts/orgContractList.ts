// Logic thuần cho danh sách hồ sơ tham gia TOÀN TỔ CHỨC (/portal/ho-so-tham-gia —
// design "Phien Dau Gia - Cong Cong Ty": pdg-hslist.js).

import { DEPOSIT_PILL, depositFilterOptions, type DepositFilter, type ReviewFilter } from "@/lib/biddingContracts/contractDetail";
import { foldText } from "@/lib/biddingContracts/filters";
import type { ContractSessionRef, ContractWithSession } from "@/types/bidding-contract";

export interface OrgListFilters {
  /** "" = mọi phiên. */
  sessionId: string;
  deposit: DepositFilter;
  q: string;
}

type ListRow = Pick<
  ContractWithSession,
  "session_id" | "review_status" | "deposit_status" | "code" | "full_name" | "org_name" | "phone" | "paid_at"
> & { auction_sessions: Pick<ContractSessionRef, "code"> | null };

/** Lọc phụ (phiên · đặt trước · ô tìm) — số trên tab đếm theo bộ lọc này. */
export function passesOrgListFilters(r: ListRow, f: OrgListFilters): boolean {
  if (f.sessionId && r.session_id !== f.sessionId) return false;
  if (f.deposit !== "all" && r.deposit_status !== f.deposit) return false;
  const needle = foldText(f.q.trim());
  if (!needle) return true;
  return foldText([r.code, r.full_name, r.org_name ?? "", r.phone, r.auction_sessions?.code ?? ""].join(" ")).includes(needle);
}

export const matchesReviewTab = (r: Pick<ListRow, "review_status">, tab: ReviewFilter) =>
  tab === "all" || r.review_status === tab;

/** Chờ duyệt lên đầu, trong từng nhóm hồ sơ nộp mới nhất trước (design). */
export function sortOrgContracts<T extends ListRow>(rows: T[]): T[] {
  const t = (iso: string | null) => (iso ? Date.parse(iso) : 0);
  return [...rows].sort(
    (a, b) =>
      (a.review_status === "pending" ? 0 : 1) - (b.review_status === "pending" ? 0 : 1) || t(b.paid_at) - t(a.paid_at),
  );
}

/** Phiên có hồ sơ, mới nhất trước — người chỉ có quyền hồ sơ (không có quyền phiên) vẫn lọc được. */
export function sessionsOfContracts(rows: ContractWithSession[]): ContractSessionRef[] {
  const map = new Map<string, ContractSessionRef>();
  for (const r of rows) if (r.auction_sessions) map.set(r.session_id, r.auction_sessions);
  return [...map.values()].sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
}

/** Lựa chọn lọc đặt trước (không gồm "Tất cả"): 3 trạng thái của design + trạng thái sau chốt phiên nếu có. */
export const depositChoices = (rows: ContractWithSession[]): DepositFilter[] =>
  depositFilterOptions(rows)
    .map(([k]) => k)
    .filter((k) => k !== "all");

export const depositChoiceLabel = (k: DepositFilter) =>
  k === "all" ? "Mọi trạng thái đặt trước" : `Đặt trước: ${DEPOSIT_PILL[k].label}`;

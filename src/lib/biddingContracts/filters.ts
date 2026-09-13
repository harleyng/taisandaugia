// Lọc / tính toán thuần cho màn quản lý hồ sơ tham gia ở /portal.

import type { DepositStatus } from "@/types/bidding-contract";

export interface OrgContractFilters {
  sessionId: string;
  deposit: DepositStatus | "all";
  q: string;
}

export const ALL_SESSIONS = "all";
export const EMPTY_CONTRACT_FILTERS: OrgContractFilters = { sessionId: ALL_SESSIONS, deposit: "all", q: "" };

/** Bỏ dấu + chữ thường để "nguyen van" tìm được "Nguyễn Văn". */
export const foldText = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

interface FilterableRow {
  session_id: string;
  deposit_status: DepositStatus;
  code: string;
  full_name: string;
  phone: string;
  id_number: string;
  bidder_no: number | null;
}

export function filterOrgContracts<T extends FilterableRow>(rows: T[], f: OrgContractFilters): T[] {
  const q = foldText(f.q.trim());
  return rows.filter((r) => {
    if (f.sessionId !== ALL_SESSIONS && r.session_id !== f.sessionId) return false;
    if (f.deposit !== "all" && r.deposit_status !== f.deposit) return false;
    if (!q) return true;
    const haystack = foldText([r.code, r.full_name, r.phone, r.id_number, r.bidder_no ?? ""].join(" "));
    return haystack.includes(q);
  });
}

/** Số báo danh gợi ý tiếp theo trong MỘT phiên (server tự cấp cũng theo max+1). */
export function nextBidderNo(rows: { bidder_no: number | null }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.bidder_no ?? 0), 0) + 1;
}

/** Tổng tiền đặt trước các lô — gợi ý khi xác nhận đã nhận. null nếu phiên không khai. */
export function expectedDeposit(lots: { deposit_amount: number | null }[]): number | null {
  const priced = lots.filter((l) => l.deposit_amount != null);
  return priced.length ? priced.reduce((sum, l) => sum + (l.deposit_amount ?? 0), 0) : null;
}

/** "079••••••1234" — chỉ lộ 3 số đầu và 4 số cuối. */
export function maskIdNumber(id: string): string {
  if (id.length <= 7) return `${id.slice(0, 2)}${"•".repeat(Math.max(0, id.length - 2))}`;
  return `${id.slice(0, 3)}${"•".repeat(id.length - 7)}${id.slice(-4)}`;
}

// ─── Danh sách người đủ điều kiện trả giá (màn điều hành) ───────────────────

export interface RosterRow {
  contractId: string;
  bidderNo: number | null;
  fullName: string;
  depositStatus: DepositStatus;
  /** Đủ điều kiện trả giá theo đúng chốt của place_bid. */
  eligible: boolean;
  /** Số lô người này đang dẫn đầu. */
  leadingLots: number;
}

interface RosterContract {
  id: string;
  session_id: string;
  full_name: string;
  bidder_no: number | null;
  deposit_status: DepositStatus;
}

interface RosterLotState {
  leading_bidder_no: number | null;
  status: string;
}

/**
 * Hồ sơ của MỘT phiên → dòng cho BidderRoster.
 *
 * `eligible` chép đúng chốt not_eligible của place_bid: đã nộp tiền đặt trước
 * VÀ đã có số báo danh. Hồ sơ bị tịch thu tiền đặt trước (đã rút giá) vẫn được
 * liệt kê — người điều hành cần thấy họ — nhưng không còn đủ điều kiện.
 *
 * `leadingLots` chỉ đếm lô CHƯA kết thúc: dẫn đầu một lô đã đóng không còn là
 * "đang dẫn đầu", đó là đã trúng.
 */
export function bidderRosterRows(
  contracts: RosterContract[],
  states: RosterLotState[],
  sessionId: string,
): RosterRow[] {
  const leadingByNo = new Map<number, number>();
  for (const s of states) {
    if (s.leading_bidder_no == null) continue;
    if (s.status !== "open" && s.status !== "paused") continue;
    leadingByNo.set(s.leading_bidder_no, (leadingByNo.get(s.leading_bidder_no) ?? 0) + 1);
  }

  return contracts
    .filter((c) => c.session_id === sessionId)
    .map((c) => ({
      contractId: c.id,
      bidderNo: c.bidder_no,
      fullName: c.full_name,
      depositStatus: c.deposit_status,
      eligible: c.deposit_status === "received" && c.bidder_no != null,
      leadingLots: c.bidder_no != null ? (leadingByNo.get(c.bidder_no) ?? 0) : 0,
    }))
    // Chưa cấp số báo danh thì xuống cuối, còn lại theo số báo danh tăng dần.
    .sort((a, b) => (a.bidderNo ?? Number.MAX_SAFE_INTEGER) - (b.bidderNo ?? Number.MAX_SAFE_INTEGER));
}

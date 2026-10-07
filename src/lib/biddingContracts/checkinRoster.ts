// Danh sách điểm danh của một phiên (màn /portal/phien-dau-gia/:id/diem-danh):
// chia hồ sơ đã thanh toán thành 4 nhóm theo attendanceStateOf — cùng một nguồn
// với thẻ trạng thái bên người mua, để hai phía không bao giờ đọc lệch nhau.

import type { CheckinBlockReason, CheckinLookupMatch, ContractWithSession } from "@/types/bidding-contract";
import { attendanceStateOf, type AttendanceContract, type AttendanceSession, type AttendanceState } from "./eligibility";

export type RosterGroup = "checked_in" | "awaiting" | "absent" | "ineligible";

export const ROSTER_GROUPS: RosterGroup[] = ["checked_in", "awaiting", "absent", "ineligible"];

export const ROSTER_GROUP_LABELS: Record<RosterGroup, string> = {
  checked_in: "Đã điểm danh",
  awaiting: "Chờ điểm danh",
  absent: "Vắng mặt",
  ineligible: "Chưa đủ điều kiện",
};

export function rosterGroupOf(state: AttendanceState | null): RosterGroup {
  switch (state) {
    case "checked_in":
      return "checked_in";
    case "ticket_ready":
    case "checkin_open":
      return "awaiting";
    case "absent":
    case "excused":
      return "absent";
    default:
      return "ineligible";
  }
}

export interface RosterContract extends AttendanceContract {
  id: string;
  full_name: string;
  bidder_no: number | null;
}

export interface RosterEntry<C extends RosterContract> {
  contract: C;
  state: AttendanceState | null;
  group: RosterGroup;
}

/**
 * Gắn trạng thái + nhóm cho từng hồ sơ rồi xếp: đã điểm danh theo số báo danh,
 * còn lại theo tên (vi). Nhóm giữ thứ tự ROSTER_GROUPS.
 */
export function buildRoster<C extends RosterContract>(
  contracts: readonly C[],
  session: AttendanceSession,
  now: Date = new Date(),
): RosterEntry<C>[] {
  const entries = contracts.map((contract) => {
    const state = attendanceStateOf(contract, session, now);
    return { contract, state, group: rosterGroupOf(state) };
  });
  const rank = (g: RosterGroup) => ROSTER_GROUPS.indexOf(g);
  return entries.sort((a, b) => {
    if (a.group !== b.group) return rank(a.group) - rank(b.group);
    if (a.group === "checked_in") return (a.contract.bidder_no ?? 0) - (b.contract.bidder_no ?? 0);
    return a.contract.full_name.localeCompare(b.contract.full_name, "vi");
  });
}

export function countRosterGroups(entries: readonly { group: RosterGroup }[]): Record<RosterGroup, number> {
  const counts: Record<RosterGroup, number> = { checked_in: 0, awaiting: 0, absent: 0, ineligible: 0 };
  for (const e of entries) counts[e.group] += 1;
  return counts;
}

/**
 * Trạng thái dự phiên ⇒ mã chặn tương đương của _checkin_block_reason, để một dòng
 * trong danh sách mở được CÙNG hộp đối chiếu với kết quả tra cứu. Chỉ để hiện —
 * org_check_in vẫn tự xét lại ở server.
 */
export function blockReasonOfState(state: AttendanceState | null): CheckinBlockReason | null {
  switch (state) {
    case "checkin_open":
      return null;
    case "checked_in":
      return "already_checked_in";
    case "absent":
    case "excused":
      return "absent";
    case "awaiting_review":
      return "review_pending";
    case "needs_info":
      return "review_needs_info";
    case "rejected":
      return "review_rejected";
    case "awaiting_deposit":
      return "deposit_not_received";
    case "ticket_ready":
      return "window_not_open";
    default:
      return "roster_closed";
  }
}

/** Dòng danh sách ⇒ đúng hình dạng một kết quả org_checkin_lookup. */
export function contractToLookupMatch(c: ContractWithSession, state: AttendanceState | null): CheckinLookupMatch {
  return {
    id: c.id,
    code: c.code,
    session_id: c.session_id,
    buyer_kind: c.buyer_kind,
    org_name: c.org_name,
    org_tax_code: c.org_tax_code,
    full_name: c.full_name,
    id_type: c.id_type,
    id_number: c.id_number,
    date_of_birth: c.date_of_birth,
    phone: c.phone,
    id_front_path: c.id_front_path,
    id_back_path: c.id_back_path,
    id_edited_fields: c.id_edited_fields ?? [],
    has_proxy: c.has_proxy,
    proxy_full_name: c.proxy_full_name,
    proxy_id_type: c.proxy_id_type,
    proxy_id_number: c.proxy_id_number,
    proxy_date_of_birth: c.proxy_date_of_birth,
    proxy_id_front_path: c.proxy_id_front_path,
    proxy_id_back_path: c.proxy_id_back_path,
    proxy_id_edited_fields: c.proxy_id_edited_fields ?? [],
    poa_doc_path: c.poa_doc_path,
    review_status: c.review_status,
    deposit_status: c.deposit_status,
    bidder_no: c.bidder_no,
    checked_in_at: c.checked_in_at,
    checkin_channel: c.checkin_channel,
    checkin_attendee: c.checkin_attendee,
    absent_at: c.absent_at,
    absence_excused_at: c.absence_excused_at,
    block_reason: blockReasonOfState(state),
  };
}

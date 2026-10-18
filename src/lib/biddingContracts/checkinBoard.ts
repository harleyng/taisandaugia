// Tab "Điểm danh" của chi tiết phiên (design "Phien Dau Gia - Cong Cong Ty",
// pdg-tabs.js `checkinTab`): cửa sổ điểm danh 4 trạng thái + nhóm từng người.
//
// Chỉ ánh xạ hiển thị — trạng thái dự phiên vẫn lấy từ attendanceStateOf (bản sao
// _checkin_block_reason), server vẫn là cổng thật.

import type { AttendanceState } from "./eligibility";
import type { AuctionFormat } from "@/types/asset-posting";
import { checkinChannelOf, checkinWindowOf, checkinWindowPhase, type CheckinWindowSession } from "./checkinWindow";

/**
 * before / open / closed theo giờ máy chủ; cancelled = phiên đã huỷ; unsupported =
 * hình thức "Cả hai" (tạm bỏ) — server không điểm danh, tab chỉ còn để xem danh sách.
 */
export type BoardWindow = "before" | "open" | "closed" | "cancelled" | "unsupported";

export interface BoardWindowSession extends CheckinWindowSession {
  status: string;
  auction_format?: AuctionFormat | null;
  roster_closed_at?: string | null;
}

/** Danh sách đã chốt (cron / chốt sớm) thì coi như đóng dù chưa hết giờ. */
export function boardWindowOf(session: BoardWindowSession, now: Date = new Date()): BoardWindow {
  if (session.status === "cancelled") return "cancelled";
  if (!checkinChannelOf(session.auction_format)) return "unsupported";
  if (session.roster_closed_at) return "closed";
  return checkinWindowPhase(session, now);
}

/** Nhóm của design + "pending_deposit" (đã duyệt nhưng chưa ghi nhận đặt trước — design không có). */
export type BoardGroup = "in" | "wait" | "abs" | "exc" | "pending_deposit";

export const BOARD_GROUPS: BoardGroup[] = ["in", "wait", "abs", "exc", "pending_deposit"];

export const BOARD_GROUP_LABELS: Record<BoardGroup, string> = {
  in: "Có mặt",
  wait: "Chờ điểm danh",
  abs: "Vắng",
  exc: "Vắng có lý do",
  pending_deposit: "Chưa nộp đặt trước",
};

/** Chỉ hồ sơ đã DUYỆT mới vào danh sách điểm danh (chờ duyệt / từ chối ở tab Hồ sơ). */
export function boardGroupOf(state: AttendanceState | null): BoardGroup {
  switch (state) {
    case "checked_in":
      return "in";
    case "absent":
      return "abs";
    case "excused":
      return "exc";
    case "awaiting_deposit":
      return "pending_deposit";
    default:
      return "wait";
  }
}

export type BoardTone = "ok" | "muted" | "live";

/** Nhãn + tông của viên trạng thái trên từng dòng. */
export function boardStatusOf(group: BoardGroup, window: BoardWindow): { label: string; tone: BoardTone } {
  switch (group) {
    case "in":
      return { label: "Có mặt", tone: "ok" };
    case "abs":
      return { label: "Vắng", tone: "live" };
    case "exc":
      return { label: "Vắng có lý do", tone: "muted" };
    case "pending_deposit":
      return { label: "Chưa nộp đặt trước", tone: "muted" };
    case "wait":
      return {
        label: window === "open" ? "Chờ điểm danh" : window === "before" ? "Chưa mở" : "Không điểm danh",
        tone: "muted",
      };
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** "10/10/26 09:05" — cột "Điểm danh lúc" (design). */
export function formatCheckinTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${ddmm(d)}/${String(d.getFullYear()).slice(2)} ${hhmm(d)}`;
}

export interface BoardBanner {
  title: string;
  body: string;
  tone: "muted" | "live" | "ok";
}

/** Dải trạng thái cửa sổ điểm danh (design `.note.bn`). */
export function boardBannerOf(window: BoardWindow, session: BoardWindowSession): BoardBanner {
  const { opensAt, closesAt } = checkinWindowOf(session);
  switch (window) {
    case "before":
      return {
        title: "Chưa mở điểm danh",
        body: `Mở lúc ${hhmm(opensAt)} ngày ${ddmm(opensAt)}, chốt danh sách lúc ${hhmm(closesAt)}.`,
        tone: "muted",
      };
    case "open":
      return {
        title: "Đang mở điểm danh",
        body: `Chốt lúc ${hhmm(closesAt)} — ai chưa điểm danh sẽ bị ghi vắng.`,
        tone: "live",
      };
    case "closed": {
      // Mốc chốt thật (chốt sớm / cron) thay cho giờ đóng dự kiến.
      const at = session.roster_closed_at ? new Date(session.roster_closed_at) : closesAt;
      return { title: "Đã chốt danh sách", body: `Chốt lúc ${hhmm(at)} ngày ${ddmm(at)}/${at.getFullYear()}.`, tone: "ok" };
    }
    case "cancelled":
      return { title: "Phiên đã huỷ", body: "Không điểm danh.", tone: "muted" };
    case "unsupported":
      return {
        title: "Chưa hỗ trợ điểm danh",
        body: "Phiên theo hình thức “Cả hai” không điểm danh trên hệ thống — đổi hình thức phiên sang trực tiếp hoặc trực tuyến để điểm danh.",
        tone: "muted",
      };
  }
}

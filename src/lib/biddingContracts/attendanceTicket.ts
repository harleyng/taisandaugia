// Phiếu dự phiên + mảnh chữ dùng chung của luồng điểm danh phía người mua
// (design 979d4c55 "San - Ho So Tham Gia", san-checkin.js). Thuần — test được.

import { formatShortDate, formatShortDateTime } from "@/lib/auctionSessions/listBadge";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { checkinWindowOf, type CheckinWindowSession } from "./checkinWindow";
import type { CheckinAttendee } from "@/types/bidding-contract";

const pad = (n: number) => String(n).padStart(2, "0");

/** "08:30". */
export function formatClock(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? "—" : `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** "0912 ••• 678" — số nhận mã, che phần giữa (phiếu hay bị chụp màn hình gửi đi). */
export function maskPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 7) return phone?.trim() || "—";
  return `${d.slice(0, 4)} ••• ${d.slice(-3)}`;
}

/** Giờ điểm danh "08:30 – 09:15 · 22/10/26"; khác ngày ⇒ ghi đủ hai đầu. */
export function checkinWindowLabel(s: CheckinWindowSession): string {
  const { opensAt, closesAt } = checkinWindowOf(s);
  const a = opensAt.toISOString();
  const b = closesAt.toISOString();
  return formatShortDate(a) === formatShortDate(b)
    ? `${formatClock(opensAt)} – ${formatClock(closesAt)} · ${formatShortDate(a)}`
    : `${formatShortDateTime(a)} – ${formatShortDateTime(b)}`;
}

/** "Tài sản 1, 2"; null = không biết lô (không hiện dòng). */
export function lotsLabel(lotNos: number[] | null | undefined): string | null {
  if (!lotNos || lotNos.length === 0) return null;
  return `Tài sản ${[...lotNos].sort((a, b) => a - b).join(", ")}`;
}

export interface TicketContract {
  code: string;
  checkin_token: string;
  full_name: string;
  org_name: string | null;
  has_proxy: boolean;
  proxy_full_name: string | null;
  checked_in_at: string | null;
  checkin_attendee: CheckinAttendee | null;
  bidder_no: number | null;
}

export interface TicketSession extends CheckinWindowSession {
  code: string | null;
  title: string;
  venue: string | null;
}

export interface TicketInfo {
  sessionCode: string | null;
  sessionTitle: string;
  contractCode: string;
  /** Nội dung mã QR = checkin_token (nhân viên quét tại bàn điểm danh). */
  token: string;
  attendee: string;
  /** Người mua là tổ chức ⇒ tên tổ chức. */
  registrant: string | null;
  lots: string | null;
  window: string;
  venue: string | null;
  /** Chỉ có sau khi điểm danh. */
  bidderNo: string | null;
}

/**
 * Người dự phiên: đã điểm danh ⇒ đúng người đã điểm danh; chưa ⇒ có uỷ quyền thì
 * người được uỷ quyền (mặc định của server), không thì người đăng ký.
 */
export function attendeeNameOf(c: TicketContract): string {
  const proxy = c.checked_in_at ? c.checkin_attendee === "proxy" : c.has_proxy;
  return proxy && c.proxy_full_name ? `${c.proxy_full_name} (được uỷ quyền)` : c.full_name;
}

export function ticketInfoOf(c: TicketContract, s: TicketSession, lotNos?: number[] | null): TicketInfo {
  return {
    sessionCode: s.code,
    sessionTitle: s.title,
    contractCode: c.code,
    token: c.checkin_token,
    attendee: attendeeNameOf(c),
    registrant: c.org_name,
    lots: lotsLabel(lotNos),
    window: checkinWindowLabel(s),
    venue: s.venue,
    bidderNo: c.checked_in_at ? formatBidderNo(c.bidder_no) : null,
  };
}

export const ticketFileName = (code: string) => `phieu-du-phien-${code}.pdf`;

/** Ba điều cần mang / cần nhớ khi dự phiên trực tiếp. */
export function ticketChecklist(closesAt: Date): string[] {
  return [
    "Mang CCCD bản gốc của người dự phiên.",
    "Nếu dự thay, mang giấy uỷ quyền bản gốc đã công chứng.",
    `Quá ${formatClock(closesAt)} chưa điểm danh sẽ bị ghi vắng và mất tiền đặt trước.`,
  ];
}

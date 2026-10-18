// Hồ sơ tham gia nhìn từ phía NGƯỜI MUA (/ho-so-cua-toi, design "San - Ho So
// Tham Gia" 979d4c55): nhóm tab, trạng thái đặt trước (thêm "Chờ đối soát" khi
// người mua đã báo nộp), thanh tiến độ 5 chặng, nhãn trạng thái, việc cần làm
// tiếp và dòng ghi chú. Thuần — mọi hàm nhận `now` để test được.

import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatShortDate, formatShortDateTime } from "@/lib/auctionSessions/listBadge";
import { formatClock } from "@/lib/biddingContracts/attendanceTicket";
import { checkinChannelOf, checkinWindowOf, checkinWindowPhase } from "@/lib/biddingContracts/checkinWindow";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { DepositStatus } from "@/types/bidding-contract";

/** Đủ cột để suy trạng thái — BiddingContract/ContractWithSession đều thoả. */
export interface BuyerContractLike {
  status: "pending_payment" | "paid" | "cancelled" | "refunded";
  review_status: "pending" | "needs_info" | "approved" | "rejected";
  deposit_status: DepositStatus;
  deposit_reported_at: string | null;
  hold_expires_at: string | null;
  checked_in_at: string | null;
  absent_at: string | null;
  /** Tuỳ chọn để test cũ vẫn dựng được; thiếu = chưa có. */
  absence_excused_at?: string | null;
  absence_appeal_at?: string | null;
  bidder_no: number | null;
  review_note: string | null;
  auction_sessions: {
    status: string;
    auction_format: string;
    starts_at: string;
    ends_at: string;
    finalized_at: string | null;
    registration_end_at?: string | null;
    checkin_lead_minutes?: number | null;
    checkin_grace_minutes?: number | null;
  } | null;
}

export type Tone = "ok" | "amber" | "muted" | "red" | "live" | "pri";
export interface Tag {
  label: string;
  tone: Tone;
}

export type BuyerGroup = "active" | "done" | "cancelled";

export const BUYER_GROUPS: { key: BuyerGroup; label: string }[] = [
  { key: "active", label: "Đang tham gia" },
  { key: "done", label: "Đã kết thúc" },
  { key: "cancelled", label: "Đã huỷ" },
];

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

const sessionOver = (c: BuyerContractLike, now: Date) => {
  const s = c.auction_sessions;
  return !!s && (!!s.finalized_at || ms(s.ends_at) < now.getTime());
};

/**
 * Tab của hồ sơ; `null` = không hiện: hồ sơ tự huỷ / hết giờ giữ suất mà phiên đã
 * bắt đầu (không còn mua lại được) — chúng chưa từng là hồ sơ tham gia.
 */
export function buyerGroupOf(c: BuyerContractLike, now: Date = new Date()): BuyerGroup | null {
  const s = c.auction_sessions;
  if (c.status === "cancelled") return null;
  if (c.status === "pending_payment" && s && ms(s.starts_at) <= now.getTime()) return null;
  if (s?.status === "cancelled" || c.status === "refunded") return "cancelled";
  if (sessionOver(c, now) || c.deposit_status === "forfeited") return "done";
  return "active";
}

// ─── Tiền đặt trước ──────────────────────────────────────────────────────────

/** DepositStatus + "sent" = vẫn 'pending' nhưng người mua đã báo nộp. */
export type BuyerDepositState = DepositStatus | "sent";

export function buyerDepositStateOf(c: Pick<BuyerContractLike, "deposit_status" | "deposit_reported_at">): BuyerDepositState {
  return c.deposit_status === "pending" && c.deposit_reported_at ? "sent" : c.deposit_status;
}

export const BUYER_DEPOSIT_TAGS: Record<BuyerDepositState, Tag> = {
  pending: { label: "Chưa nộp", tone: "amber" },
  sent: { label: "Chờ đối soát", tone: "pri" },
  received: { label: "Đã nhận", tone: "ok" },
  applied: { label: "Đã trừ vào tiền mua", tone: "ok" },
  pending_refund: { label: "Chờ hoàn trả", tone: "muted" },
  refunded: { label: "Đã hoàn", tone: "muted" },
  forfeited: { label: "Bị tịch thu", tone: "red" },
};

export const REVIEW_TAGS: Record<BuyerContractLike["review_status"], Tag> = {
  pending: { label: "Chờ duyệt", tone: "muted" },
  needs_info: { label: "Cần bổ sung", tone: "amber" },
  approved: { label: "Đã duyệt", tone: "ok" },
  rejected: { label: "Bị từ chối", tone: "red" },
};

// ─── Tiến độ ─────────────────────────────────────────────────────────────────

export const PROGRESS_STEPS = ["Mua hồ sơ", "Duyệt & đặt trước", "Điểm danh", "Trả giá", "Kết quả"] as const;

/** Chặng hiện tại 0–4; 5 = đã xong cả 5 chặng (phiên kết thúc). */
export function progressStepOf(c: BuyerContractLike, now: Date = new Date()): number {
  if (c.status === "pending_payment") return 0;
  if (sessionOver(c, now)) return 5;
  // Vắng: dừng ở chặng Điểm danh (design hs-mine.js).
  if (c.absent_at) return 2;
  if (c.checked_in_at) return 3;
  if (c.review_status === "approved" && c.deposit_status === "received") return 2;
  return 1;
}

/** Phiên trực tuyến đang chạy và người mua đã điểm danh ⇒ vào phòng trả giá được. */
/** Đã duyệt + đã nhận đặt trước + chưa điểm danh / chưa vắng ⇒ đang ở chặng điểm danh. */
const awaitingCheckin = (c: BuyerContractLike) =>
  c.status === "paid" &&
  c.review_status === "approved" &&
  c.deposit_status === "received" &&
  !c.checked_in_at &&
  !c.absent_at;

/** Cửa sổ điểm danh đang mở cho hồ sơ này (trực tuyến hoặc trực tiếp). */
export function checkinOpenFor(c: BuyerContractLike, now: Date = new Date()): boolean {
  const s = c.auction_sessions;
  if (!s || s.status !== "published" || !awaitingCheckin(c)) return false;
  if (!checkinChannelOf(s.auction_format as Parameters<typeof checkinChannelOf>[0])) return false;
  return checkinWindowPhase(s, now) === "open";
}

export function isLiveFor(c: BuyerContractLike, now: Date = new Date()): boolean {
  const s = c.auction_sessions;
  if (!s || !c.checked_in_at || s.finalized_at || s.auction_format !== "truc_tuyen") return false;
  const t = now.getTime();
  return ms(s.starts_at) <= t && t <= ms(s.ends_at);
}

export interface BuyerContext {
  now?: Date;
  /** Số lô hồ sơ này đã trúng (useMyWonLots). */
  wonCount?: number;
}

/** Nhãn trạng thái chính của hồ sơ (dòng danh sách + đầu trang chi tiết). */
export function headlineOf(c: BuyerContractLike, { now = new Date(), wonCount = 0 }: BuyerContext = {}): Tag {
  const s = c.auction_sessions;
  if (s?.status === "cancelled") return { label: "Phiên đã huỷ", tone: "red" };
  if (c.status === "refunded" || c.review_status === "rejected") return { label: "Hồ sơ bị từ chối", tone: "red" };
  if (c.status === "pending_payment") return { label: "Chờ thanh toán phí hồ sơ", tone: "amber" };
  if (c.absent_at && c.absence_excused_at) return { label: "Vắng mặt có lý do", tone: "muted" };
  if (c.absent_at || c.deposit_status === "forfeited") return { label: "Vắng — không điểm danh", tone: "red" };
  if (sessionOver(c, now)) {
    if (wonCount > 0) return { label: wonCount === 1 ? "Trúng 1 tài sản" : `Trúng ${wonCount} tài sản`, tone: "ok" };
    return { label: s?.finalized_at ? "Không trúng" : "Phiên đã kết thúc", tone: "muted" };
  }
  if (isLiveFor(c, now)) return { label: "Đang diễn ra", tone: "live" };
  if (c.review_status === "needs_info") return { label: "Cần bổ sung giấy tờ", tone: "amber" };
  if (c.checked_in_at) return { label: "Đã điểm danh", tone: "ok" };
  if (checkinOpenFor(c, now)) return { label: "Đang mở điểm danh", tone: "live" };
  const dep = buyerDepositStateOf(c);
  if (dep === "pending") return { label: "Chờ nộp đặt trước", tone: "amber" };
  if (dep === "sent") return { label: "Chờ đối soát đặt trước", tone: "pri" };
  if (c.review_status === "pending") return { label: "Chờ tổ chức duyệt", tone: "muted" };
  return { label: "Đủ điều kiện · chờ điểm danh", tone: "ok" };
}

/** Nhãn đầu trang chi tiết: kết quả / chờ thanh toán / trạng thái duyệt. */
export function detailBadgeOf(c: BuyerContractLike, ctx: BuyerContext = {}): Tag {
  const now = ctx.now ?? new Date();
  if (c.auction_sessions?.status === "cancelled" || sessionOver(c, now) || c.absent_at) return headlineOf(c, ctx);
  if (c.status === "pending_payment") return { label: "Chờ thanh toán", tone: "amber" };
  if (c.status === "refunded") return REVIEW_TAGS.rejected;
  return REVIEW_TAGS[c.review_status];
}

// ─── Việc tiếp theo ──────────────────────────────────────────────────────────

export type BuyerActionKind = "pay" | "resubmit" | "deposit" | "room" | "result" | "detail" | "checkin" | "ticket";
export interface BuyerAction {
  kind: BuyerActionKind;
  label: string;
  primary: boolean;
}

export function actionOf(c: BuyerContractLike, { now = new Date(), wonCount = 0 }: BuyerContext = {}): BuyerAction {
  const detail: BuyerAction = { kind: "detail", label: "Xem hồ sơ", primary: false };
  const group = buyerGroupOf(c, now);
  if (group === "cancelled" || group === null) return detail;
  if (c.status === "pending_payment") return { kind: "pay", label: "Tiếp tục thanh toán", primary: true };
  if (group === "done") return wonCount > 0 ? { kind: "result", label: "Xem kết quả", primary: true } : detail;
  if (isLiveFor(c, now)) return { kind: "room", label: "Vào phòng đấu giá", primary: true };
  if (c.review_status === "needs_info") return { kind: "resubmit", label: "Bổ sung giấy tờ", primary: true };
  const dep = buyerDepositStateOf(c);
  if (dep === "pending") return { kind: "deposit", label: "Nộp tiền đặt trước", primary: true };
  if (dep === "sent") return { kind: "deposit", label: "Xem hướng dẫn", primary: false };

  // Chặng điểm danh: trực tuyến tự điểm danh bằng mã; trực tiếp mở phiếu QR.
  const s = c.auction_sessions;
  if (!s) return detail;
  const onsite = s.auction_format === "truc_tiep";
  if (c.checked_in_at) {
    return s.auction_format === "truc_tuyen"
      ? { kind: "room", label: `Vào phòng · mở ${formatClock(s.starts_at)}`, primary: false }
      : detail;
  }
  if (checkinOpenFor(c, now)) {
    return onsite
      ? { kind: "ticket", label: "Mở phiếu dự phiên", primary: true }
      : { kind: "checkin", label: "Điểm danh ngay", primary: true };
  }
  if (onsite && awaitingCheckin(c) && checkinWindowPhase(s, now) === "before") {
    return { kind: "ticket", label: "Xem phiếu dự phiên", primary: false };
  }
  return detail;
}

const DAY = 86_400_000;

/** Dòng ghi chú cạnh nhãn; `warn` ⇒ tô màu cảnh báo. */
export function noteOf(c: BuyerContractLike, { now = new Date() }: BuyerContext = {}): { text: string; warn: boolean } | null {
  const s = c.auction_sessions;
  const group = buyerGroupOf(c, now);
  if (!s || group === null) return null;
  if (group === "cancelled") {
    return c.status === "refunded" ? { text: "Phí hồ sơ được hoàn lại", warn: false } : null;
  }
  if (c.status === "pending_payment") {
    const hold = ms(c.hold_expires_at);
    return hold > now.getTime()
      ? { text: `Giữ suất đến ${formatDateTime(c.hold_expires_at)}`, warn: true }
      : { text: "Hết giờ giữ suất — thanh toán để giữ suất mới", warn: true };
  }
  if (group === "done") {
    if (c.absent_at && c.deposit_status === "forfeited") {
      return c.absence_appeal_at
        ? { text: "Đã gửi lý do vắng · chờ tổ chức xem xét", warn: false }
        : { text: "Tiền đặt trước bị tịch thu", warn: false };
    }
    if (c.deposit_status === "refunded") return { text: "Đã hoàn tiền đặt trước", warn: false };
    if (c.deposit_status === "pending_refund") return { text: "Tiền đặt trước đang được hoàn trả", warn: false };
    return null;
  }
  if (c.review_status === "needs_info") {
    return { text: c.review_note?.trim() || "Tổ chức yêu cầu bổ sung giấy tờ", warn: true };
  }
  if (c.checked_in_at) {
    const no = formatBidderNo(c.bidder_no);
    return no ? { text: `Số báo danh ${no}`, warn: false } : null;
  }
  const dep = buyerDepositStateOf(c);
  if (dep === "pending") {
    const end = ms(s.registration_end_at);
    if (Number.isNaN(end)) return { text: "Nộp theo hướng dẫn của tổ chức", warn: true };
    const days = Math.ceil((end - now.getTime()) / DAY);
    const left = end < now.getTime() ? "đã quá hạn" : days <= 1 ? "còn dưới 1 ngày" : `còn ${days} ngày`;
    return { text: `Hạn ${formatDateTime(s.registration_end_at)} · ${left}`, warn: true };
  }
  if (dep === "sent") return { text: "Đã báo nộp · chờ tổ chức đối soát", warn: false };
  const w = checkinWindowOf(s);
  if (checkinOpenFor(c, now)) return { text: `Đóng điểm danh lúc ${formatClock(w.closesAt)}`, warn: true };
  const open = w.opensAt.toISOString();
  const close = w.closesAt.toISOString();
  const end = formatShortDate(open) === formatShortDate(close) ? formatClock(w.closesAt) : formatShortDateTime(close);
  return { text: `Điểm danh ${formatShortDateTime(open)} – ${end}`, warn: false };
}

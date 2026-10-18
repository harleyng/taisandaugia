// Lịch sử một hồ sơ phía người mua (thẻ "Lịch sử hồ sơ" ở /ho-so-cua-toi/:code):
// gộp mốc trên chính hồ sơ (tạo, thanh toán, báo nộp, nhận tiền, điểm danh…) với
// nhật ký duyệt (auction_contract_review_events). Thuần, sắp theo thời gian.

import { formatVnd } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { DepositStatus, ReviewEventKind } from "@/types/bidding-contract";

export type HistoryTone = "done" | "current" | "warn";
export interface HistoryItem {
  at: string;
  text: string;
  tone: HistoryTone;
}

export interface HistoryContract {
  created_at: string;
  paid_at: string | null;
  fee_amount: number;
  payment_txn_ref: string | null;
  status: string;
  deposit_status: DepositStatus;
  deposit_reported_at: string | null;
  deposit_received_at: string | null;
  deposit_amount_received: number | null;
  deposit_status_changed_at: string | null;
  checked_in_at: string | null;
  checkin_channel?: string | null;
  bidder_no: number | null;
  absent_at: string | null;
  absence_appeal_at?: string | null;
  absence_excused_at?: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
}

const REVIEW_TEXT: Record<ReviewEventKind, (note: string | null) => [string, HistoryTone]> = {
  submitted: () => ["Gửi hồ sơ cho tổ chức duyệt", "done"],
  needs_info: (n) => [`Tổ chức yêu cầu bổ sung${n ? `: ${n}` : ""}`, "warn"],
  resubmitted: () => ["Bạn nộp lại hồ sơ đã bổ sung", "done"],
  approved: () => ["Tổ chức duyệt hồ sơ", "done"],
  rejected: (n) => [`Tổ chức từ chối hồ sơ${n ? `: ${n}` : ""}`, "warn"],
};

export function buyerHistoryOf(
  c: HistoryContract,
  events: { at: string; kind: string; note: string | null }[],
): HistoryItem[] {
  const out: HistoryItem[] = [{ at: c.created_at, text: "Tạo hồ sơ", tone: "done" }];
  if (c.paid_at) {
    out.push({
      at: c.paid_at,
      text: `Thanh toán phí hồ sơ ${formatVnd(c.fee_amount)} qua VNPay${c.payment_txn_ref ? ` · mã GD ${c.payment_txn_ref}` : ""}`,
      tone: "done",
    });
  } else if (c.status === "pending_payment") {
    out.push({ at: c.created_at, text: "Chờ thanh toán phí hồ sơ", tone: "current" });
  }
  for (const e of events) {
    // "submitted" trùng mốc thanh toán — không lặp lại.
    if (e.kind === "submitted") continue;
    const f = REVIEW_TEXT[e.kind as ReviewEventKind];
    if (!f) continue;
    const [text, tone] = f(e.note);
    out.push({ at: e.at, text, tone });
  }
  if (c.deposit_reported_at) {
    out.push({
      at: c.deposit_reported_at,
      text: "Bạn báo đã nộp tiền đặt trước",
      tone: c.deposit_status === "pending" ? "current" : "done",
    });
  }
  if (c.deposit_received_at) {
    const amt = c.deposit_amount_received ? ` ${formatVnd(c.deposit_amount_received)}` : "";
    out.push({ at: c.deposit_received_at, text: `Tổ chức xác nhận đã nhận tiền đặt trước${amt}`, tone: "done" });
  }
  if (c.checked_in_at) {
    const no = formatBidderNo(c.bidder_no);
    const where = c.checkin_channel === "onsite" ? " tại cửa" : c.checkin_channel === "online" ? " trực tuyến" : "";
    out.push({ at: c.checked_in_at, text: `Điểm danh${where}${no ? ` · số báo danh ${no}` : ""}`, tone: "done" });
  }
  if (c.absent_at) {
    const forfeit = c.absence_excused_at ? "" : " · tiền đặt trước bị tịch thu";
    out.push({ at: c.absent_at, text: `Vắng — không điểm danh${forfeit}`, tone: "warn" });
  }
  if (c.absence_appeal_at) {
    out.push({
      at: c.absence_appeal_at,
      text: "Bạn gửi lý do vắng mặt",
      tone: c.absence_excused_at ? "done" : "current",
    });
  }
  if (c.absence_excused_at) {
    out.push({ at: c.absence_excused_at, text: "Tổ chức chấp nhận lý do vắng mặt", tone: "done" });
  }
  if (c.deposit_status === "refunded" && c.deposit_status_changed_at) {
    out.push({ at: c.deposit_status_changed_at, text: "Hoàn tiền đặt trước", tone: "done" });
  }
  if (c.deposit_status === "applied" && c.deposit_status_changed_at) {
    out.push({ at: c.deposit_status_changed_at, text: "Tiền đặt trước được trừ vào tiền mua tài sản", tone: "done" });
  }
  if (c.status === "refunded" && c.refunded_at) {
    out.push({ at: c.refunded_at, text: "Hoàn phí hồ sơ", tone: "done" });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** "02 ngày · 01 giờ · 17 phút" tới mốc `target` (0 khi đã qua). */
export function countdownParts(target: string | Date, now: Date = new Date()): { value: string; unit: string }[] {
  const left = Math.max(0, (typeof target === "string" ? Date.parse(target) : target.getTime()) - now.getTime());
  const m = Math.floor(left / 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return [
    { value: p(Math.floor(m / 1440)), unit: "ngày" },
    { value: p(Math.floor((m % 1440) / 60)), unit: "giờ" },
    { value: p(m % 60), unit: "phút" },
  ];
}

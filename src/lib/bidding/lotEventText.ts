// Nhật ký điều hành (auction_lot_events) → câu tiếng Việt cho màn điều hành.
//
// payload là JSONB tự do, mỗi `kind` một hình dạng khác nhau — hình dạng chuẩn
// nằm ở các lời gọi _lot_event trong 20260913000001 (dòng 650, 799, 825, 828,
// 896, 952, 993, 1033, 1082, 1218, 1271, 1323) và 20260913000003. Đọc sai khoá
// thì chỉ mất phần chi tiết, KHÔNG được ném lỗi: nhật ký là thứ người ta mở ra
// đúng lúc phiên đang có sự cố.
//
// `actor_id` là UUID trần, KHÔNG có khoá ngoại sang auth.users (cố ý: ON DELETE
// SET NULL là một UPDATE và sẽ bị chặn bởi trigger chỉ-ghi-thêm). Nên tên người
// thực hiện phải tra từ nơi khác và luôn có đường lui — xem actorLabelOf.

import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { biddingReasonMessage } from "./errors";
import { LOT_EVENT_LABELS, LOT_RESULT_LABELS, type LotEvent, type LotEventKind } from "@/types/auction-bidding";

export interface LotEventText {
  label: string;
  /** Dòng mô tả; rỗng khi payload không có gì đáng nói. */
  detail: string;
  /** "Lô 2" — null với sự kiện cấp phiên (finalize / minutes). */
  lotLabel: string | null;
}

type Payload = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "2 phút 30 giây" — giây thô đọc rất khó khi vượt quá một phút. */
function humanSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  if (s < 60) return `${s} giây`;
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  if (minutes < 60) return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${hours} giờ ${m} phút` : `${hours} giờ`;
}

const sbd = (v: unknown): string | null => {
  const n = num(v);
  return n == null ? null : `số báo danh ${formatBidderNo(n)}`;
};

function detailOf(kind: LotEventKind, p: Payload): string {
  switch (kind) {
    case "open": {
      const duration = num(p.duration_seconds);
      const ends = str(p.ends_at);
      const window = duration != null ? `Mở ${humanSeconds(duration)}` : "Mở đến hết phiên";
      return ends ? `${window} · đóng lúc ${formatDateTime(ends)}` : window;
    }
    case "pause": {
      const reason = str(p.reason);
      const left = num(p.remaining_seconds);
      const rest = left != null ? `Còn lại ${humanSeconds(left)} khi dừng.` : "";
      return [reason, rest].filter(Boolean).join(" · ");
    }
    case "resume": {
      const paused = num(p.paused_seconds);
      const ends = str(p.ends_at);
      return [
        paused != null ? `Bù lại ${humanSeconds(paused)} tạm dừng` : null,
        ends ? `đóng lúc ${formatDateTime(ends)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "bid": {
      const amount = num(p.amount);
      return [amount != null ? formatVnd(amount) : null, sbd(p.bidder_no)].filter(Boolean).join(" · ");
    }
    case "bid_rejected": {
      const amount = num(p.amount);
      // Dùng đúng câu mà người trả giá đã nhìn thấy, kèm con số server đã tính.
      const why = biddingReasonMessage(str(p.reason), p);
      return [amount != null ? `Trả ${formatVnd(amount)}` : null, sbd(p.bidder_no), why]
        .filter(Boolean)
        .join(" · ");
    }
    case "extend": {
      const to = str(p.to);
      return to ? `Gia hạn đến ${formatDateTime(to)}` : "Gia hạn do có lượt trả giá sát giờ đóng";
    }
    case "withdraw_bid": {
      const amount = num(p.amount);
      const reverted = num(p.reverted_price);
      return [
        amount != null ? `Rút lượt ${formatVnd(amount)}` : null,
        sbd(p.bidder_no),
        reverted != null ? `giá về ${formatVnd(reverted)}` : "không còn lượt hợp lệ",
        p.deposit_forfeited === true ? "tiền đặt trước không được hoàn trả" : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "close": {
      const result = str(p.result);
      if (result === "sold") {
        const amount = num(p.winning_amount);
        return [
          LOT_RESULT_LABELS.sold,
          amount != null ? `giá trúng ${formatVnd(amount)}` : null,
          sbd(p.bidder_no),
        ]
          .filter(Boolean)
          .join(" · ");
      }
      if (result === "unsold") return `${LOT_RESULT_LABELS.unsold} — không có lượt trả giá hợp lệ`;
      return "";
    }
    case "withdraw_lot": {
      const reason = str(p.reason);
      // close_due_lots ghi mã thay vì câu chữ khi phiên bị huỷ.
      if (reason === "session_cancelled") return "Phiên bị huỷ nên lô được rút tự động";
      const bids = num(p.bid_count);
      return [reason, bids ? `đã có ${bids} lượt trả giá` : null].filter(Boolean).join(" · ");
    }
    case "finalize": {
      const parts = [
        num(p.sold) != null ? `${p.sold} lô đấu giá thành` : null,
        num(p.unsold) != null ? `${p.unsold} lô không thành` : null,
        num(p.withdrawn) ? `${p.withdrawn} lô đã rút` : null,
        num(p.applied) != null ? `${p.applied} hồ sơ chuyển tiền đặt trước` : null,
        num(p.pending_refund) != null ? `${p.pending_refund} hồ sơ chờ hoàn trả` : null,
      ].filter(Boolean);
      return parts.join(" · ");
    }
    case "minutes": {
      const seq = num(p.sequence_no);
      return seq != null ? `Biên bản lần ${seq}` : "Phát hành biên bản";
    }
    case "payment": {
      const amount = num(p.winning_amount);
      const paid = p.paid === true;
      return [
        paid ? "Người trúng đấu giá đã thanh toán" : "Người trúng đấu giá KHÔNG thanh toán",
        amount != null ? formatVnd(amount) : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return "";
  }
}

/**
 * `lotNoById` để hiện "Lô 2" thay vì một UUID. Sự kiện cấp phiên (finalize,
 * minutes) có lot_id = NULL và không mang tiền tố.
 */
export function describeLotEvent(event: LotEvent, lotNoById: Map<string, number>): LotEventText {
  const payload = (event.payload ?? {}) as Payload;
  const lotNo = event.lot_id ? lotNoById.get(event.lot_id) : undefined;

  let detail = "";
  try {
    detail = detailOf(event.kind, payload);
  } catch {
    // Payload lạ không được làm sập cả nhật ký.
    detail = "";
  }

  return {
    label: LOT_EVENT_LABELS[event.kind] ?? event.kind,
    detail,
    lotLabel: lotNo != null ? `Lô ${lotNo}` : null,
  };
}

// ─── Người thực hiện ────────────────────────────────────────────────────────

export const SYSTEM_ACTOR_LABEL = "Hệ thống";
const UNKNOWN_ACTOR_LABEL = "Thành viên tổ chức";

export interface ActorSources {
  /** user_id → tên (hoặc email) thành viên tổ chức. */
  members: Map<string, string>;
  /** user_id → họ tên trên hồ sơ tham gia, cho sự kiện do người mua tạo. */
  bidders: Map<string, string>;
}

/**
 * Chuỗi lui: thành viên tổ chức → người mua → "Thành viên tổ chức" → "Hệ thống".
 *
 * actor_id NULL nghĩa là pg_cron (close_due_lots) chứ không phải thiếu dữ liệu —
 * hiện "Hệ thống" mới đúng. Và không bao giờ đổ UUID trần ra màn hình: thành
 * viên quyền thấp có thể không đọc được profiles của người khác.
 */
export function actorLabelOf(actorId: string | null | undefined, sources: ActorSources): string {
  if (!actorId) return SYSTEM_ACTOR_LABEL;
  return sources.members.get(actorId) ?? sources.bidders.get(actorId) ?? UNKNOWN_ACTOR_LABEL;
}

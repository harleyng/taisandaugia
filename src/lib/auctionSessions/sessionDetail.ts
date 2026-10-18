// Trang chi tiết phiên ở /portal/phien-dau-gia/:id (design "Phien Dau Gia - Cong Cong Ty",
// pdg-detail.js + pdg-tabs.js): khoảng thời gian ở hero, dải "Lịch phiên" của tab
// Thông tin và kết quả từng lô của tab Tài sản. Thuần hàm để test được.

import { checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSession } from "@/types/auction-session";

const pad = (n: number) => String(n).padStart(2, "0");
const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
/** "22/10/2026" */
export const fmtDate = (d: Date) => `${ddmm(d)}/${d.getFullYear()}`;
/** "09:00" */
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Hero: "22/10/2026 · 09:00–11:30" cùng ngày, "22/10 → 24/10/2026" khác ngày. */
export function heroRange(startIso: string, endIso: string | null): string {
  const a = new Date(startIso);
  if (!endIso) return `${ddmm(a)} · ${fmtTime(a)}`;
  const b = new Date(endIso);
  return sameDay(a, b) ? `${fmtDate(a)} · ${fmtTime(a)}–${fmtTime(b)}` : `${ddmm(a)} → ${fmtDate(b)}`;
}

// ---- Lịch phiên ----

/** done = đã qua · cur = đang mở · live = đang đấu · "" = sắp tới · na = chưa khai báo. */
export type TimelineMark = "done" | "cur" | "live" | "" | "na";

export interface TimelinePoint {
  /** Nhãn nhỏ trên ngày ("Mở bán hồ sơ") — chỉ có ở mốc thuộc một cặp. */
  label?: string;
  date: string;
  time: string;
  mark: TimelineMark;
}

export interface TimelineStage {
  title: string;
  sub: string;
  /** Hai mốc trong một khối nền xám (khoảng nhiều ngày, hoặc nhóm Điểm danh + Đấu giá). */
  multi: boolean;
  points: TimelinePoint[];
}

export const TIMELINE_MARK_TITLES: Record<TimelineMark, string> = {
  done: "Đã xong",
  cur: "Đang mở",
  live: "Đang diễn ra",
  "": "Sắp tới",
  na: "Chưa khai báo",
};

type ScheduleSession = Pick<
  AuctionSession,
  | "status"
  | "auction_format"
  | "registration_start_at"
  | "registration_end_at"
  | "viewing_start_at"
  | "viewing_end_at"
  | "starts_at"
  | "ends_at"
  | "checkin_lead_minutes"
  | "checkin_grace_minutes"
>;

/**
 * Ba khối: Bán & nhận hồ sơ · Xem tài sản · Đấu giá (Điểm danh + giờ đấu).
 * Chỉ phiên đã công bố mới tô trạng thái — nháp / đã huỷ để mọi mốc trung tính.
 */
export function scheduleTimeline(s: ScheduleSession, now: Date = new Date()): TimelineStage[] {
  const t = now.getTime();
  const tracked = s.status === "published";

  const range = (
    title: string,
    sub: string,
    labels: [string, string],
    fromIso: string | null,
    toIso: string | null,
  ): TimelineStage => {
    if (!fromIso || !toIso) {
      return {
        title,
        sub: "Chưa khai báo",
        multi: true,
        points: labels.map((label) => ({ label, date: "--/--/----", time: "--:--", mark: "na" as const })),
      };
    }
    const a = new Date(fromIso);
    const b = new Date(toIso);
    if (sameDay(a, b)) {
      const mark: TimelineMark = !tracked ? "" : t > b.getTime() ? "done" : t >= a.getTime() ? "cur" : "";
      return { title, sub, multi: false, points: [{ date: fmtDate(a), time: `${fmtTime(a)} – ${fmtTime(b)}`, mark }] };
    }
    return {
      title,
      sub,
      multi: true,
      points: [
        { label: labels[0], date: fmtDate(a), time: fmtTime(a), mark: tracked && t >= a.getTime() ? "done" : "" },
        {
          label: labels[1],
          date: fmtDate(b),
          time: fmtTime(b),
          mark: !tracked ? "" : t > b.getTime() ? "done" : t >= a.getTime() ? "cur" : "",
        },
      ],
    };
  };

  const window = (label: string, a: Date, b: Date, liveMark: "cur" | "live"): TimelinePoint => ({
    label,
    date: fmtDate(a),
    time: `${fmtTime(a)} – ${fmtTime(b)}`,
    mark: !tracked ? "" : t > b.getTime() ? "done" : t >= a.getTime() ? liveMark : "",
  });

  const checkin = checkinWindowOf(s);
  return [
    range(
      "Bán & nhận hồ sơ",
      "Mua hồ sơ, nộp đăng ký",
      ["Mở bán hồ sơ", "Ngừng bán hồ sơ"],
      s.registration_start_at,
      s.registration_end_at,
    ),
    range("Xem tài sản", "Xem thực tế theo lịch hẹn", ["Bắt đầu xem", "Kết thúc xem"], s.viewing_start_at, s.viewing_end_at),
    {
      title: "Đấu giá",
      sub: AUCTION_FORMAT_LABELS[s.auction_format] ?? s.auction_format,
      multi: true,
      points: [
        window("Điểm danh", checkin.opensAt, checkin.closesAt, "cur"),
        window("Đấu giá", new Date(s.starts_at), new Date(s.ends_at), "live"),
      ],
    },
  ];
}

// ---- Kết quả lô ----

export type LotResultKey = "wait" | "live" | "paused" | "won" | "unsold" | "closed" | "pulled";

export const LOT_RESULT_DISPLAY: Record<LotResultKey, string> = {
  wait: "Chờ đấu",
  live: "Đang trả giá",
  paused: "Tạm dừng",
  won: "Đã trúng",
  unsold: "Không thành",
  closed: "Đã đóng",
  pulled: "Đã rút",
};

/**
 * Kết quả một lô cho cột "Kết quả". Không có dòng auction_lot_states ⇒ lô chưa mở.
 * Phiên đã huỷ thì mọi lô coi như đã rút (server rút lô còn lại khi huỷ).
 */
export function lotResultOf(
  state: Pick<LotState, "status" | "result" | "winning_amount"> | undefined,
  sessionStatus: AuctionSession["status"],
): { key: LotResultKey; amount: number | null } {
  if (sessionStatus === "cancelled") return { key: "pulled", amount: null };
  if (!state || state.status === "pending") return { key: "wait", amount: null };
  if (state.status === "open") return { key: "live", amount: null };
  if (state.status === "paused") return { key: "paused", amount: null };
  if (state.status === "withdrawn") return { key: "pulled", amount: null };
  if (state.result === "sold") return { key: "won", amount: state.winning_amount };
  if (state.result === "unsold") return { key: "unsold", amount: null };
  return { key: "closed", amount: null };
}

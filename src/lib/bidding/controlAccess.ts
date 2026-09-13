// Ai được vào PHÒNG ĐIỀU HÀNH của tổ chức, thao tác nào đang bấm được, và mở lô
// thì lô đóng lúc nào.
//
// Song song với roomAccess.ts (cổng phòng đấu giá của người mua) nhưng KHÁC bản
// chất: ở đó câu hỏi là "người này có đủ điều kiện trả giá không", ở đây là
// "phiên này có gì để điều hành, và người này có quyền không".
//
// Tách khỏi JSX vì hai lý do, và lý do thứ hai mới là lý do chính:
//   1. Chuỗi cổng có thứ tự — xếp sai nhánh là hiện sai câu.
//   2. lotActionsFor() CHÉP LẠI các điều kiện tiên quyết của org_* RPC. Sai ở
//      đây nghĩa là đấu giá viên bấm một nút chắc chắn lỗi, GIỮA phiên đang
//      chạy. Có test thì sai lệch lộ ra ngay.

import { lotPhaseOf, type LotPhase } from "./lotPhase";
import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";
import type { LotState } from "@/types/auction-bidding";

// ─── 1. Cổng trang ──────────────────────────────────────────────────────────

export type ControlGate =
  | { kind: "loading" }
  | { kind: "not_found" }
  /** Phiên nháp: chưa công bố thì chưa có gì để điều hành. */
  | { kind: "draft" }
  | { kind: "cancelled" }
  /** Đấu giá trực tiếp tại hội trường — không có phòng điều hành trực tuyến. */
  | { kind: "not_online" }
  | { kind: "ready" };

export interface ControlGateSession {
  status: SessionPublishStatus;
  auction_format: string;
}

export interface ControlGateInput {
  loading: boolean;
  session: ControlGateSession | null;
}

const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

/**
 * KHÔNG có nhánh `method_unsupported` như roomAccess: CHECK ở DB mới chỉ cho
 * bidding_method = 'ascending', và trang này không có lối vào ẩn danh — thêm
 * nhánh đó là viết code chết.
 */
export function controlGateOf({ loading, session }: ControlGateInput): ControlGate {
  if (loading) return { kind: "loading" };
  if (!session) return { kind: "not_found" };
  if (session.status === "draft") return { kind: "draft" };
  // Xét TRƯỚC not_online: phiên trực tiếp ĐÃ HUỶ thì câu đúng là "đã huỷ".
  if (session.status === "cancelled") return { kind: "cancelled" };
  if (!ONLINE_FORMATS.has(session.auction_format)) return { kind: "not_online" };
  return { kind: "ready" };
}

// ─── 2. Cửa sổ điều hành theo thời gian ─────────────────────────────────────

export type OperateBlockReason = "not_started" | "ended" | "finalized";

export interface OperateWindow {
  reason: OperateBlockReason | null;
}

export interface OperateWindowSession {
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
}

/**
 * Phụ thuộc ĐỒNG HỒ nên không nằm chung với controlGateOf (trang tĩnh không có
 * `now`): gọi từ component sống, bằng đúng `now` mà bảng lô và đồng hồ dùng.
 *
 * `finalized` thắng `ended`: phiên chốt rồi thì hết giờ không còn là thông tin.
 */
export function operateWindowOf(session: OperateWindowSession, now: Date): OperateWindow {
  if (session.finalized_at) return { reason: "finalized" };
  const starts = Date.parse(session.starts_at);
  const ends = Date.parse(session.ends_at);
  if (!Number.isNaN(starts) && now.getTime() < starts) return { reason: "not_started" };
  if (!Number.isNaN(ends) && now.getTime() >= ends) return { reason: "ended" };
  return { reason: null };
}

export const OPERATE_BLOCK_LABELS: Record<OperateBlockReason, string> = {
  not_started: "Phiên chưa bắt đầu",
  ended: "Phiên đã kết thúc",
  finalized: "Phiên đã chốt kết quả",
};

// ─── 3. Thao tác khả dụng trên một lô ───────────────────────────────────────

export interface LotAction {
  enabled: boolean;
  /** Câu giải thích khi tắt — gắn vào title của nút. null khi đang bật. */
  disabledReason: string | null;
}

export interface LotActions {
  open: LotAction;
  pause: LotAction;
  resume: LotAction;
  withdraw: LotAction;
}

const NO_PERMISSION = "Bạn không có quyền điều hành phiên đấu giá.";

const PHASE_BLOCK: Partial<Record<LotPhase, string>> = {
  pending: "Lô chưa được mở.",
  open: "Lô đang trả giá.",
  extended: "Lô đang trả giá.",
  paused: "Lô đang tạm dừng.",
  closed: "Lô đã đóng.",
  withdrawn: "Lô đã bị rút khỏi phiên.",
};

const act = (enabled: boolean, reason: string): LotAction =>
  enabled ? { enabled: true, disabledReason: null } : { enabled: false, disabledReason: reason };

/**
 * Bản client của các chốt trong org_open_lot / org_pause_lot / org_resume_lot /
 * org_withdraw_lot (20260913000001:911-1086 + 20260913000003).
 *
 * BA điểm dễ sai nếu viết thẳng trong JSX:
 *   1. Xét theo GIAI ĐOẠN SUY DIỄN (lotPhaseOf), không theo state.status. Dòng
 *      `open` đã quá ends_at vẫn ghi 'open' trong DB cho tới khi cron chạy;
 *      lúc đó "Tạm dừng" phải TẮT, vì server trả lot_closed.
 *   2. Rút lô được phép từ pending VÀ paused, không chỉ khi đang mở.
 *   3. Tạm dừng KHÔNG cần cửa sổ phiên còn sống (org_pause_lot không kiểm
 *      session status), nhưng Mở và Tiếp tục thì có.
 */
export function lotActionsFor(
  state: LotState | null,
  now: Date,
  opts: { canOperate: boolean; window: OperateWindow },
): LotActions {
  const { canOperate, window } = opts;

  if (!canOperate) {
    const blocked = act(false, NO_PERMISSION);
    return { open: blocked, pause: blocked, resume: blocked, withdraw: blocked };
  }

  const phase = lotPhaseOf(state, now);
  const phaseWhy = PHASE_BLOCK[phase] ?? "Không thao tác được ở trạng thái này.";
  const windowWhy = window.reason ? `${OPERATE_BLOCK_LABELS[window.reason]}.` : null;

  const live = phase === "open" || phase === "extended";
  const terminal = phase === "closed" || phase === "withdrawn";

  return {
    open: act(phase === "pending" && !windowWhy, windowWhy ?? phaseWhy),
    // Không chặn theo cửa sổ: lô đang mở thì vẫn phải dừng được kể cả khi phiên
    // vừa quá giờ kết thúc.
    pause: act(live, phaseWhy),
    resume: act(phase === "paused" && !windowWhy, windowWhy ?? phaseWhy),
    withdraw: act(!terminal && !windowWhy, windowWhy ?? phaseWhy),
  };
}

// ─── 4. Thời lượng mở lô ────────────────────────────────────────────────────

/** Khớp CHECK trong org_open_lot (20260913000003): 60 giây .. 24 giờ. */
export const MIN_DURATION_SECONDS = 60;
export const MAX_DURATION_SECONDS = 86_400;

/** Mốc bấm nhanh trong hộp thoại "Mở lô", tính bằng PHÚT. */
export const DURATION_PRESETS = [15, 30, 60] as const;

/** Mặc định: "đến hết phiên" thường là hàng tháng ⇒ đồng hồ vô nghĩa. */
export const DEFAULT_DURATION_MINUTES = 30;

export const minutesToSeconds = (m: number) => Math.round(m * 60);

export function isValidDurationMinutes(minutes: number): boolean {
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) return false;
  const s = minutesToSeconds(minutes);
  return s >= MIN_DURATION_SECONDS && s <= MAX_DURATION_SECONDS;
}

/**
 * Bản TS của `LEAST(session.ends_at, now + thời lượng)` trong org_open_lot —
 * để con số xem trước trong hộp thoại không bao giờ lệch với thứ server ghi.
 * `null` = đến hết phiên.
 */
export function previewLotEndsAt(
  now: Date,
  durationSeconds: number | null,
  sessionEndsAt: string,
): string {
  const sessionEnd = Date.parse(sessionEndsAt);
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || Number.isNaN(sessionEnd)) {
    return sessionEndsAt;
  }
  const candidate = now.getTime() + durationSeconds * 1000;
  return new Date(Math.min(candidate, sessionEnd)).toISOString();
}

/** Thời lượng đã chọn có bị giờ kết thúc phiên cắt ngắn không. */
export function isDurationClamped(
  now: Date,
  durationSeconds: number | null,
  sessionEndsAt: string,
): boolean {
  if (durationSeconds == null) return false;
  const sessionEnd = Date.parse(sessionEndsAt);
  if (Number.isNaN(sessionEnd)) return false;
  return now.getTime() + durationSeconds * 1000 > sessionEnd;
}

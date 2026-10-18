// Thẻ hành động ở cột phải /sessions/:id — 5 bước của người mua:
//   Mua hồ sơ → Duyệt & đặt trước → Điểm danh → Trả giá → Kết quả.
//
// GHÉP các nguồn sự thật sẵn có, không thêm luật mới:
//   - contractCtaState (ctaState.ts)      — mua hồ sơ được không
//   - attendanceStateOf (eligibility.ts)  — duyệt / đặt trước / điểm danh
//   - sessionPhaseOf + finalized_at       — đang đấu / đã chốt
// Thứ tự ưu tiên: phiên huỷ > đã chốt > hồ sơ đã trả tiền (dự phiên) > đang/đã đấu
// (người xem) > trạng thái mua hồ sơ.

import type { ContractCta } from "@/lib/biddingContracts/ctaState";
import type { AttendanceState } from "@/lib/biddingContracts/eligibility";
import type { AuctionSessionStatus } from "@/lib/listings/sessionStatus";

export type JourneyPhase =
  | "cancelled"
  | "final"
  | "awaiting_result"
  | "live"
  | "not_open_yet"
  | "available"
  | "pending_payment"
  | "full"
  | "closed"
  | "offline"
  /** Đã trả tiền hồ sơ nhưng không thuộc trạng thái dự phiên nào (hình thức chưa đặt, đã chốt danh sách…). */
  | "registered"
  | AttendanceState;

export const JOURNEY_STEP_LABELS = ["Mua hồ sơ", "Duyệt & đặt trước", "Điểm danh", "Trả giá", "Kết quả"] as const;

const STEP: Record<JourneyPhase, number> = {
  not_open_yet: 0,
  available: 0,
  pending_payment: 0,
  full: 0,
  closed: 0,
  offline: 0,
  cancelled: 0,
  registered: 1,
  awaiting_review: 1,
  needs_info: 1,
  rejected: 1,
  awaiting_deposit: 1,
  ticket_ready: 2,
  checkin_open: 2,
  absent: 2,
  excused: 2,
  checked_in: 3,
  live: 3,
  awaiting_result: 4,
  final: 4,
};

export const journeyStepOf = (p: JourneyPhase): number => STEP[p];

interface Input {
  sessionStatus: string;
  finalized: boolean;
  phase: AuctionSessionStatus;
  cta: ContractCta;
  /** attendanceStateOf của hồ sơ đã trả tiền; null khi không có hồ sơ / không có gì để hiện. */
  attendance: AttendanceState | null;
  hasPaidContract: boolean;
}

export function journeyPhaseOf({ sessionStatus, finalized, phase, cta, attendance, hasPaidContract }: Input): JourneyPhase {
  if (sessionStatus === "cancelled") return "cancelled";
  if (finalized) return "final";

  const started = phase === "ongoing" || phase === "ended";
  if (hasPaidContract && attendance) {
    // Đã điểm danh thì giờ đấu là "phòng đấu giá" của người này.
    if (attendance === "checked_in" && started) return phase === "ended" ? "awaiting_result" : "live";
    return attendance;
  }
  if (phase === "ended") return "awaiting_result";
  if (phase === "ongoing") return "live";

  switch (cta.kind) {
    case "not_open_yet":
      return "not_open_yet";
    case "available":
    case "login_required":
      return "available";
    case "pending":
      return "pending_payment";
    case "full":
      return "full";
    case "closed":
      return "closed";
    case "paid":
      // Đã trả tiền mà attendanceStateOf không có gì để nói (vd. hình thức chưa đặt).
      return "registered";
    default:
      return "offline";
  }
}

/** Đếm ngược "02 ngày 17 giờ 39 phút"; dưới 1 ngày ⇒ giờ / phút / giây. */
export function countdownParts(targetMs: number, nowMs: number): { value: string; unit: string }[] {
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");
  const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return days > 0
    ? [
        { value: pad(days), unit: "ngày" },
        { value: pad(hours), unit: "giờ" },
        { value: pad(minutes), unit: "phút" },
      ]
    : [
        { value: pad(hours), unit: "giờ" },
        { value: pad(minutes), unit: "phút" },
        { value: pad(seconds), unit: "giây" },
      ];
}

/** Phiên có phòng đấu giá trên sàn (trực tuyến hoặc cả hai) — cùng tập với cổng phòng đấu giá. */
export const hasOnlineRoom = (format: string | null | undefined): boolean =>
  format === "truc_tuyen" || format === "ca_hai";

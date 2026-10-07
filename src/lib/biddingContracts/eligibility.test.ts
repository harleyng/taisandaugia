import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_STATE_LABELS,
  attendanceStateOf,
  type AttendanceContract,
  type AttendanceSession,
  type AttendanceState,
} from "./eligibility";

// Phiên 09:00 giờ VN, mở điểm danh trước 60 phút, nhận trễ 10 phút.
const session = (patch: Partial<AttendanceSession> = {}): AttendanceSession => ({
  status: "published",
  auction_format: "truc_tuyen",
  starts_at: "2026-10-10T02:00:00Z",
  checkin_lead_minutes: 60,
  checkin_grace_minutes: 10,
  roster_closed_at: null,
  ...patch,
});

const eligible = (patch: Partial<AttendanceContract> = {}): AttendanceContract => ({
  status: "paid",
  review_status: "approved",
  deposit_status: "received",
  checked_in_at: null,
  absent_at: null,
  absence_excused_at: null,
  ...patch,
});

const BEFORE = new Date("2026-10-09T10:00:00Z");
const OPEN = new Date("2026-10-10T01:30:00Z");
const AFTER = new Date("2026-10-10T02:10:01Z");

const state = (c: Partial<AttendanceContract>, s: Partial<AttendanceSession> = {}, now = BEFORE) =>
  attendanceStateOf(eligible(c), session(s), now);

describe("attendanceStateOf", () => {
  it("đủ điều kiện ⇒ ticket_ready trước cửa sổ, checkin_open trong cửa sổ", () => {
    expect(state({})).toBe("ticket_ready");
    expect(state({}, {}, OPEN)).toBe("checkin_open");
    expect(state({}, { auction_format: "truc_tiep" }, OPEN)).toBe("checkin_open");
  });

  it("quá cửa sổ mà cron chưa chốt ⇒ absent", () => {
    expect(state({}, {}, AFTER)).toBe("absent");
  });

  it("duyệt hồ sơ: chờ duyệt / cần bổ sung / từ chối", () => {
    expect(state({ review_status: "pending" })).toBe("awaiting_review");
    expect(state({ review_status: "needs_info" })).toBe("needs_info");
    expect(state({ status: "refunded", review_status: "rejected" })).toBe("rejected");
  });

  it("từ chối thắng mọi thứ, kể cả phiên đã huỷ", () => {
    expect(state({ status: "refunded", review_status: "rejected" }, { status: "cancelled" })).toBe("rejected");
  });

  it("chưa nhận tiền đặt trước ⇒ awaiting_deposit; đã xử lý theo đường khác ⇒ null", () => {
    expect(state({ deposit_status: "pending" })).toBe("awaiting_deposit");
    expect(state({ deposit_status: "refunded" })).toBeNull();
    expect(state({ deposit_status: "forfeited" })).toBeNull();
  });

  it("đã điểm danh / vắng / vắng có lý do là sự thật đã ghi, thắng phiên đã chốt", () => {
    const closed = { roster_closed_at: "2026-10-10T02:11:00Z" };
    expect(state({ checked_in_at: "2026-10-10T01:40:00Z" }, closed, AFTER)).toBe("checked_in");
    expect(state({ absent_at: "2026-10-10T02:11:00Z", deposit_status: "forfeited" }, closed, AFTER)).toBe("absent");
    expect(
      state(
        { absent_at: "2026-10-10T02:11:00Z", absence_excused_at: "2026-10-10T03:00:00Z", deposit_status: "pending_refund" },
        closed,
        AFTER,
      ),
    ).toBe("excused");
  });

  it("chưa thanh toán / đã huỷ ⇒ null", () => {
    expect(state({ status: "pending_payment", review_status: "pending" })).toBeNull();
    expect(state({ status: "cancelled", review_status: "pending" })).toBeNull();
  });

  it("phiên không còn công bố, hình thức cả hai, hoặc đã chốt mà không bị đánh vắng ⇒ null", () => {
    expect(state({}, { status: "cancelled" })).toBeNull();
    expect(state({}, { auction_format: "ca_hai" })).toBeNull();
    expect(state({}, { auction_format: null })).toBeNull();
    expect(state({}, { roster_closed_at: "2026-10-08T00:00:00Z" }, AFTER)).toBeNull();
    // Đã chốt thì cũng không còn bổ sung hồ sơ được nữa (trigger khoá duyệt).
    expect(state({ review_status: "needs_info" }, { roster_closed_at: "2026-10-08T00:00:00Z" })).toBeNull();
  });

  it("có nhãn tiếng Việt cho mọi trạng thái", () => {
    const all: AttendanceState[] = [
      "awaiting_review",
      "needs_info",
      "rejected",
      "awaiting_deposit",
      "ticket_ready",
      "checkin_open",
      "checked_in",
      "absent",
      "excused",
    ];
    for (const s of all) expect(ATTENDANCE_STATE_LABELS[s]).toBeTruthy();
  });
});

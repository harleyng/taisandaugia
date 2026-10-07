import { describe, expect, it } from "vitest";
import type { AttendanceContract, AttendanceSession } from "./eligibility";
import { checkinReminderOf, formatDurationVi } from "./checkinReminder";

const session = (patch: Partial<AttendanceSession> = {}): AttendanceSession => ({
  status: "published",
  auction_format: "truc_tuyen",
  starts_at: "2026-10-10T02:00:00Z",
  checkin_lead_minutes: 60,
  checkin_grace_minutes: 0,
  roster_closed_at: null,
  ...patch,
});

const contract = (patch: Partial<AttendanceContract> = {}): AttendanceContract => ({
  status: "paid",
  review_status: "approved",
  deposit_status: "received",
  checked_in_at: null,
  absent_at: null,
  absence_excused_at: null,
  ...patch,
});

describe("checkinReminderOf", () => {
  it("phiên còn hơn 24 giờ ⇒ chưa nhắc", () => {
    expect(checkinReminderOf(contract(), session(), new Date("2026-10-09T01:59:00Z"))).toBeNull();
  });

  it("≤ 24 giờ và chưa tới giờ mở ⇒ upcoming kèm giờ mở", () => {
    const r = checkinReminderOf(contract(), session(), new Date("2026-10-09T02:00:00Z"));
    expect(r?.phase).toBe("upcoming");
    expect(r?.channel).toBe("online");
    expect(r?.opensAt.toISOString()).toBe("2026-10-10T01:00:00.000Z");
  });

  it("trong cửa sổ ⇒ open", () => {
    expect(checkinReminderOf(contract(), session(), new Date("2026-10-10T01:30:00Z"))?.phase).toBe("open");
  });

  it("phiên trực tiếp cũng nhắc, kênh onsite", () => {
    const r = checkinReminderOf(contract(), session({ auction_format: "truc_tiep" }), new Date("2026-10-10T01:30:00Z"));
    expect(r?.channel).toBe("onsite");
  });

  it("không nhắc khi đã điểm danh, chưa duyệt, chưa nộp tiền, hoặc đã quá giờ", () => {
    const now = new Date("2026-10-10T01:30:00Z");
    expect(checkinReminderOf(contract({ checked_in_at: "2026-10-10T01:10:00Z" }), session(), now)).toBeNull();
    expect(checkinReminderOf(contract({ review_status: "pending" }), session(), now)).toBeNull();
    expect(checkinReminderOf(contract({ deposit_status: "pending" }), session(), now)).toBeNull();
    expect(checkinReminderOf(contract(), session(), new Date("2026-10-10T02:00:01Z"))).toBeNull();
  });
});

describe("formatDurationVi", () => {
  it("định dạng giờ / phút", () => {
    expect(formatDurationVi(30_000)).toBe("dưới 1 phút");
    expect(formatDurationVi(45 * 60_000)).toBe("45 phút");
    expect(formatDurationVi(3 * 3_600_000)).toBe("3 giờ");
    expect(formatDurationVi(3 * 3_600_000 + 20 * 60_000)).toBe("3 giờ 20 phút");
    expect(formatDurationVi(-5)).toBe("dưới 1 phút");
  });
});

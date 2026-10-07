import { describe, expect, it } from "vitest";
import { closeRosterBlockOf, rosterAlertOf, type CloseRosterSession } from "./rosterSummary";

const session: CloseRosterSession = {
  status: "published",
  auction_format: "truc_tiep",
  starts_at: "2026-10-10T02:00:00Z",
  checkin_lead_minutes: 60,
  checkin_grace_minutes: 0,
  roster_closed_at: null,
};

const BEFORE = new Date("2026-10-10T00:30:00Z");
const OPEN = new Date("2026-10-10T01:30:00Z");
const AFTER = new Date("2026-10-10T02:05:00Z");

const counts = (checked_in: number, awaiting: number, roster_closed_at: string | null = null) => ({
  checked_in,
  awaiting,
  eligible: checked_in + awaiting,
  roster_closed_at,
});

describe("rosterAlertOf", () => {
  it("đã chốt: < 2 có mặt ⇒ critical, đủ 2 ⇒ không cảnh báo", () => {
    const closed = "2026-10-10T02:01:00Z";
    expect(rosterAlertOf(counts(1, 0, closed), session, AFTER)?.level).toBe("critical");
    expect(rosterAlertOf(counts(0, 0, closed), session, AFTER)?.title).toBe("Không có ai có mặt");
    expect(rosterAlertOf(counts(2, 0, closed), session, AFTER)).toBeNull();
  });

  it("chưa mở: xét số người đủ điều kiện", () => {
    expect(rosterAlertOf(counts(0, 1), session, BEFORE)?.level).toBe("warning");
    expect(rosterAlertOf(counts(0, 2), session, BEFORE)).toBeNull();
  });

  it("đang mở: chưa đủ 2 nhưng còn người chờ ⇒ warning", () => {
    const a = rosterAlertOf(counts(1, 3), session, OPEN);
    expect(a?.level).toBe("warning");
    expect(a?.body).toContain("Còn 3 người");
  });

  it("đang mở / hết giờ: kể cả mọi người tới vẫn < 2 ⇒ critical", () => {
    expect(rosterAlertOf(counts(0, 1), session, OPEN)?.level).toBe("critical");
    expect(rosterAlertOf(counts(1, 0), session, AFTER)?.level).toBe("critical");
  });

  it("đủ 2 người điểm danh ⇒ không cảnh báo", () => {
    expect(rosterAlertOf(counts(2, 5), session, OPEN)).toBeNull();
  });
});

describe("closeRosterBlockOf", () => {
  it("sau giờ bắt đầu, phiên công bố, chưa chốt ⇒ được chốt", () => {
    expect(closeRosterBlockOf(session, AFTER)).toBeNull();
    expect(closeRosterBlockOf(session, new Date(session.starts_at))).toBeNull();
  });

  it("trước giờ bắt đầu ⇒ too_early (kể cả cửa sổ đang mở)", () => {
    expect(closeRosterBlockOf(session, OPEN)).toBe("too_early");
  });

  it("thứ tự chặn khớp org_close_roster_now", () => {
    expect(closeRosterBlockOf({ ...session, roster_closed_at: "x", status: "cancelled" }, AFTER)).toBe("not_published");
    expect(closeRosterBlockOf({ ...session, roster_closed_at: "x" }, AFTER)).toBe("closed");
    expect(closeRosterBlockOf({ ...session, auction_format: "ca_hai" }, AFTER)).toBe("format_unsupported");
  });
});

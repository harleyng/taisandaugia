import { describe, expect, it } from "vitest";
import type { AttendanceSession } from "./eligibility";
import { blockReasonOfState, buildRoster, countRosterGroups, rosterGroupOf, type RosterContract } from "./checkinRoster";

const session: AttendanceSession = {
  status: "published",
  auction_format: "truc_tiep",
  starts_at: "2026-10-10T02:00:00Z",
  checkin_lead_minutes: 60,
  checkin_grace_minutes: 0,
  roster_closed_at: null,
};

const OPEN = new Date("2026-10-10T01:30:00Z");

let seq = 0;
const contract = (patch: Partial<RosterContract> = {}): RosterContract => ({
  id: `c${++seq}`,
  full_name: "Nguyễn Văn A",
  bidder_no: null,
  status: "paid",
  review_status: "approved",
  deposit_status: "received",
  checked_in_at: null,
  absent_at: null,
  absence_excused_at: null,
  ...patch,
});

describe("rosterGroupOf", () => {
  it("gộp trạng thái dự phiên về 4 nhóm", () => {
    expect(rosterGroupOf("checked_in")).toBe("checked_in");
    expect(rosterGroupOf("ticket_ready")).toBe("awaiting");
    expect(rosterGroupOf("checkin_open")).toBe("awaiting");
    expect(rosterGroupOf("absent")).toBe("absent");
    expect(rosterGroupOf("excused")).toBe("absent");
    expect(rosterGroupOf("awaiting_review")).toBe("ineligible");
    expect(rosterGroupOf("needs_info")).toBe("ineligible");
    expect(rosterGroupOf("awaiting_deposit")).toBe("ineligible");
    expect(rosterGroupOf("rejected")).toBe("ineligible");
    expect(rosterGroupOf(null)).toBe("ineligible");
  });
});

describe("buildRoster", () => {
  it("xếp theo nhóm, đã điểm danh theo số báo danh, còn lại theo tên", () => {
    const rows = [
      contract({ full_name: "Trần B", review_status: "pending" }),
      contract({ full_name: "Lê C", checked_in_at: "2026-10-10T01:10:00Z", bidder_no: 42 }),
      contract({ full_name: "Phạm D" }),
      contract({ full_name: "Đỗ E", checked_in_at: "2026-10-10T01:05:00Z", bidder_no: 7 }),
      contract({ full_name: "An F", absent_at: "2026-10-10T02:01:00Z", deposit_status: "forfeited" }),
      contract({ full_name: "Bùi G" }),
    ];
    const roster = buildRoster(rows, session, OPEN);
    expect(roster.map((r) => r.contract.full_name)).toEqual(["Đỗ E", "Lê C", "Bùi G", "Phạm D", "An F", "Trần B"]);
    expect(roster.map((r) => r.state)).toEqual([
      "checked_in",
      "checked_in",
      "checkin_open",
      "checkin_open",
      "absent",
      "awaiting_review",
    ]);
    expect(countRosterGroups(roster)).toEqual({ checked_in: 2, awaiting: 2, absent: 1, ineligible: 1 });
  });

  it("không đổi mảng đầu vào", () => {
    const rows = [contract({ full_name: "B" }), contract({ full_name: "A" })];
    buildRoster(rows, session, OPEN);
    expect(rows.map((r) => r.full_name)).toEqual(["B", "A"]);
  });
});

describe("blockReasonOfState", () => {
  it("chỉ checkin_open là không bị chặn", () => {
    expect(blockReasonOfState("checkin_open")).toBeNull();
    expect(blockReasonOfState("ticket_ready")).toBe("window_not_open");
    expect(blockReasonOfState("awaiting_review")).toBe("review_pending");
    expect(blockReasonOfState("needs_info")).toBe("review_needs_info");
    expect(blockReasonOfState("awaiting_deposit")).toBe("deposit_not_received");
    expect(blockReasonOfState("checked_in")).toBe("already_checked_in");
    expect(blockReasonOfState("excused")).toBe("absent");
    expect(blockReasonOfState(null)).toBe("roster_closed");
  });
});

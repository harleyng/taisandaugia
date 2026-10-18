import { describe, expect, it } from "vitest";
import { boardBannerOf, boardGroupOf, boardStatusOf, boardWindowOf, formatCheckinTime } from "./checkinBoard";

// Giờ địa phương để chuỗi HH:mm không phụ thuộc múi giờ máy chạy test.
const STARTS = new Date(2026, 9, 10, 9, 0).toISOString();
const session = { status: "published", auction_format: "truc_tiep" as const, starts_at: STARTS, checkin_lead_minutes: 60, checkin_grace_minutes: 15 };
const at = (h: number, m: number) => new Date(2026, 9, 10, h, m);

describe("boardWindowOf", () => {
  it("theo cửa sổ [start − lead, start + grace]", () => {
    expect(boardWindowOf(session, at(7, 59))).toBe("before");
    expect(boardWindowOf(session, at(8, 0))).toBe("open");
    expect(boardWindowOf(session, at(9, 15))).toBe("open");
    expect(boardWindowOf(session, at(9, 16))).toBe("closed");
  });

  it("đã chốt danh sách ⇒ closed dù còn giờ; huỷ ⇒ cancelled", () => {
    expect(boardWindowOf({ ...session, roster_closed_at: at(8, 30).toISOString() }, at(8, 40))).toBe("closed");
    expect(boardWindowOf({ ...session, status: "cancelled" }, at(8, 30))).toBe("cancelled");
    expect(boardWindowOf({ ...session, auction_format: "ca_hai" }, at(8, 30))).toBe("unsupported");
  });
});

describe("boardGroupOf / boardStatusOf", () => {
  it("gom trạng thái dự phiên về nhóm của design", () => {
    expect(boardGroupOf("checked_in")).toBe("in");
    expect(boardGroupOf("checkin_open")).toBe("wait");
    expect(boardGroupOf("ticket_ready")).toBe("wait");
    expect(boardGroupOf(null)).toBe("wait");
    expect(boardGroupOf("absent")).toBe("abs");
    expect(boardGroupOf("excused")).toBe("exc");
    expect(boardGroupOf("awaiting_deposit")).toBe("pending_deposit");
  });

  it("nhãn chờ đổi theo cửa sổ", () => {
    expect(boardStatusOf("wait", "open").label).toBe("Chờ điểm danh");
    expect(boardStatusOf("wait", "before").label).toBe("Chưa mở");
    expect(boardStatusOf("wait", "closed").label).toBe("Không điểm danh");
    expect(boardStatusOf("abs", "closed")).toEqual({ label: "Vắng", tone: "live" });
  });
});

describe("boardBannerOf", () => {
  it("chưa mở: giờ mở + giờ chốt", () => {
    expect(boardBannerOf("before", session).body).toBe("Mở lúc 08:00 ngày 10/10, chốt danh sách lúc 09:15.");
  });

  it("đã chốt: dùng mốc chốt thật nếu có", () => {
    const b = boardBannerOf("closed", { ...session, roster_closed_at: at(8, 42).toISOString() });
    expect(b).toEqual({ title: "Đã chốt danh sách", body: "Chốt lúc 08:42 ngày 10/10/2026.", tone: "ok" });
    expect(boardBannerOf("closed", session).body).toBe("Chốt lúc 09:15 ngày 10/10/2026.");
  });
});

it("formatCheckinTime", () => {
  expect(formatCheckinTime(at(8, 5).toISOString())).toBe("10/10/26 08:05");
  expect(formatCheckinTime(null)).toBeNull();
});

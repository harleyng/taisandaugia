import { describe, expect, it } from "vitest";
import { attendeeNameOf, lotsLabel, maskPhone, ticketInfoOf, type TicketContract, type TicketSession } from "./attendanceTicket";

const contract = (over: Partial<TicketContract> = {}): TicketContract => ({
  code: "HS131-007",
  checkin_token: "tok",
  full_name: "Nguyễn Văn An",
  org_name: null,
  has_proxy: false,
  proxy_full_name: null,
  checked_in_at: null,
  checkin_attendee: null,
  bidder_no: null,
  ...over,
});

describe("attendanceTicket", () => {
  it("che số điện thoại nhận mã", () => {
    expect(maskPhone("0912345678")).toBe("0912 ••• 678");
    expect(maskPhone("")).toBe("—");
  });
  it("ghi lô đã đăng ký theo thứ tự", () => {
    expect(lotsLabel([2, 1])).toBe("Tài sản 1, 2");
    expect(lotsLabel([])).toBeNull();
  });
  it("người dự phiên: uỷ quyền mặc định, sau điểm danh theo người đã điểm danh", () => {
    expect(attendeeNameOf(contract())).toBe("Nguyễn Văn An");
    const proxied = contract({ has_proxy: true, proxy_full_name: "Trần Thị B" });
    expect(attendeeNameOf(proxied)).toBe("Trần Thị B (được uỷ quyền)");
    expect(attendeeNameOf({ ...proxied, checked_in_at: "x", checkin_attendee: "principal" })).toBe("Nguyễn Văn An");
  });
  it("số báo danh chỉ có sau khi điểm danh", () => {
    const s: TicketSession = { code: "PDG000131", title: "Phiên", venue: null, starts_at: "2026-10-22T02:00:00Z" };
    expect(ticketInfoOf(contract({ bidder_no: 7 }), s).bidderNo).toBeNull();
    expect(ticketInfoOf(contract({ bidder_no: 7, checked_in_at: "x" }), s).bidderNo).toBe("007");
  });
});

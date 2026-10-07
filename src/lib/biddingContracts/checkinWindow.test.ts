import { describe, expect, it } from "vitest";
import { checkinChannelOf, checkinWindowOf, checkinWindowPhase } from "./checkinWindow";

const STARTS = "2026-10-10T02:00:00Z";

describe("checkinWindowOf", () => {
  it("mặc định mở trước 60 phút, đóng đúng giờ bắt đầu", () => {
    const w = checkinWindowOf({ starts_at: STARTS });
    expect(w.opensAt.toISOString()).toBe("2026-10-10T01:00:00.000Z");
    expect(w.closesAt.toISOString()).toBe("2026-10-10T02:00:00.000Z");
  });

  it("dùng lead / grace của phiên; null ⇒ mặc định", () => {
    const w = checkinWindowOf({ starts_at: STARTS, checkin_lead_minutes: 120, checkin_grace_minutes: 15 });
    expect(w.opensAt.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(w.closesAt.toISOString()).toBe("2026-10-10T02:15:00.000Z");
    const n = checkinWindowOf({ starts_at: STARTS, checkin_lead_minutes: null, checkin_grace_minutes: null });
    expect(n.opensAt.toISOString()).toBe("2026-10-10T01:00:00.000Z");
  });
});

describe("checkinWindowPhase", () => {
  const s = { starts_at: STARTS, checkin_lead_minutes: 30, checkin_grace_minutes: 10 };
  it("trước / trong / sau cửa sổ, hai đầu tính là đang mở", () => {
    expect(checkinWindowPhase(s, new Date("2026-10-10T01:29:59Z"))).toBe("before");
    expect(checkinWindowPhase(s, new Date("2026-10-10T01:30:00Z"))).toBe("open");
    expect(checkinWindowPhase(s, new Date("2026-10-10T02:10:00Z"))).toBe("open");
    expect(checkinWindowPhase(s, new Date("2026-10-10T02:10:01Z"))).toBe("closed");
  });
});

describe("checkinChannelOf", () => {
  it("trực tiếp ⇒ onsite, trực tuyến ⇒ online, cả hai / chưa đặt ⇒ null", () => {
    expect(checkinChannelOf("truc_tiep")).toBe("onsite");
    expect(checkinChannelOf("truc_tuyen")).toBe("online");
    expect(checkinChannelOf("ca_hai")).toBeNull();
    expect(checkinChannelOf(null)).toBeNull();
  });
});

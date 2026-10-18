import { describe, expect, it } from "vitest";
import { heroRange, lotResultOf, scheduleTimeline } from "./sessionDetail";

const NOW = new Date("2026-10-10T10:00");

const session = (p: Partial<Parameters<typeof scheduleTimeline>[0]> = {}) => ({
  status: "published" as const,
  auction_format: "truc_tiep" as const,
  registration_start_at: "2026-09-25T08:00",
  registration_end_at: "2026-10-20T17:00",
  viewing_start_at: "2026-10-05T08:00",
  viewing_end_at: "2026-10-18T17:00",
  starts_at: "2026-10-22T09:00",
  ends_at: "2026-10-22T11:30",
  checkin_lead_minutes: 30,
  checkin_grace_minutes: 15,
  ...p,
});

describe("heroRange", () => {
  it("cùng ngày ⇒ ngày đủ + giờ bắt đầu–kết thúc", () => {
    expect(heroRange("2026-10-22T09:00", "2026-10-22T11:30")).toBe("22/10/2026 · 09:00–11:30");
  });
  it("khác ngày ⇒ dd/mm → dd/mm/yyyy", () => {
    expect(heroRange("2026-10-22T09:00", "2026-10-24T11:30")).toBe("22/10 → 24/10/2026");
  });
});

describe("scheduleTimeline", () => {
  it("phiên đang nhận hồ sơ: mốc mở đã qua, mốc đóng đang mở", () => {
    const [reg, view, auction] = scheduleTimeline(session(), NOW);
    expect(reg.multi).toBe(true);
    expect(reg.points.map((p) => p.mark)).toEqual(["done", "cur"]);
    expect(reg.points[0]).toMatchObject({ label: "Mở bán hồ sơ", date: "25/09/2026", time: "08:00" });
    expect(view.points.map((p) => p.mark)).toEqual(["done", "cur"]);
    expect(auction.points.map((p) => p.label)).toEqual(["Điểm danh", "Đấu giá"]);
    expect(auction.points[0].time).toBe("08:30 – 09:15");
    expect(auction.points.map((p) => p.mark)).toEqual(["", ""]);
    expect(auction.sub).toBe("Trực tiếp");
  });

  it("chưa khai báo ⇒ hai mốc na", () => {
    const [, view] = scheduleTimeline(session({ viewing_start_at: null, viewing_end_at: null }), NOW);
    expect(view.sub).toBe("Chưa khai báo");
    expect(view.points.every((p) => p.mark === "na" && p.date === "--/--/----")).toBe(true);
  });

  it("khoảng trong một ngày ⇒ một mốc, không nhãn", () => {
    const [, view] = scheduleTimeline(session({ viewing_start_at: "2026-10-10T08:00", viewing_end_at: "2026-10-10T17:00" }), NOW);
    expect(view.multi).toBe(false);
    expect(view.points).toEqual([{ date: "10/10/2026", time: "08:00 – 17:00", mark: "cur" }]);
  });

  it("đang đấu ⇒ điểm danh xong, đấu giá live", () => {
    const [, , auction] = scheduleTimeline(session({ starts_at: "2026-10-10T09:00", ends_at: "2026-10-10T11:30" }), NOW);
    expect(auction.points.map((p) => p.mark)).toEqual(["done", "live"]);
  });

  it("nháp ⇒ không tô trạng thái", () => {
    const stages = scheduleTimeline(session({ status: "draft" }), NOW);
    expect(stages.flatMap((s) => s.points.map((p) => p.mark)).every((m) => m === "")).toBe(true);
  });
});

describe("lotResultOf", () => {
  it("không có trạng thái ⇒ chờ đấu", () => {
    expect(lotResultOf(undefined, "published").key).toBe("wait");
  });
  it("đã bán ⇒ đã trúng kèm giá", () => {
    expect(lotResultOf({ status: "closed", result: "sold", winning_amount: 1_310_000_000 }, "published")).toEqual({
      key: "won",
      amount: 1_310_000_000,
    });
  });
  it("phiên huỷ ⇒ đã rút", () => {
    expect(lotResultOf(undefined, "cancelled").key).toBe("pulled");
  });
  it("đóng không thành", () => {
    expect(lotResultOf({ status: "closed", result: "unsold", winning_amount: null }, "published").key).toBe("unsold");
  });
});

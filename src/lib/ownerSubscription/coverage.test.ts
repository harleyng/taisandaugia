import { describe, expect, it } from "vitest";
import { coverageFor, coverageLabel, usagePercent } from "./coverage";
import type { OwnerSubscriptionStatus, SubLine } from "./types";

const line = (over: Partial<SubLine> = {}): SubLine => ({
  variant_key: "scan_3d_owner",
  name: "Tự quét 3D",
  credit_cost: 30,
  monthly_quota: 5,
  used: 2,
  remaining: 3,
  ...over,
});

const sub = (over: Partial<OwnerSubscriptionStatus> = {}): OwnerSubscriptionStatus => ({
  id: "s1",
  code: "GTB000001",
  workspace_id: "w1",
  workspace_name: "Ngân hàng",
  plan_name: "Gói Doanh nghiệp",
  status: "active",
  starts_on: "2026-09-01",
  ends_on: "2027-08-31",
  term_months: 12,
  price_vnd: 12_000_000,
  overage_mode: "block",
  period_month: "2026-09-01",
  next_reset_on: "2026-10-01",
  covered_for_me: true,
  can_pay: true,
  is_owner: true,
  plan_id: null,
  plan_tier: null,
  pending: null,
  lines: [line()],
  ...over,
});

describe("coverageFor", () => {
  it("không có gói / tenant Cá nhân ⇒ trả credit", () => {
    expect(coverageFor(null, "scan_3d_owner")).toEqual({ kind: "credits", exhausted: false });
    expect(coverageFor(undefined, "scan_3d_owner")).toEqual({ kind: "credits", exhausted: false });
  });

  it("còn hạn mức ⇒ covered với số lượt còn lại", () => {
    expect(coverageFor(sub(), "scan_3d_owner")).toEqual({ kind: "covered", remaining: 3, quota: 5 });
  });

  it("không giới hạn ⇒ covered, remaining null", () => {
    const s = sub({ lines: [line({ monthly_quota: null, remaining: null, used: 40 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "covered", remaining: null, quota: null });
  });

  it("hết hạn mức + chế độ chặn ⇒ blocked", () => {
    const s = sub({ lines: [line({ used: 5, remaining: 0 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "blocked", quota: 5 });
  });

  it("hết hạn mức + chế độ trừ credit ⇒ credits exhausted", () => {
    const s = sub({ overage_mode: "credits", lines: [line({ used: 7, remaining: 0 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "credits", exhausted: true });
  });

  it("tính năng không có trong gói ⇒ trả credit (không bị chặn)", () => {
    expect(coverageFor(sub(), "report_portfolio_owner")).toEqual({ kind: "credits", exhausted: false });
  });

  it("gói chưa hiệu lực / hết hạn / người xem qua liên kết trụ sở ⇒ trả credit", () => {
    for (const s of [sub({ status: "offered" }), sub({ status: "expired" }), sub({ status: "scheduled" }), sub({ covered_for_me: false })]) {
      expect(coverageFor(s, "scan_3d_owner").kind).toBe("credits");
    }
  });

  it("used âm (hoàn nhiều hơn dùng) không làm remaining vượt quota", () => {
    const s = sub({ lines: [line({ used: -1, remaining: 5 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "covered", remaining: 5, quota: 5 });
  });
});

describe("coverageLabel", () => {
  it("nhãn theo từng trường hợp", () => {
    expect(coverageLabel({ kind: "covered", remaining: 3, quota: 5 }, "scan_3d_owner")).toBe(
      "Miễn phí theo gói thuê bao — còn 3 lượt quét tháng này",
    );
    expect(coverageLabel({ kind: "covered", remaining: null, quota: null }, "report_portfolio_owner")).toBe(
      "Miễn phí theo gói thuê bao — không giới hạn",
    );
    expect(coverageLabel({ kind: "blocked", quota: 2 }, "report_portfolio_owner")).toBe(
      "Đã dùng hết 2 lượt xem của gói tháng này",
    );
    expect(coverageLabel({ kind: "credits", exhausted: false }, "scan_3d_owner")).toBe("");
  });
});

describe("usagePercent", () => {
  it("kẹp 0–100, không giới hạn ⇒ null", () => {
    expect(usagePercent(2, 5)).toBe(40);
    expect(usagePercent(9, 5)).toBe(100);
    expect(usagePercent(-1, 5)).toBe(0);
    expect(usagePercent(3, null)).toBeNull();
  });
});

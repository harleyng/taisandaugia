import { describe, expect, it } from "vitest";
import { coverageFor, coverageLabel, usagePercent } from "./coverage";
import type { OwnerSubscriptionStatus, SubLine } from "./types";

const line = (over: Partial<SubLine> = {}): SubLine => ({
  benefit_key: "scan_3d_owner",
  group: "Tài sản",
  label: "Quét 3D tài sản",
  unit: "lượt quét",
  kind: "quota",
  level_format: null,
  source: "enforced",
  credit_cost: 30,
  quota: 5,
  cycle: "month",
  tracked: true,
  used: 2,
  remaining: 3,
  window_start: "2026-09-01",
  resets_on: "2026-10-01",
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
    expect(coverageFor(sub(), "scan_3d_owner")).toEqual({ kind: "covered", remaining: 3, quota: 5, cycle: "month" });
  });

  it("không giới hạn ⇒ covered, remaining null", () => {
    const s = sub({ lines: [line({ quota: null, remaining: null, used: 40 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "covered", remaining: null, quota: null, cycle: "month" });
  });

  it("hết hạn mức + chế độ chặn ⇒ blocked", () => {
    const s = sub({ lines: [line({ used: 5, remaining: 0 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "blocked", quota: 5, cycle: "month" });
  });

  it("hết hạn mức + chế độ trừ credit ⇒ credits exhausted", () => {
    const s = sub({ overage_mode: "credits", lines: [line({ used: 7, remaining: 0 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "credits", exhausted: true, cycle: "month" });
  });

  it("tính năng không có trong gói ⇒ trả credit (không bị chặn)", () => {
    expect(coverageFor(sub(), "report_portfolio_owner")).toEqual({ kind: "credits", exhausted: false });
  });

  it("chu kỳ khác tháng theo dòng; quyền lợi chỉ hiển thị cùng khoá không được tính", () => {
    const s = sub({ lines: [line({ cycle: "week", quota: 2, used: 2, remaining: 0 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "blocked", quota: 2, cycle: "week" });
    const d = sub({ lines: [line({ source: "display" })] });
    expect(coverageFor(d, "scan_3d_owner")).toEqual({ kind: "credits", exhausted: false });
  });

  it("gói chưa hiệu lực / hết hạn / người xem qua liên kết trụ sở ⇒ trả credit", () => {
    for (const s of [sub({ status: "offered" }), sub({ status: "expired" }), sub({ status: "scheduled" }), sub({ covered_for_me: false })]) {
      expect(coverageFor(s, "scan_3d_owner").kind).toBe("credits");
    }
  });

  it("used âm (hoàn nhiều hơn dùng) không làm remaining vượt quota", () => {
    const s = sub({ lines: [line({ used: -1, remaining: 5 })] });
    expect(coverageFor(s, "scan_3d_owner")).toEqual({ kind: "covered", remaining: 5, quota: 5, cycle: "month" });
  });
});

describe("coverageLabel", () => {
  it("nhãn theo từng trường hợp", () => {
    expect(coverageLabel({ kind: "covered", remaining: 3, quota: 5, cycle: "month" }, "scan_3d_owner")).toBe(
      "Còn 3 lượt miễn phí tháng này",
    );
    expect(coverageLabel({ kind: "covered", remaining: null, quota: null, cycle: "month" }, "report_portfolio_owner")).toBe(
      "Miễn phí không giới hạn theo gói dịch vụ",
    );
    expect(coverageLabel({ kind: "blocked", quota: 2, cycle: "week" }, "report_portfolio_owner")).toBe(
      "Đã dùng hết 2 lượt xem của gói tuần này",
    );
    expect(coverageLabel({ kind: "covered", remaining: 1, quota: 4, cycle: "term" }, "scan_3d_owner")).toBe(
      "Còn 1 lượt miễn phí trong kỳ gói",
    );
    expect(coverageLabel({ kind: "credits", exhausted: true, cycle: "quarter" }, "scan_3d_owner")).toBe(
      "Đã hết hạn mức gói quý này — tính credit",
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

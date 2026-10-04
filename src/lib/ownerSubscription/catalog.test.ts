import { describe, expect, it } from "vitest";
import { compareGroups, planCardLines, planCta, planTermPrice } from "./catalog";
import type { BenefitCycle, OwnerSubPlan, PlanBenefitLine, SubBenefitDef } from "./types";

const DEFS: Record<string, SubBenefitDef> = {
  scan_3d_owner: { key: "scan_3d_owner", group_name: "Tài sản", label: "Quét 3D tài sản", unit: "lượt quét", kind: "quota", level_format: null, source: "enforced", default_cycle: "month", sort_order: 10 },
  report_portfolio_owner: { key: "report_portfolio_owner", group_name: "Báo cáo", label: "Báo cáo danh mục tuỳ chỉnh", unit: "lượt xem", kind: "quota", level_format: null, source: "enforced", default_cycle: "month", sort_order: 110 },
  digitize_posting: { key: "digitize_posting", group_name: "Tài sản", label: "Số hoá hồ sơ", unit: "hồ sơ", kind: "quota", level_format: null, source: "live", default_cycle: "month", sort_order: 20 },
  market_report: { key: "market_report", group_name: "Báo cáo", label: "Báo cáo thị trường", unit: "lượt xem", kind: "quota", level_format: null, source: "display", default_cycle: "month", sort_order: 120 },
  members: { key: "members", group_name: "Tổ chức", label: "Thành viên", unit: "người", kind: "quota", level_format: null, source: "live", default_cycle: "term", sort_order: 310 },
  support_response: { key: "support_response", group_name: "Hỗ trợ", label: "Hỗ trợ ưu tiên", unit: "giờ", kind: "level", level_format: "Phản hồi trong {n} giờ", source: "display", default_cycle: null, sort_order: 510 },
};

/** [khoá, hạn mức, chu kỳ?] — chu kỳ mặc định theo danh mục. */
const lines = (...rows: [string, number | null, BenefitCycle?][]): PlanBenefitLine[] =>
  rows.map(([key, quota, cycle], i) => ({
    benefit_key: key,
    quota,
    cycle: DEFS[key].kind === "level" ? null : cycle ?? DEFS[key].default_cycle,
    sort_order: i + 1,
    benefit: DEFS[key],
  }));

const plan = (over: Partial<OwnerSubPlan> & Pick<OwnerSubPlan, "id" | "name" | "sort_order">): OwnerSubPlan => ({
  fit_line: null,
  highlight_line: null,
  tier: "standard",
  monthly_price_vnd: 0,
  overage_mode: "credits",
  is_featured: false,
  is_active: true,
  benefits: [],
  ...over,
});

const basic = plan({
  id: "b", name: "Cơ bản", sort_order: 1, tier: "basic", monthly_price_vnd: 2_500_000,
  benefits: lines(["scan_3d_owner", 5], ["report_portfolio_owner", 20], ["digitize_posting", 20], ["members", 5], ["support_response", 48]),
});
const std = plan({
  id: "s", name: "Tiêu chuẩn", sort_order: 2, monthly_price_vnd: 4_500_000,
  benefits: lines(
    ["scan_3d_owner", 10], ["report_portfolio_owner", null], ["digitize_posting", 50],
    ["market_report", 10], ["members", 5], ["support_response", 8],
  ),
});
const pro = plan({
  id: "p", name: "Chuyên nghiệp", sort_order: 3, tier: "premium", monthly_price_vnd: 9_000_000,
  benefits: lines(["scan_3d_owner", 30], ["report_portfolio_owner", null], ["digitize_posting", null], ["support_response", 2]),
});
const plans = [basic, std, pro];

describe("planTermPrice — bản sao owner_sub_plan_price", () => {
  it("chiết khấu + làm tròn nghìn", () => {
    expect(planTermPrice(4_500_000, 6, 5)).toBe(25_650_000);
    expect(planTermPrice(9_000_000, 12, 10)).toBe(97_200_000);
    expect(planTermPrice(2_500_000, 3, 0)).toBe(7_500_000);
    expect(planTermPrice(1_234_567, 1, 0)).toBe(1_235_000);
  });
});

describe("planCardLines", () => {
  it("gói đầu liệt kê mọi thứ theo thứ tự admin xếp", () => {
    const l = planCardLines(null, basic);
    expect(l.map((x) => x.strong)).toEqual([
      "5 lượt quét / tháng",
      "20 lượt xem / tháng",
      "20 hồ sơ / tháng",
      "5 người",
      "Phản hồi trong 48 giờ",
    ]);
    expect(l[0].before).toBe("Quét 3D tài sản: ");
    expect(l.every((x) => !x.isNew)).toBe(true);
  });

  it("gói sau chỉ hiện dòng nâng lên; dòng gói trước không có là MỚI; giờ phản hồi nhỏ hơn là nâng", () => {
    const l = planCardLines(basic, std);
    expect(l.map((x) => x.key)).toEqual([
      "scan_3d_owner",
      "report_portfolio_owner",
      "digitize_posting",
      "market_report",
      "support_response",
    ]);
    expect(l.find((x) => x.key === "report_portfolio_owner")?.strong).toBe("Không giới hạn");
    expect(l.find((x) => x.key === "market_report")?.isNew).toBe(true);
  });

  it("đã không giới hạn ở gói trước ⇒ không lặp lại", () => {
    expect(planCardLines(std, pro).map((x) => x.key)).toEqual(["scan_3d_owner", "digitize_posting", "support_response"]);
  });

  it("chu kỳ khác nhau quy về mỗi tháng; cả kỳ ↔ theo lịch thì so theo chữ", () => {
    const weekly = plan({ id: "w", name: "Tuần", sort_order: 9, benefits: lines(["scan_3d_owner", 2, "week"]) });
    const monthly = plan({ id: "m", name: "Tháng", sort_order: 8, benefits: lines(["scan_3d_owner", 10, "month"]) });
    expect(planCardLines(monthly, weekly)).toEqual([]); // 2/tuần ≈ 8.7/tháng < 10
    const term = plan({ id: "t", name: "Kỳ", sort_order: 10, benefits: lines(["scan_3d_owner", 10, "term"]) });
    expect(planCardLines(monthly, term).map((x) => x.strong)).toEqual(["10 lượt quét"]);
  });
});

describe("compareGroups", () => {
  it("nhóm theo thứ tự xuất hiện của gói cao nhất trước", () => {
    const groups = compareGroups(plans, null);
    expect(groups.map((g) => g.group)).toEqual(["Tài sản", "Báo cáo", "Hỗ trợ", "Tổ chức"]);
    expect(groups[0].rows.map((r) => r.label)).toEqual(["Quét 3D tài sản", "Số hoá hồ sơ"]);
    expect(groups[3].rows[0].cells.p).toEqual({ text: "—", kind: "no", up: false });
    expect(groups[0].rows[0].cells.s.text).toBe("10 lượt quét / tháng");
  });

  it("đánh dấu ô tốt hơn gói hiện tại", () => {
    const [assets, reports, support] = compareGroups(plans, "s");
    expect(assets.rows[0].cells.p.up).toBe(true);
    expect(assets.rows[0].cells.b.up).toBe(false);
    expect(assets.rows[0].cells.s.up).toBe(false);
    // Báo cáo danh mục: gói hiện tại đã không giới hạn ⇒ không gì hơn.
    expect(reports.rows[0].cells.p.up).toBe(false);
    // Giờ phản hồi: 2 giờ tốt hơn 8 giờ, 48 giờ thì không.
    expect(support.rows[0].cells.p.up).toBe(true);
    expect(support.rows[0].cells.b.up).toBe(false);
  });
});

describe("planCta", () => {
  const ctx: Parameters<typeof planCta>[1] = { plans, currentPlanId: "s", hasPlan: true, pendingPlanId: null };

  it("chưa có gói ⇒ Đăng ký, gói cao nhất nút vàng", () => {
    const c: typeof ctx = { ...ctx, currentPlanId: null, hasPlan: false };
    expect(planCta(basic, c)).toEqual({ label: "Đăng ký Cơ bản", tone: "solid", disabled: false });
    expect(planCta(pro, c).tone).toBe("gold");
  });

  it("có gói ⇒ gói hiện tại khoá, cao hơn là Nâng cấp, thấp hơn là Chuyển sang", () => {
    expect(planCta(std, ctx)).toMatchObject({ label: "Gói hiện tại", disabled: true });
    expect(planCta(pro, ctx)).toMatchObject({ label: "Nâng cấp lên Chuyên nghiệp", tone: "gold" });
    expect(planCta(basic, ctx)).toMatchObject({ label: "Chuyển sang Cơ bản", tone: "ghost" });
  });

  it("gói riêng ⇒ Chuyển sang; đổi gói chờ áp dụng ⇒ khoá", () => {
    expect(planCta(basic, { ...ctx, currentPlanId: null })).toMatchObject({ label: "Chuyển sang Cơ bản", tone: "solid" });
    expect(planCta(pro, { ...ctx, pendingPlanId: "p" })).toMatchObject({ label: "Đã đặt từ kỳ sau", disabled: true });
  });
});

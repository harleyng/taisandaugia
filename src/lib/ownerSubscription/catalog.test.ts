import { describe, expect, it } from "vitest";
import {
  benefitMagnitude,
  compareGroups,
  planCardLines,
  planCta,
  planTermPrice,
} from "./catalog";
import type { OwnerSubPlan } from "./types";

const plan = (over: Partial<OwnerSubPlan> & Pick<OwnerSubPlan, "id" | "name" | "sort_order">): OwnerSubPlan => ({
  fit_line: null,
  highlight_line: null,
  tier: "standard",
  monthly_price_vnd: 0,
  overage_mode: "credits",
  is_featured: false,
  is_active: true,
  benefits: [],
  entitlements: [],
  ...over,
});

const basic = plan({
  id: "b", name: "Cơ bản", sort_order: 1, tier: "basic", monthly_price_vnd: 2_500_000,
  entitlements: [{ variant_key: "scan_3d_owner", monthly_quota: 5 }, { variant_key: "report_portfolio_owner", monthly_quota: 20 }],
  benefits: [
    { group: "Tài sản", label: "Số hoá hồ sơ", value: "20 hồ sơ / tháng" },
    { group: "Tổ chức", label: "Thành viên", value: "5 người" },
  ],
});
const std = plan({
  id: "s", name: "Tiêu chuẩn", sort_order: 2, monthly_price_vnd: 4_500_000,
  entitlements: [{ variant_key: "scan_3d_owner", monthly_quota: 10 }, { variant_key: "report_portfolio_owner", monthly_quota: null }],
  benefits: [
    { group: "Tài sản", label: "Số hoá hồ sơ", value: "50 hồ sơ / tháng" },
    { group: "Báo cáo", label: "Báo cáo thị trường", value: "10 lượt xem / tháng" },
    { group: "Tổ chức", label: "Thành viên", value: "5 người" },
  ],
});
const pro = plan({
  id: "p", name: "Chuyên nghiệp", sort_order: 3, tier: "premium", monthly_price_vnd: 9_000_000,
  entitlements: [{ variant_key: "scan_3d_owner", monthly_quota: 30 }, { variant_key: "report_portfolio_owner", monthly_quota: null }],
  benefits: [{ group: "Tài sản", label: "Số hoá hồ sơ", value: "Không giới hạn" }],
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

describe("benefitMagnitude", () => {
  it("đọc số đầu dòng, 'Không giới hạn' = ∞, chữ tự do = null", () => {
    expect(benefitMagnitude("1,000 thư / tháng")).toBe(1000);
    expect(benefitMagnitude("Không giới hạn")).toBe(Infinity);
    expect(benefitMagnitude("Hỗ trợ ưu tiên")).toBeNull();
    expect(benefitMagnitude(undefined)).toBeNull();
  });
});

describe("planCardLines", () => {
  it("gói đầu liệt kê mọi thứ", () => {
    const lines = planCardLines(null, basic);
    expect(lines.map((l) => l.strong)).toEqual(["5", "20", "20 hồ sơ / tháng", "5 người"]);
    expect(lines.every((l) => !l.isNew)).toBe(true);
  });

  it("gói sau chỉ hiện dòng nâng lên; dòng gói trước không có là MỚI", () => {
    const lines = planCardLines(basic, std);
    expect(lines.map((l) => l.key)).toEqual([
      "scan_3d_owner",
      "report_portfolio_owner",
      "Tài sản|Số hoá hồ sơ",
      "Báo cáo|Báo cáo thị trường",
    ]);
    expect(lines.find((l) => l.key === "report_portfolio_owner")?.strong).toBe("không giới hạn");
    expect(lines.find((l) => l.key === "Báo cáo|Báo cáo thị trường")?.isNew).toBe(true);
  });

  it("đã không giới hạn ở gói trước ⇒ không lặp lại", () => {
    expect(planCardLines(std, pro).map((l) => l.key)).toEqual(["scan_3d_owner", "Tài sản|Số hoá hồ sơ"]);
  });
});

describe("compareGroups", () => {
  it("nhóm theo thứ tự xuất hiện, tính năng hạn mức trước dòng quyền lợi", () => {
    const groups = compareGroups(plans, null);
    expect(groups.map((g) => g.group)).toEqual(["Tài sản", "Báo cáo", "Tổ chức"]);
    expect(groups[0].rows.map((r) => r.label)).toEqual(["Quét 3D tài sản", "Số hoá hồ sơ"]);
    expect(groups[2].rows[0].cells.p).toEqual({ text: "—", kind: "no", up: false });
    expect(groups[0].rows[0].cells.s.text).toBe("10 lượt / tháng");
  });

  it("đánh dấu ô tốt hơn gói hiện tại", () => {
    const [assets, reports] = compareGroups(plans, "s");
    expect(assets.rows[0].cells.p.up).toBe(true);
    expect(assets.rows[0].cells.b.up).toBe(false);
    expect(assets.rows[0].cells.s.up).toBe(false);
    // Báo cáo danh mục: gói hiện tại đã không giới hạn ⇒ không gì hơn.
    expect(reports.rows[0].cells.p.up).toBe(false);
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

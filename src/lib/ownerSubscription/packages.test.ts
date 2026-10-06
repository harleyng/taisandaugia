import { describe, expect, it } from "vitest";
import {
  packageMissing,
  packagePlansPayload,
  packagePriceRange,
  packageStats,
  blankPackageDraft,
  planQuotaCell,
  termInputError,
  toggleTerm,
} from "./packages";
import type { AdminOwnerSubRow, BenefitLineInput, AdminSubPackage, OwnerSubPlan, SubTerm } from "./types";

const plan = (id: string, price: number, is_active = true): OwnerSubPlan => ({
  id,
  name: id,
  fit_line: null,
  highlight_line: null,
  tier: "standard",
  monthly_price_vnd: price,
  overage_mode: "credits",
  is_featured: false,
  is_active,
  sort_order: 0,
  benefits: [],
});

const pkg = (over: Partial<AdminSubPackage>): AdminSubPackage => ({
  id: "k",
  name: "Bộ",
  description: null,
  is_default: false,
  is_active: true,
  featured_plan_id: null,
  updated_at: "2026-10-04T00:00:00Z",
  plans: [],
  term_ids: ["t12"],
  workspace_ids: ["w1"],
  ...over,
});

const row = (over: Partial<AdminOwnerSubRow>): AdminOwnerSubRow => ({
  workspace_id: "w",
  workspace_name: "Trạm",
  match_scope: "",
  parent_name: null,
  owner_name: null,
  owner_email: null,
  member_count: 1,
  workspace_created_at: "",
  subscription_id: "s",
  code: "GTB1",
  plan_name: "",
  status: "active",
  starts_on: null,
  ends_on: null,
  price_vnd: 0,
  term_months: 12,
  overage_mode: "credits",
  plan_id: null,
  assigned_package_id: null,
  package_id: "k",
  ...over,
});

const LIB: SubTerm[] = [
  { id: "t3", months: 3, discount_pct: 0, note: null },
  { id: "t12", months: 12, discount_pct: 10, note: null },
  { id: "t12nh", months: 12, discount_pct: 15, note: "HĐ ngân hàng" },
];

describe("toggleTerm — một bộ không có hai kỳ trùng số tháng", () => {
  it("bật kỳ trùng số tháng thì thay kỳ cũ", () => {
    expect(toggleTerm(["t3", "t12"], LIB[2], LIB)).toEqual(["t3", "t12nh"]);
  });
  it("tắt kỳ đang chọn", () => {
    expect(toggleTerm(["t3", "t12"], LIB[0], LIB)).toEqual(["t12"]);
  });
});

describe("termInputError", () => {
  it("chặn ngoài khoảng và trùng (tháng, %)", () => {
    expect(termInputError({ months: "0", discount: "0", note: "" }, LIB, null)).toMatch(/1 đến 36/);
    expect(termInputError({ months: "12", discount: "60", note: "" }, LIB, null)).toMatch(/0 đến 50/);
    expect(termInputError({ months: "12", discount: "", note: "" }, LIB, null)).toMatch(/0 đến 50/);
    expect(termInputError({ months: "12", discount: "10", note: "" }, LIB, null)).toBe("Trùng kỳ đã có.");
    expect(termInputError({ months: "12", discount: "10", note: "" }, LIB, "t12")).toBeNull();
    expect(termInputError({ months: "24", discount: "18", note: "" }, LIB, null)).toBeNull();
  });
});

describe("packageStats", () => {
  const k = pkg({ plans: [plan("a", 1), plan("b", 2, false)] });
  it("đếm Trạm đang dùng, thành viên và Trạm không gia hạn được", () => {
    const rows = [
      row({ workspace_id: "1", plan_id: "a" }),
      row({ workspace_id: "2", plan_id: "b" }), // gói ngừng bán
      row({ workspace_id: "3", plan_id: "a", package_id: "other" }), // đã chuyển bộ
      row({ workspace_id: "4", plan_id: "a", status: "expired" }), // không còn chạy
      row({ workspace_id: "5", subscription_id: null, plan_id: null, status: null }),
    ];
    const s = packageStats(k, rows);
    expect(s.using.map((r) => r.workspace_id)).toEqual(["1", "2", "3"]);
    expect(s.members.map((r) => r.workspace_id)).toEqual(["1", "2", "4", "5"]);
    expect(s.stuck.map((r) => r.workspace_id)).toEqual(["2", "3"]);
    expect(s.issues.map((i) => i.key)).toEqual(["stuck"]);
  });
  it("cảnh báo thiếu cấu hình — bộ mặc định không cần gán tổ chức", () => {
    expect(packageStats(pkg({ workspace_ids: [], term_ids: [] }), []).issues.map((i) => i.key)).toEqual(["noorg", "noplan", "noterm"]);
    expect(packageStats(pkg({ is_default: true, workspace_ids: [], plans: [plan("a", 1)] }), []).issues).toEqual([]);
    expect(packageStats(pkg({ is_active: false, workspace_ids: [] }), []).issues).toEqual([]);
  });
});

describe("packagePriceRange", () => {
  it("chỉ tính gói đang bán", () => {
    expect(packagePriceRange(pkg({ plans: [plan("a", 2_500_000), plan("b", 9_000_000), plan("c", 50_000_000, false)] }))).toBe("2.5–9 tr");
    expect(packagePriceRange(pkg({ plans: [plan("a", 900_000)] }))).toBe("900,000 ₫");
    expect(packagePriceRange(pkg({ plans: [] }))).toBe("—");
  });
});

describe("packagePlansPayload / packageMissing", () => {
  it("gói đã có chỉ gửi id, gói mới gửi đủ trường; featured theo key", () => {
    const d = {
      ...blankPackageDraft(),
      name: "Ngân hàng",
      term_ids: ["t12"],
      featured_key: "new-1",
      plans: [
        { key: "p1", id: "p1", name: "A", fit_line: "", highlight_line: "", tier: "basic" as const, monthly_price_vnd: 1, overage_mode: "block" as const, is_active: true, benefits: [] as BenefitLineInput[] },
        { key: "new-1", id: null as string | null, name: " B ", fit_line: "", highlight_line: "", tier: "premium" as const, monthly_price_vnd: 2, overage_mode: "block" as const, is_active: true, benefits: [] as BenefitLineInput[] },
      ],
    };
    const out = packagePlansPayload(d);
    expect(out[0]).toEqual({ id: "p1", featured: false });
    expect(out[1]).toMatchObject({ name: "B", tier: "premium", featured: true });
    expect(packageMissing(d)).toEqual([]);
    expect(packageMissing(blankPackageDraft())).toEqual(["tên bộ", "ít nhất 1 gói", "ít nhất 1 kỳ mua"]);
  });
  it("planQuotaCell", () => {
    const p = { benefits: [{ benefit_key: "scan_3d_owner", quota: 1200, cycle: "month" as const }, { benefit_key: "x", quota: null, cycle: "month" as const }] };
    expect(planQuotaCell(p, "scan_3d_owner")).toBe("1,200");
    expect(planQuotaCell(p, "x")).toBe("∞");
    expect(planQuotaCell(p, "y")).toBe("—");
  });
});

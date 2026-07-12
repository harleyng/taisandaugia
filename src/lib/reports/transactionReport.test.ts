import { describe, it, expect, vi } from "vitest";

// credits.ts import chuỗi tới supabase client (cần env) — mock để test thuần logic.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  aggregateTransactionReport,
  resolvePurchase,
  isPurchase,
  isConsumption,
  type RawTxRow,
} from "./transactionReport";

const row = (over: Partial<RawTxRow>): RawTxRow => ({
  id: Math.random().toString(36).slice(2),
  user_id: "u",
  type: "purchase",
  description: "",
  credit_delta: 0,
  created_at: "2026-07-01T10:00:00",
  profiles: null,
  ...over,
});

describe("resolvePurchase", () => {
  it("map đúng giá VND theo tên gói legacy trong description", () => {
    expect(resolvePurchase(row({ description: "Mua gói Popular", credit_delta: 190 }))).toEqual({
      vnd: 179_000,
      packageKey: "popular",
      label: "Popular",
      audience: null,
      groupName: null,
    });
    expect(resolvePurchase(row({ description: "Mua gói Starter", credit_delta: 69 })).vnd).toBe(69_000);
  });

  it("ưu tiên biến thể embed (variant.price) hơn khớp tên", () => {
    const r = resolvePurchase(
      row({
        description: "Mua gói X [demo]",
        credit_delta: 116,
        variant_key: "buyer_ts_cao_cap",
        variant: {
          price: 2_500_000,
          name: "Thợ Săn Cao Cấp",
          variant_key: "buyer_ts_cao_cap",
          group: { name: "Gói credit Người mua", audience: "buyer" },
        },
      }),
    );
    expect(r).toEqual({
      vnd: 2_500_000,
      packageKey: "buyer_ts_cao_cap",
      label: "Thợ Săn Cao Cấp",
      audience: "buyer",
      groupName: "Gói credit Người mua",
    });
  });

  it("không khớp gói → Nạp khác, vnd 0 (không đoán theo credit_delta)", () => {
    const r = resolvePurchase(row({ description: "Nạp 59 tín dụng", credit_delta: 59 }));
    expect(r).toEqual({ vnd: 0, packageKey: null, label: "Nạp khác", audience: null, groupName: null });
  });
});

describe("predicates", () => {
  it("purchase âm (xuất hồ sơ ghi nhầm) = tiêu dùng, không phải doanh thu", () => {
    const mislabeled = row({ type: "purchase", credit_delta: -50, description: "Nạp -50 tín dụng" });
    expect(isPurchase(mislabeled)).toBe(false);
    expect(isConsumption(mislabeled)).toBe(true);
  });
});

describe("aggregateTransactionReport", () => {
  const rows: RawTxRow[] = [
    row({ id: "r1", user_id: "A", type: "purchase", credit_delta: 190, description: "Mua gói Popular", created_at: "2026-07-01T10:00:00", profiles: { name: "An", email: "an@x.vn" } }),
    row({ id: "r2", user_id: "B", type: "purchase", credit_delta: 69, description: "Mua gói Starter", created_at: "2026-07-01T12:00:00", profiles: { name: null, email: "b@x.vn" } }),
    row({ id: "r3", user_id: "A", type: "purchase", credit_delta: 59, description: "Nạp 59 tín dụng", created_at: "2026-07-02T09:00:00" }),
    row({ id: "r4", user_id: "C", type: "unlock_asset", credit_delta: -59, description: "Mở khóa tài sản X", created_at: "2026-07-02T10:00:00" }),
    row({ id: "r5", user_id: "C", type: "purchase", credit_delta: -50, description: "Nạp -50 tín dụng", created_at: "2026-07-03T10:00:00" }),
    row({ id: "r6", user_id: "A", type: "unlock_company", credit_delta: -299, description: "Theo dõi công ty Y", created_at: "2026-07-03T11:00:00" }),
  ];
  const range = { from: new Date(2026, 6, 1), to: new Date(2026, 6, 3) };
  const rep = aggregateTransactionReport(rows, range, "day");

  it("KPIs suy ra doanh thu đúng, loại 'Nạp khác' khỏi VND & avg", () => {
    expect(rep.kpis.totalVnd).toBe(248_000); // 179k + 69k + 0
    expect(rep.kpis.creditsSold).toBe(318); // 190 + 69 + 59
    expect(rep.kpis.creditsSpent).toBe(408); // 59 + 50 + 299
    expect(rep.kpis.payingUsers).toBe(2); // A, B
    expect(rep.kpis.purchaseCount).toBe(3);
    expect(rep.kpis.avgOrderVnd).toBe(124_000); // 248k / 2 đơn có giá
  });

  it("byPackage gồm Nạp khác với vndKnown=false", () => {
    const other = rep.byPackage.find((p) => p.key === "other");
    expect(other).toMatchObject({ vnd: 0, credits: 59, count: 1, vndKnown: false });
    expect(rep.byPackage.find((p) => p.key === "popular")?.vnd).toBe(179_000);
  });

  it("byFeature gộp theo tính năng, gồm 'Xuất hồ sơ' từ purchase âm", () => {
    const labels = rep.byFeature.map((f) => f.label);
    expect(labels).toContain("Xuất hồ sơ");
    expect(labels).toContain("Mở khóa tài sản");
    expect(labels).toContain("Theo dõi công ty");
    expect(rep.byFeature[0].label).toBe("Theo dõi công ty"); // sắp desc theo credit (299)
  });

  it("timeSeries đủ 3 bucket, fill 0", () => {
    expect(rep.timeSeries).toHaveLength(3);
    expect(rep.timeSeries[0]).toMatchObject({ vnd: 248_000, credits: 259 });
    expect(rep.timeSeries[1]).toMatchObject({ vnd: 0, credits: 59 });
    expect(rep.timeSeries[2]).toMatchObject({ vnd: 0, credits: 0 });
  });

  it("transactions sắp mới nhất trước, nhãn & VND đúng", () => {
    expect(rep.transactions[0].id).toBe("r6");
    expect(rep.transactions[0]).toMatchObject({ kind: "spend", label: "Theo dõi công ty" });
    const r1 = rep.transactions.find((t) => t.id === "r1")!;
    expect(r1).toMatchObject({ kind: "topup", label: "Popular", vnd: 179_000, vndKnown: true, userName: "An" });
    const r2 = rep.transactions.find((t) => t.id === "r2")!;
    expect(r2.userName).toBe("b@x.vn"); // name null → fallback email
    const r3 = rep.transactions.find((t) => t.id === "r3")!;
    expect(r3).toMatchObject({ kind: "topup", label: "Nạp khác", vndKnown: false });
  });

  it("admin_grant (cộng credit, không phải mua) = topup, KHÔNG vào doanh thu/tiêu dùng", () => {
    const withGrant = [
      ...rows,
      row({ id: "g1", user_id: "D", type: "admin_grant", credit_delta: 100, description: "Admin tặng 100", created_at: "2026-07-02T08:00:00" }),
    ];
    const r = aggregateTransactionReport(withGrant, range, "day");
    expect(r.kpis.totalVnd).toBe(248_000); // không đổi
    expect(r.kpis.creditsSold).toBe(318); // không cộng admin_grant
    expect(r.kpis.creditsSpent).toBe(408); // không cộng admin_grant
    const g = r.transactions.find((t) => t.id === "g1")!;
    expect(g).toMatchObject({ kind: "topup", label: "Admin tặng", credits: 100 });
    // không lọt vào byPackage/byFeature
    expect(r.byPackage.some((p) => p.credits === 100)).toBe(false);
    expect(r.byFeature.some((f) => f.type === "admin_grant")).toBe(false);
  });
});

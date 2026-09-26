import { describe, it, expect } from "vitest";
import {
  SCOPE_ALL,
  computeTargetProgress,
  currentTargets,
  findTarget,
  periodContains,
  periodEndOf,
  periodLabel,
  periodOptions,
  periodStartOf,
  recoveryInputsFromOverview,
  recoveryOf,
  shiftPeriod,
  summarizeRecovery,
  targetFormSchema,
  toTargetWrite,
  type OwnerTarget,
  type RecoveryInput,
  type RecoveryScope,
  type RecoverySourceRow,
} from "./ownerTargets";

const TODAY = "2026-09-26";

const target = (over: Partial<OwnerTarget> = {}): OwnerTarget => ({
  id: "t1",
  workspaceId: "ws",
  branchId: null,
  periodType: "month",
  periodStart: "2026-09-01",
  targetAmount: 20_000_000_000,
  targetCount: null,
  ...over,
});

const sold = (over: Partial<RecoveryInput> = {}): RecoveryInput => ({
  day: "2026-09-10",
  branchId: "b1",
  price: 1_000_000_000,
  paymentStatus: null,
  paidAmount: null,
  ...over,
});

const SEPT: RecoveryScope = { start: "2026-09-01", end: "2026-09-30", branchId: null };

describe("kỳ", () => {
  it("ngày đầu kỳ", () => {
    expect(periodStartOf("month", "2026-09-26")).toBe("2026-09-01");
    expect(periodStartOf("quarter", "2026-09-26")).toBe("2026-07-01");
    expect(periodStartOf("quarter", "2026-10-01")).toBe("2026-10-01");
    expect(periodStartOf("quarter", "2026-03-31")).toBe("2026-01-01");
    expect(periodStartOf("year", "2026-09-26")).toBe("2026-01-01");
  });

  it("ngày cuối kỳ (tính cả ngày đó), kể cả tháng 2 năm nhuận và quý IV", () => {
    expect(periodEndOf("month", "2028-02-01")).toBe("2028-02-29");
    expect(periodEndOf("month", "2026-02-01")).toBe("2026-02-28");
    expect(periodEndOf("month", "2026-09-01")).toBe("2026-09-30");
    expect(periodEndOf("quarter", "2026-10-01")).toBe("2026-12-31");
    expect(periodEndOf("quarter", "2026-01-01")).toBe("2026-03-31");
    expect(periodEndOf("year", "2026-01-01")).toBe("2026-12-31");
  });

  it("dời kỳ qua năm", () => {
    expect(shiftPeriod("month", "2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftPeriod("month", "2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftPeriod("quarter", "2026-10-01", 1)).toBe("2027-01-01");
    expect(shiftPeriod("year", "2026-01-01", 1)).toBe("2027-01-01");
  });

  it("nhãn tiếng Việt", () => {
    expect(periodLabel("month", "2026-09-01")).toBe("tháng 9/2026");
    expect(periodLabel("quarter", "2026-07-01")).toBe("quý III/2026");
    expect(periodLabel("quarter", "2026-10-01")).toBe("quý IV/2026");
    expect(periodLabel("year", "2026-01-01")).toBe("năm 2026");
  });

  it("lựa chọn kỳ bắt đầu từ kỳ hiện tại", () => {
    expect(periodOptions("month", TODAY).map((o) => o.start)).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
    expect(periodOptions("quarter", TODAY)[0]).toEqual({ start: "2026-07-01", label: "quý III/2026" });
    expect(periodOptions("year", TODAY).map((o) => o.start)).toEqual(["2026-01-01", "2027-01-01"]);
  });

  it("biên kỳ tính cả hai đầu", () => {
    expect(periodContains("month", "2026-09-01", "2026-09-01")).toBe(true);
    expect(periodContains("month", "2026-09-01", "2026-09-30")).toBe(true);
    expect(periodContains("month", "2026-09-01", "2026-10-01")).toBe(false);
    expect(periodContains("month", "2026-09-01", "2026-08-31")).toBe(false);
  });
});

describe("recoveryOf — luật 'Đã thu' theo tiền thật", () => {
  it("đã thu đủ: số đã thu, thiếu thì lấy giá trúng", () => {
    expect(recoveryOf(sold({ paymentStatus: "paid", paidAmount: 900_000_000 }))).toMatchObject({
      counted: true,
      recorded: 900_000_000,
      awaiting: 0,
    });
    expect(recoveryOf(sold({ paymentStatus: "paid" })).recorded).toBe(1_000_000_000);
  });

  it("thu một phần: phần đã thu vào 'đã ghi thu', phần còn lại vào 'chờ thu'", () => {
    expect(recoveryOf(sold({ paymentStatus: "partial", paidAmount: 300_000_000 }))).toEqual({
      counted: true,
      recorded: 300_000_000,
      estimated: 0,
      awaiting: 700_000_000,
    });
  });

  it("chưa thu: 0 đã thu, cả giá trúng vào 'chờ thu'", () => {
    expect(recoveryOf(sold({ paymentStatus: "pending" }))).toEqual({
      counted: true,
      recorded: 0,
      estimated: 0,
      awaiting: 1_000_000_000,
    });
  });

  it("bỏ cọc: loại hẳn, kể cả số đã thu còn lưu", () => {
    expect(recoveryOf(sold({ paymentStatus: "defaulted", paidAmount: 100_000_000 }))).toEqual({
      counted: false,
      recorded: 0,
      estimated: 0,
      awaiting: 0,
    });
  });

  it("nguồn không theo dõi thu tiền: tạm tính bằng giá trúng", () => {
    expect(recoveryOf(sold({ paymentStatus: null }))).toMatchObject({ estimated: 1_000_000_000, recorded: 0 });
    expect(recoveryOf(sold({ paymentStatus: null, price: null }))).toMatchObject({ counted: true, estimated: 0 });
  });

  it("ghi thu một phần KHÔNG làm tụt số đã thu so với chưa thu", () => {
    const pending = recoveryOf(sold({ paymentStatus: "pending" }));
    const partial = recoveryOf(sold({ paymentStatus: "partial", paidAmount: 1 }));
    expect(partial.recorded + partial.estimated).toBeGreaterThan(pending.recorded + pending.estimated);
  });
});

describe("summarizeRecovery", () => {
  const inputs: RecoveryInput[] = [
    sold({ paymentStatus: "paid", paidAmount: 2_000_000_000 }),
    sold({ paymentStatus: "partial", paidAmount: 400_000_000, branchId: "b2" }),
    sold({ paymentStatus: "pending", price: 3_000_000_000 }),
    sold({ paymentStatus: "defaulted" }),
    sold({ paymentStatus: null, price: 500_000_000, branchId: null }),
    sold({ day: null }),
    sold({ day: "2026-08-31" }),
    sold({ day: "2026-10-01" }),
  ];

  it("cộng theo kỳ, bỏ bỏ-cọc / không ngày / ngoài kỳ", () => {
    expect(summarizeRecovery(inputs, SEPT)).toEqual({
      collected: 2_900_000_000,
      recorded: 2_400_000_000,
      estimated: 500_000_000,
      awaiting: 3_600_000_000,
      soldCount: 4,
    });
  });

  it("biên kỳ tính cả ngày đầu và ngày cuối", () => {
    const edges = [sold({ day: "2026-09-01" }), sold({ day: "2026-09-30" })];
    expect(summarizeRecovery(edges, SEPT).soldCount).toBe(2);
  });

  it("lọc chi nhánh: chỉ đúng chi nhánh, tài sản không chi nhánh chỉ vào 'cả đơn vị'", () => {
    expect(summarizeRecovery(inputs, { ...SEPT, branchId: "b2" })).toMatchObject({
      soldCount: 1,
      collected: 400_000_000,
    });
    expect(summarizeRecovery(inputs, { ...SEPT, branchId: "b1" }).soldCount).toBe(2);
  });
});

describe("recoveryInputsFromOverview", () => {
  const row = (over: Partial<RecoverySourceRow> = {}): RecoverySourceRow => ({
    outcome: "sold",
    date: "2026-09-20",
    branchId: "b1",
    price: 6_000_000_000,
    paymentStatus: "partial",
    paidAmount: 1_500_000_000,
    ...over,
  });

  it("mỗi dòng đã bán thành một đầu vào; bỏ các kết quả khác", () => {
    const inputs = recoveryInputsFromOverview([
      row(),
      row({ outcome: "unsold", price: null, paymentStatus: null, paidAmount: null }),
      row({ outcome: "postponed" }),
      row({ outcome: null }),
    ]);
    expect(inputs).toEqual([
      { day: "2026-09-20", branchId: "b1", price: 6_000_000_000, paymentStatus: "partial", paidAmount: 1_500_000_000 },
    ]);
  });

  it("giữ nguyên tài sản không thuộc chi nhánh nào (chỉ vào chỉ tiêu cả đơn vị)", () => {
    const [input] = recoveryInputsFromOverview([row({ branchId: null })]);
    expect(summarizeRecovery([input], { ...SEPT, branchId: "b1" }).soldCount).toBe(0);
    expect(summarizeRecovery([input], SEPT).soldCount).toBe(1);
  });
});

describe("computeTargetProgress", () => {
  const inputs = [
    sold({ paymentStatus: "paid", paidAmount: 8_000_000_000 }),
    sold({ paymentStatus: null, price: 4_000_000_000 }),
    sold({ paymentStatus: "pending", price: 3_000_000_000 }),
  ];

  it("phần trăm, ngày còn lại (gồm hôm nay), nhịp mỗi tuần", () => {
    const p = computeTargetProgress(target({ targetCount: 5 }), inputs, "2026-09-16");
    expect(p.summary.collected).toBe(12_000_000_000);
    expect(p.amountPct).toBe(60);
    expect(p.countPct).toBe(60);
    expect(p.daysLeft).toBe(15);
    expect(p.amountRemaining).toBe(8_000_000_000);
    expect(p.weeklyAmountPace).toBe(Math.ceil(8_000_000_000 / (15 / 7)));
    expect(p.weeklyCountPace).toBe(1);
    expect(p.achieved).toBe(false);
    expect(p.periodLabel).toBe("tháng 9/2026");
  });

  it("tuần cuối: dồn cả phần thiếu vào một tuần", () => {
    const p = computeTargetProgress(target(), inputs, "2026-09-28");
    expect(p.daysLeft).toBe(3);
    expect(p.weeklyAmountPace).toBe(8_000_000_000);
  });

  it("đã đạt: không còn nhịp", () => {
    const p = computeTargetProgress(target({ targetAmount: 10_000_000_000 }), inputs, TODAY);
    expect(p.achieved).toBe(true);
    expect(p.amountPct).toBe(120);
    expect(p.weeklyAmountPace).toBeNull();
  });

  it("kỳ đã hết: 0 ngày, không nhịp", () => {
    const p = computeTargetProgress(target(), inputs, "2026-10-02");
    expect(p.daysLeft).toBe(0);
    expect(p.weeklyAmountPace).toBeNull();
  });

  it("chỉ tiêu chỉ có số tài sản", () => {
    const p = computeTargetProgress(target({ targetAmount: null, targetCount: 3 }), inputs, TODAY);
    expect(p.amountPct).toBeNull();
    expect(p.countPct).toBe(100);
    expect(p.achieved).toBe(true);
  });
});

describe("chọn chỉ tiêu", () => {
  const all = [
    target({ id: "y", periodType: "year", periodStart: "2026-01-01" }),
    target({ id: "b", branchId: "b1" }),
    target({ id: "q", periodType: "quarter", periodStart: "2026-07-01" }),
    target({ id: "m" }),
    target({ id: "old", periodStart: "2026-08-01" }),
    target({ id: "next", periodStart: "2026-10-01" }),
  ];

  it("kỳ đang diễn ra; cả đơn vị trước, tháng → quý → năm", () => {
    expect(currentTargets(all, TODAY).map((t) => t.id)).toEqual(["m", "q", "y", "b"]);
  });

  it("tìm đúng kỳ + phạm vi", () => {
    expect(findTarget(all, "month", "2026-09-01", SCOPE_ALL)?.id).toBe("m");
    expect(findTarget(all, "month", "2026-09-01", "b1")?.id).toBe("b");
    expect(findTarget(all, "month", "2026-09-01", "b2")).toBeNull();
  });
});

describe("form chỉ tiêu", () => {
  const valid = { periodType: "month" as const, periodStart: "2026-09-01", scope: SCOPE_ALL, amount: "", count: "" };

  it("phải có số tiền hoặc số tài sản", () => {
    expect(targetFormSchema.safeParse(valid).success).toBe(false);
    expect(targetFormSchema.safeParse({ ...valid, count: "0" }).success).toBe(false);
    expect(targetFormSchema.safeParse({ ...valid, amount: "20000000000" }).success).toBe(true);
    expect(targetFormSchema.safeParse({ ...valid, count: "12" }).success).toBe(true);
  });

  it("ghi: 0/rỗng ⇒ NULL, 'Toàn đơn vị' ⇒ branch_id NULL", () => {
    expect(toTargetWrite({ ...valid, amount: "20000000000", count: "0" }, "ws")).toEqual({
      workspace_id: "ws",
      branch_id: null,
      period_type: "month",
      period_start: "2026-09-01",
      target_amount: 20_000_000_000,
      target_count: null,
    });
    expect(toTargetWrite({ ...valid, scope: "b1", count: "3" }, "ws")).toMatchObject({
      branch_id: "b1",
      target_amount: null,
      target_count: 3,
    });
  });
});

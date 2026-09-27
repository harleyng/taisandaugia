import { describe, it, expect } from "vitest";
import {
  SCOPE_ALL,
  TARGET_METRICS,
  actualOf,
  autoTargetName,
  computeTargetProgress,
  criterionBreakdown,
  currentTargets,
  findTarget,
  groupTargetsByStatus,
  mapTargetRow,
  nextUnusedMetric,
  ownerTargetOf,
  periodContains,
  periodEndOf,
  periodLabel,
  periodOptions,
  periodStartOf,
  recoveryOf,
  shiftPeriod,
  summarizeTargetInputs,
  targetDisplayName,
  targetFormDefaults,
  targetFormSchema,
  targetInputsFromOverview,
  targetStatus,
  targetTiming,
  toTargetSaveArgs,
  type OwnerTarget,
  type OwnerTargetRow,
  type RecoveryScope,
  type RecoverySourceRow,
  type TargetCriterion,
  type TargetInput,
} from "./ownerTargets";

const TODAY = "2026-09-26";

/** Mặc định: 1 tiêu chí tiền thu hồi 20 tỷ. `amount`/`count` = lối tắt cho 2 tiêu chí cũ. */
const target = (
  over: Partial<Omit<OwnerTarget, "targetAmount" | "targetCount">> & { amount?: number | null; count?: number | null } = {},
): OwnerTarget => {
  const { amount = 20_000_000_000, count = null, criteria, ...rest } = over;
  const legacy: TargetCriterion[] = [
    ...(amount !== null ? [{ metric: "recovered_amount" as const, goal: amount }] : []),
    ...(count !== null ? [{ metric: "sold_count" as const, goal: count }] : []),
  ];
  return ownerTargetOf({
    id: "t1",
    workspaceId: "ws",
    branchId: null,
    periodType: "month",
    periodStart: "2026-09-01",
    name: null,
    criteria: criteria ?? legacy,
    ...rest,
  });
};

let seq = 0;
const sold = (over: Partial<TargetInput> = {}): TargetInput => ({
  key: `r${++seq}`,
  outcome: "sold",
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

describe("summarizeTargetInputs", () => {
  const inputs: TargetInput[] = [
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
    expect(summarizeTargetInputs(inputs, SEPT)).toEqual({
      collected: 2_900_000_000,
      recorded: 2_400_000_000,
      estimated: 500_000_000,
      awaiting: 3_600_000_000,
      soldCount: 4,
      // Giá trúng của 4 tài sản đấu thành (bỏ cọc không tính).
      winningTotal: 5_500_000_000,
      // Đưa ra đấu giá: cả tài sản bỏ cọc.
      offeredCount: 5,
    });
  });

  it("đưa ra đấu giá đếm mọi kết quả; tài sản không thành không vào tiền / đấu thành", () => {
    const mixed = [
      sold(),
      sold({ outcome: "unsold", price: null }),
      sold({ outcome: "postponed", price: null }),
      sold({ outcome: "cancelled", price: null, day: "2026-10-02" }),
    ];
    expect(summarizeTargetInputs(mixed, SEPT)).toMatchObject({ offeredCount: 3, soldCount: 1, winningTotal: 1_000_000_000 });
  });

  it("biên kỳ tính cả ngày đầu và ngày cuối", () => {
    const edges = [sold({ day: "2026-09-01" }), sold({ day: "2026-09-30" })];
    expect(summarizeTargetInputs(edges, SEPT).soldCount).toBe(2);
  });

  it("lọc chi nhánh: chỉ đúng chi nhánh, tài sản không chi nhánh chỉ vào 'cả đơn vị'", () => {
    expect(summarizeTargetInputs(inputs, { ...SEPT, branchId: "b2" })).toMatchObject({
      soldCount: 1,
      collected: 400_000_000,
    });
    expect(summarizeTargetInputs(inputs, { ...SEPT, branchId: "b1" }).soldCount).toBe(2);
  });
});

describe("targetInputsFromOverview", () => {
  const row = (over: Partial<RecoverySourceRow> = {}): RecoverySourceRow => ({
    rowKey: "k1",
    outcome: "sold",
    date: "2026-09-20",
    branchId: "b1",
    price: 6_000_000_000,
    paymentStatus: "partial",
    paidAmount: 1_500_000_000,
    ...over,
  });

  it("mỗi dòng có kết quả thành một đầu vào (giữ row_key); bỏ dòng chưa có kết quả", () => {
    const inputs = targetInputsFromOverview([
      row(),
      row({ rowKey: "k2", outcome: "unsold", price: null, paymentStatus: null, paidAmount: null }),
      row({ rowKey: "k3", outcome: null }),
    ]);
    expect(inputs).toEqual([
      {
        key: "k1",
        outcome: "sold",
        day: "2026-09-20",
        branchId: "b1",
        price: 6_000_000_000,
        paymentStatus: "partial",
        paidAmount: 1_500_000_000,
      },
      { key: "k2", outcome: "unsold", day: "2026-09-20", branchId: "b1", price: null, paymentStatus: null, paidAmount: null },
    ]);
  });

  it("giữ nguyên tài sản không thuộc chi nhánh nào (chỉ vào chỉ tiêu cả đơn vị)", () => {
    const [input] = targetInputsFromOverview([row({ branchId: null })]);
    expect(summarizeTargetInputs([input], { ...SEPT, branchId: "b1" }).soldCount).toBe(0);
    expect(summarizeTargetInputs([input], SEPT).soldCount).toBe(1);
  });
});

describe("computeTargetProgress", () => {
  const inputs = [
    sold({ paymentStatus: "paid", paidAmount: 8_000_000_000 }),
    sold({ paymentStatus: null, price: 4_000_000_000 }),
    sold({ paymentStatus: "pending", price: 3_000_000_000 }),
  ];

  it("phần trăm, ngày còn lại (gồm hôm nay), nhịp mỗi tuần", () => {
    const p = computeTargetProgress(target({ count: 5 }), inputs, "2026-09-16");
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
    const p = computeTargetProgress(target({ amount: 10_000_000_000 }), inputs, TODAY);
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
    const p = computeTargetProgress(target({ amount: null, count: 3 }), inputs, TODAY);
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

  it("kỳ: đang diễn ra tính cả ngày đầu và ngày cuối kỳ", () => {
    expect(targetTiming(target({ id: "m" }), "2026-09-01")).toBe("current");
    expect(targetTiming(target({ id: "m" }), "2026-09-30")).toBe("current");
    expect(targetTiming(target({ id: "m" }), "2026-08-31")).toBe("upcoming");
    expect(targetTiming(target({ id: "m" }), "2026-10-01")).toBe("past");
  });

  it("chia nhóm theo trạng thái: kỳ chưa hết là đang thực hiện (kể cả đã đạt), hết kỳ mới chốt đạt / không đạt", () => {
    const more = [
      ...all,
      target({ id: "next-b", branchId: "b1", periodStart: "2026-10-01" }),
      target({ id: "far", periodStart: "2026-12-01" }),
      target({ id: "older", periodStart: "2026-06-01", amount: 1_000_000_000 }),
      target({ id: "q2", periodType: "quarter", periodStart: "2026-04-01", amount: 500_000_000 }),
      target({ id: "hit", branchId: "b2", amount: 1_000_000_000 }),
    ];
    const inputs = [
      sold({ day: "2026-06-10", branchId: null, price: 2_000_000_000, paymentStatus: "paid", paidAmount: null }),
      sold({ day: "2026-09-10", branchId: "b2", price: 2_000_000_000, paymentStatus: "paid", paidAmount: null }),
    ];
    const progress = more.map((t) => computeTargetProgress(t, inputs, TODAY));
    const groups = groupTargetsByStatus(progress, TODAY);
    const ids = (list: { target: OwnerTarget }[]) => list.map((p) => p.target.id);

    // "hit" đã đạt nhưng tháng 9 chưa hết ⇒ vẫn đang thực hiện.
    expect(ids(groups.in_progress)).toEqual(["m", "q", "y", "b", "hit", "next", "next-b", "far"]);
    expect(ids(groups.completed)).toEqual(["older", "q2"]);
    expect(ids(groups.failed)).toEqual(["old"]);
    expect(targetStatus(progress.find((p) => p.target.id === "hit")!, TODAY)).toBe("in_progress");
  });

});

describe("tiêu chí", () => {
  const inputs = [
    sold({ paymentStatus: "paid", paidAmount: 800_000_000 }),
    sold({ paymentStatus: "pending", price: 3_000_000_000 }),
    sold({ paymentStatus: "defaulted", price: 9_000_000_000 }),
    sold({ outcome: "unsold", price: null }),
    sold({ day: "2026-08-10" }),
  ];
  const all = target({
    criteria: [
      { metric: "winning_total", goal: 5_000_000_000 },
      { metric: "offered_count", goal: 4 },
      { metric: "recovered_amount", goal: 1_000_000_000 },
      { metric: "sold_count", goal: 2 },
    ],
  });

  it("mỗi tiêu chí: thực tế, %, còn thiếu, đạt; giữ thứ tự tiêu chí", () => {
    const p = computeTargetProgress(all, inputs, "2026-09-16");
    expect(p.criteria.map((c) => [c.metric, c.actual, c.pct, c.remaining, c.met])).toEqual([
      ["winning_total", 4_000_000_000, 80, 1_000_000_000, false],
      ["offered_count", 4, 100, 0, true],
      ["recovered_amount", 800_000_000, 80, 200_000_000, false],
      ["sold_count", 2, 100, 0, true],
    ]);
    expect(p.metCount).toBe(2);
    expect(p.overallPct).toBe(90);
    expect(p.achieved).toBe(false);
    // Tổng quan vẫn đọc 2 tiêu chí cũ.
    expect(p.amountPct).toBe(80);
    expect(p.countPct).toBe(100);
    expect(p.weeklyAmountPace).toBe(Math.ceil(200_000_000 / (15 / 7)));
  });

  it("tiến độ chung: mỗi tiêu chí tối đa 100%, làm tròn xuống", () => {
    const p = computeTargetProgress(
      target({ criteria: [{ metric: "sold_count", goal: 1 }, { metric: "offered_count", goal: 300 }] }),
      inputs,
      TODAY,
    );
    expect(p.criteria.map((c) => c.pct)).toEqual([200, 1]);
    expect(p.overallPct).toBe(50);
  });

  it("không có tiêu chí: không đạt, không %", () => {
    const p = computeTargetProgress(target({ criteria: [] }), inputs, "2026-10-02");
    expect(p.overallPct).toBeNull();
    expect(p.achieved).toBe(false);
    expect(targetStatus(p, "2026-10-02")).toBe("failed");
  });

  it("số liệu cấu thành cộng lại đúng bằng số thực tế của từng tiêu chí", () => {
    const summary = summarizeTargetInputs(inputs, SEPT);
    for (const metric of TARGET_METRICS) {
      const b = criterionBreakdown(metric, inputs, SEPT);
      expect(b.total).toBe(actualOf(metric, summary));
    }
    const recovered = criterionBreakdown("recovered_amount", inputs, SEPT);
    // Chờ thu vẫn hiện (góp 0) để giải thích khoảng thiếu; bỏ cọc bị loại và được đếm riêng.
    expect(recovered.rows.map((r) => r.value)).toEqual([800_000_000, 0]);
    expect(recovered.defaultedCount).toBe(1);
    expect(criterionBreakdown("offered_count", inputs, SEPT).rows).toHaveLength(4);
  });

  it("thêm tiêu chí: lấy loại đầu tiên chưa dùng", () => {
    expect(nextUnusedMetric(["recovered_amount"])).toBe("winning_total");
    expect(nextUnusedMetric([...TARGET_METRICS])).toBeNull();
  });

  it("đọc dòng DB: tiêu chí theo sort_order, bỏ loại lạ, suy targetAmount/targetCount", () => {
    const row = {
      id: "t9",
      workspace_id: "ws",
      branch_id: null,
      period_type: "quarter",
      period_start: "2026-10-01",
      name: "  ",
      criteria: [
        { metric: "sold_count", goal: 3, sort_order: 1 },
        { metric: "bogus", goal: 1, sort_order: 2 },
        { metric: "recovered_amount", goal: 7_000_000_000, sort_order: 0 },
      ],
    } as unknown as OwnerTargetRow & { criteria: { metric: string; goal: number; sort_order: number }[] };
    expect(mapTargetRow(row)).toMatchObject({
      name: null,
      criteria: [
        { metric: "recovered_amount", goal: 7_000_000_000 },
        { metric: "sold_count", goal: 3 },
      ],
      targetAmount: 7_000_000_000,
      targetCount: 3,
    });
  });
});

describe("tên chỉ tiêu", () => {
  const branches = [{ id: "b1", label: "Chi nhánh Hà Nội" }];

  it("tự sinh theo kỳ + phạm vi; tên đặt tay thắng", () => {
    expect(autoTargetName("quarter", "2026-10-01", SCOPE_ALL, branches)).toBe("Quý IV/2026 · Toàn đơn vị");
    expect(targetDisplayName(target({ branchId: "b1" }), branches)).toBe("Tháng 9/2026 · Chi nhánh Hà Nội");
    expect(targetDisplayName(target({ name: "Thu hồi nợ xấu" }), branches)).toBe("Thu hồi nợ xấu");
  });
});

describe("form chỉ tiêu", () => {
  const valid = {
    name: "",
    periodType: "month" as const,
    periodStart: "2026-09-01",
    scope: SCOPE_ALL,
    criteria: [{ metric: "recovered_amount" as const, goal: "20000000000" }],
  };
  const issues = (v: unknown) => {
    const r = targetFormSchema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("hợp lệ; cần ít nhất một tiêu chí, mục tiêu > 0, mỗi loại một lần", () => {
    expect(issues(valid)).toEqual([]);
    expect(issues({ ...valid, criteria: [] })).toEqual(["criteria: Thêm ít nhất một tiêu chí"]);
    expect(issues({ ...valid, criteria: [{ metric: "sold_count", goal: "000" }] })).toEqual([
      "criteria.0.goal: Nhập mục tiêu lớn hơn 0",
    ]);
    expect(
      issues({
        ...valid,
        criteria: [
          { metric: "sold_count", goal: "2" },
          { metric: "sold_count", goal: "3" },
        ],
      }),
    ).toEqual(["criteria.1.metric: Tiêu chí này đã có"]);
  });

  it("giới hạn chữ số theo đơn vị: tiền 18, đếm tài sản 6", () => {
    expect(issues({ ...valid, criteria: [{ metric: "offered_count", goal: "1000000" }] })).toEqual([
      "criteria.0.goal: Số quá lớn",
    ]);
    expect(issues({ ...valid, criteria: [{ metric: "winning_total", goal: "9".repeat(18) }] })).toEqual([]);
    expect(issues({ ...valid, name: "a".repeat(121) })).toEqual(["name: Tên tối đa 120 ký tự"]);
  });

  it("mặc định: chỉ tiêu mới có 1 tiêu chí tiền; chỉ tiêu có sẵn nạp tên + tiêu chí", () => {
    const fallback = { periodType: "month" as const, periodStart: "2026-09-01", scope: SCOPE_ALL, name: "Tháng 9/2026 · Toàn đơn vị" };
    expect(targetFormDefaults(null, fallback).criteria).toEqual([{ metric: "recovered_amount", goal: "" }]);
    expect(targetFormDefaults(target({ count: 4 }), fallback)).toMatchObject({
      name: "Tháng 9/2026 · Toàn đơn vị",
      criteria: [
        { metric: "recovered_amount", goal: "20000000000" },
        { metric: "sold_count", goal: "4" },
      ],
    });
  });

  it("ghi: tên trống / trùng tên tự sinh ⇒ NULL, 'Toàn đơn vị' ⇒ branch NULL, mục tiêu là chuỗi số", () => {
    const ctx = { workspaceId: "ws", targetId: null as string | null, autoName: "Tháng 9/2026 · Toàn đơn vị" };
    expect(toTargetSaveArgs({ ...valid, name: " Tháng 9/2026 · Toàn đơn vị " }, ctx)).toEqual({
      p_workspace_id: "ws",
      p_target_id: null,
      p_branch_id: null,
      p_period_type: "month",
      p_period_start: "2026-09-01",
      p_name: null,
      p_criteria: [{ metric: "recovered_amount", goal: "20000000000" }],
    });
    expect(
      toTargetSaveArgs(
        { ...valid, scope: "b1", name: " Nợ xấu ", criteria: [{ metric: "sold_count", goal: "007" }] },
        { ...ctx, targetId: "t1" },
      ),
    ).toMatchObject({ p_target_id: "t1", p_branch_id: "b1", p_name: "Nợ xấu", p_criteria: [{ metric: "sold_count", goal: "7" }] });
  });
});

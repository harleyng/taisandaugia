import { describe, it, expect } from "vitest";
import {
  computeTargetProgress,
  groupTargetsByStatus,
  ownerTargetOf,
  type OwnerTarget,
  type TargetCriterion,
  type TargetInput,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import {
  ANY_FILTER,
  contributionOutcomeLabel,
  contributionPayment,
  criterionNote,
  elapsedPct,
  filterTargetGroups,
  firstFreeSlot,
  periodTileParts,
  periodTitle,
  previousPeriodActual,
  shortBranchLabel,
  splitInProgress,
  targetBarTone,
  targetPillKind,
} from "./ownerTargetView";

const TODAY = "2026-09-16";

const target = (
  over: Partial<Pick<OwnerTarget, "id" | "branchId" | "periodStart" | "name">> & {
    periodType?: TargetPeriodType;
    criteria?: TargetCriterion[];
  } = {},
): OwnerTarget =>
  ownerTargetOf({
    id: "t",
    workspaceId: "w1",
    branchId: null,
    periodType: "month",
    periodStart: "2026-09-01",
    name: null,
    criteria: [{ metric: "recovered_amount", goal: 20_000_000_000 }],
    ...over,
  });

const input = (key: string, over: Partial<TargetInput> = {}): TargetInput => ({
  key,
  outcome: "sold",
  day: "2026-09-05",
  branchId: null,
  price: 1_000_000_000,
  paymentStatus: "paid",
  paidAmount: null,
  ...over,
});

describe("periodTileParts · periodTitle", () => {
  it("tháng / quý La Mã / 2 số cuối của năm", () => {
    expect(periodTileParts("month", "2026-09-01")).toEqual({ small: "Tháng", big: "9" });
    expect(periodTileParts("quarter", "2026-07-01")).toEqual({ small: "Quý", big: "III" });
    expect(periodTileParts("year", "2026-01-01")).toEqual({ small: "Năm", big: "26" });
  });

  it("viết hoa chữ đầu", () => {
    expect(periodTitle("quarter", "2026-10-01")).toBe("Quý IV/2026");
    expect(periodTitle("year", "2027-01-01")).toBe("Năm 2027");
  });
});

describe("elapsedPct", () => {
  it("0 trước kỳ, 100 sau kỳ, tỉ lệ ngày đã qua trong kỳ", () => {
    expect(elapsedPct("month", "2026-10-01", TODAY)).toBe(0);
    expect(elapsedPct("month", "2026-08-01", TODAY)).toBe(100);
    // 15 ngày đã qua / 30 ngày của tháng 9.
    expect(elapsedPct("month", "2026-09-01", TODAY)).toBe(50);
    expect(elapsedPct("month", "2026-09-01", "2026-09-01")).toBe(0);
  });
});

describe("targetBarTone · targetPillKind", () => {
  const progress = (t: OwnerTarget, inputs: TargetInput[] = []) => computeTargetProgress(t, inputs, TODAY);

  it("kỳ đang chạy: chậm hơn thời gian quá 10 điểm ⇒ vàng", () => {
    // 50% thời gian, tiến độ 35% ⇒ chậm; 45% ⇒ vẫn trong ngưỡng.
    const behind = progress(target(), [input("a", { price: 7_000_000_000 })]);
    expect(behind.overallPct).toBe(35);
    expect(targetBarTone(behind, TODAY)).toBe("behind");
    const onPace = progress(target(), [input("a", { price: 9_000_000_000 })]);
    expect(targetBarTone(onPace, TODAY)).toBe("normal");
    expect(targetPillKind(onPace, TODAY)).toBe("running");
  });

  it("hết kỳ: trượt ⇒ đỏ + 'Không đạt', đạt ⇒ 'Đạt'; sắp tới không bao giờ chậm", () => {
    const missed = progress(target({ periodStart: "2026-08-01" }));
    expect(targetBarTone(missed, TODAY)).toBe("failed");
    expect(targetPillKind(missed, TODAY)).toBe("missed");

    const met = progress(target({ periodStart: "2026-08-01", criteria: [{ metric: "offered_count", goal: 1 }] }), [
      input("a", { day: "2026-08-10" }),
    ]);
    expect(targetPillKind(met, TODAY)).toBe("met");
    expect(targetBarTone(met, TODAY)).toBe("normal");

    const upcoming = progress(target({ periodStart: "2026-10-01" }));
    expect(targetPillKind(upcoming, TODAY)).toBe("upcoming");
    expect(targetBarTone(upcoming, TODAY)).toBe("normal");
  });
});

describe("filterTargetGroups · splitInProgress", () => {
  const groups = groupTargetsByStatus(
    [
      target({ id: "m9" }),
      target({ id: "q3-b1", periodType: "quarter", periodStart: "2026-07-01", branchId: "b1" }),
      target({ id: "m10", periodStart: "2026-10-01" }),
      target({ id: "m8", periodStart: "2026-08-01" }),
    ].map((t) => computeTargetProgress(t, [], TODAY)),
    TODAY,
  );
  const ids = (list: { target: OwnerTarget }[]) => list.map((p) => p.target.id);

  it("lọc theo phạm vi (cả đơn vị / chi nhánh) và loại kỳ, áp cho cả ba tab", () => {
    expect(ids(filterTargetGroups(groups, { scope: ANY_FILTER, type: ANY_FILTER }).in_progress)).toEqual(["m9", "q3-b1", "m10"]);
    expect(ids(filterTargetGroups(groups, { scope: "all", type: ANY_FILTER }).in_progress)).toEqual(["m9", "m10"]);
    expect(ids(filterTargetGroups(groups, { scope: "b1", type: ANY_FILTER }).in_progress)).toEqual(["q3-b1"]);
    expect(ids(filterTargetGroups(groups, { scope: ANY_FILTER, type: "quarter" }).in_progress)).toEqual(["q3-b1"]);
    expect(ids(filterTargetGroups(groups, { scope: ANY_FILTER, type: "quarter" }).failed)).toEqual([]);
    expect(ids(filterTargetGroups(groups, { scope: ANY_FILTER, type: "month" }).failed)).toEqual(["m8"]);
  });

  it("đang thực hiện tách kỳ đang diễn ra / sắp tới", () => {
    const { current, upcoming } = splitInProgress(groups.in_progress, TODAY);
    expect(ids(current)).toEqual(["m9", "q3-b1"]);
    expect(ids(upcoming)).toEqual(["m10"]);
  });
});

describe("firstFreeSlot", () => {
  it("tháng này cả đơn vị khi còn trống", () => {
    expect(firstFreeSlot([], ["b1"], TODAY)).toEqual({ periodType: "month", periodStart: "2026-09-01", scope: "all" });
  });

  it("bỏ qua chỗ đã có: chi nhánh trước kỳ sau, tháng trước quý", () => {
    expect(firstFreeSlot([target()], ["b1"], TODAY)).toEqual({ periodType: "month", periodStart: "2026-09-01", scope: "b1" });
    expect(firstFreeSlot([target()], [], TODAY)).toEqual({ periodType: "month", periodStart: "2026-10-01", scope: "all" });

    const months = ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"].map((s) => target({ id: s, periodStart: s }));
    expect(firstFreeSlot(months, [], TODAY)).toEqual({ periodType: "quarter", periodStart: "2026-07-01", scope: "all" });
  });
});

describe("previousPeriodActual", () => {
  it("cùng tiêu chí, kỳ liền trước, đúng phạm vi", () => {
    const inputs = [
      input("a", { day: "2026-08-03", price: 2_000_000_000, branchId: "b1" }),
      input("b", { day: "2026-08-20", price: 3_000_000_000 }),
      input("c", { day: "2026-09-02", price: 9_000_000_000 }),
      input("d", { day: "2026-06-10", outcome: "unsold", price: null }),
    ];
    const slot = { periodType: "month" as const, periodStart: "2026-09-01", scope: "all" };
    expect(previousPeriodActual("recovered_amount", inputs, slot)).toBe(5_000_000_000);
    expect(previousPeriodActual("sold_count", inputs, { ...slot, scope: "b1" })).toBe(1);
    expect(previousPeriodActual("offered_count", inputs, { periodType: "quarter", periodStart: "2026-07-01", scope: "all" })).toBe(1);
  });
});

describe("criterionNote", () => {
  const c = (over: Partial<Parameters<typeof criterionNote>[0]> = {}) => ({
    metric: "sold_count" as const,
    goal: 10,
    actual: 4,
    pct: 40,
    remaining: 6,
    weeklyPace: 3,
    met: false,
    ...over,
  });

  it("theo thời điểm: sắp tới giải thích, hết kỳ báo thiếu, còn >7 ngày báo nhịp, tuần cuối báo số ngày", () => {
    expect(criterionNote(c(), "upcoming", 30)).toEqual({ kind: "hint", text: "Không tính tài sản người trúng bỏ cọc" });
    expect(criterionNote(c(), "past", 0)).toEqual({ kind: "missed", remaining: 6 });
    expect(criterionNote(c(), "current", 15)).toEqual({ kind: "pace", remaining: 6, weekly: 3 });
    expect(criterionNote(c(), "current", 5)).toEqual({ kind: "final", remaining: 6, daysLeft: 5 });
  });

  it("đã đạt ⇒ vượt bao nhiêu (kể cả khi kỳ đã hết)", () => {
    expect(criterionNote(c({ actual: 12, remaining: 0, met: true, weeklyPace: null }), "current", 15)).toEqual({ kind: "met", excess: 2 });
    expect(criterionNote(c({ actual: 10, remaining: 0, met: true, weeklyPace: null }), "past", 0)).toEqual({ kind: "met", excess: 0 });
  });
});

describe("số liệu cấu thành", () => {
  it("nhãn kết quả + thu tiền", () => {
    expect(contributionOutcomeLabel(input("a"))).toBe("Đấu thành");
    expect(contributionOutcomeLabel(input("a", { paymentStatus: "defaulted" }))).toBe("Đấu thành · bỏ cọc");
    expect(contributionOutcomeLabel(input("a", { outcome: "unsold" }))).toBe("Không thành");
    expect(contributionPayment(input("a", { paymentStatus: null }))).toBe("estimated");
    expect(contributionPayment(input("a", { paymentStatus: "partial" }))).toBe("partial");
  });

  it("bỏ tiền tố 'Chi nhánh' ở cột chi nhánh", () => {
    expect(shortBranchLabel("Chi nhánh Quận 7")).toBe("Quận 7");
    expect(shortBranchLabel("Phòng giao dịch Nhà Bè")).toBe("Phòng giao dịch Nhà Bè");
  });
});

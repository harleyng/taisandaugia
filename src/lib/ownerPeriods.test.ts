import { describe, it, expect } from "vitest";
import {
  PERIOD_ALL,
  PERIOD_LAST_12M,
  inPeriod,
  ownerPeriodGroups,
  ownerPeriodIds,
  ownerPeriodLabel,
  ownerPeriodPhrase,
  periodRange,
} from "./ownerPeriods";

describe("ownerPeriodGroups", () => {
  it("lists the last 12 months, 4 quarters and 2 years from today, without duplicates", () => {
    const groups = ownerPeriodGroups("2026-02-15");
    const [quick, months, quarters, years] = groups;
    expect(quick.options.map((o) => o.id)).toEqual([PERIOD_LAST_12M, PERIOD_ALL]);
    expect(months.options[0].id).toBe("m-2026-02");
    expect(months.options[1].id).toBe("m-2026-01");
    expect(months.options[2].id).toBe("m-2025-12");
    expect(months.options).toHaveLength(12);
    expect(quarters.options.map((o) => o.id)).toEqual(["q-2026-1", "q-2025-4", "q-2025-3", "q-2025-2"]);
    expect(years.options.map((o) => o.id)).toEqual(["y-2026", "y-2025"]);
    const ids = ownerPeriodIds("2026-02-15");
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("periodRange", () => {
  it("covers the 12 calendar months up to the current one", () => {
    expect(periodRange(PERIOD_LAST_12M, "2026-09-26")).toEqual({ from: "2025-10-01", to: "2026-09-30" });
    expect(periodRange(PERIOD_LAST_12M, "2026-01-05")).toEqual({ from: "2025-02-01", to: "2026-01-31" });
  });
  it("handles month, quarter and year ids including leap February", () => {
    expect(periodRange("m-2028-02", "2028-03-01")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodRange("m-2026-02", "2026-03-01")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange("q-2025-4", "2026-01-01")).toEqual({ from: "2025-10-01", to: "2025-12-31" });
    expect(periodRange("y-2026", "2026-01-01")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("returns null for all time or unknown ids", () => {
    expect(periodRange(PERIOD_ALL, "2026-01-01")).toBeNull();
    expect(periodRange("rubbish", "2026-01-01")).toBeNull();
  });
});

describe("inPeriod", () => {
  const dec = periodRange("m-2025-12", "2026-01-01");
  it("includes both ends", () => {
    expect(inPeriod("2025-12-01", dec)).toBe(true);
    expect(inPeriod("2025-12-31", dec)).toBe(true);
    expect(inPeriod("2026-01-01", dec)).toBe(false);
  });
  it("lets undated rows through only for all time", () => {
    expect(inPeriod(null, dec)).toBe(false);
    expect(inPeriod(null, null)).toBe(true);
  });
});

describe("labels", () => {
  it("names periods in Vietnamese", () => {
    expect(ownerPeriodLabel(PERIOD_LAST_12M)).toBe("12 tháng gần nhất");
    expect(ownerPeriodLabel("q-2026-3")).toBe("Quý 3/2026");
    expect(ownerPeriodPhrase("m-2026-09")).toBe("trong tháng 09/2026");
    expect(ownerPeriodPhrase(PERIOD_ALL)).toBe("từ trước tới nay");
  });
});

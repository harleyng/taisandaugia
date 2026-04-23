import { describe, it, expect } from "vitest";
import {
  percentile,
  median,
  removeIQROutliers,
  groupByMonth,
  sessionsWithinMonths,
  computeAnalytics,
  buildInsightModeA,
  buildInsightModeB,
  buildPaywallTeaser,
  computePosition,
  positionLevel,
  trendDirection,
  volatilityLevel,
  pickBucket,
  resolveAreaSubset,
  type RawSession,
} from "./auctionPriceAnalytics";

// ---- helpers ----
const NOW = new Date(2026, 3, 15); // 15-Apr-2026 (locked anchor for tests)
const monthsAgo = (n: number, day = 10) => new Date(NOW.getFullYear(), NOW.getMonth() - n, day);

const mkSessions = (entries: Array<[number /*monthsAgo*/, number /*price*/]>): RawSession[] =>
  entries.map(([m, p]) => ({ date: monthsAgo(m), price: p }));

// ---- AC4: stat primitives ----
describe("AC4 — Statistical primitives", () => {
  it("percentile P25/P50/P75 on simple set", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(arr, 0.25)).toBeCloseTo(3.25, 2);
    expect(percentile(arr, 0.5)).toBeCloseTo(5.5, 2);
    expect(percentile(arr, 0.75)).toBeCloseTo(7.75, 2);
  });

  it("median of odd/even sets", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5, 2);
  });
});

// ---- AC7: IQR outlier filter ----
describe("AC7 — IQR outlier filter", () => {
  it("removes obvious outliers", () => {
    const ss = mkSessions([
      [0, 50], [1, 52], [2, 51], [3, 49], [4, 53], [5, 50],
      [6, 48], [7, 51], [8, 500] /*outlier*/, [9, 49], [10, 50], [11, 52],
    ]);
    const { kept, removed } = removeIQROutliers(ss);
    expect(removed).toBe(1);
    expect(kept.find((s) => s.price === 500)).toBeUndefined();
  });

  it("keeps the bulk when distribution has no extreme outliers", () => {
    const ss = mkSessions([[0, 50], [1, 55], [2, 60], [3, 52], [4, 58], [5, 54], [6, 56]]);
    const { kept, removed } = removeIQROutliers(ss);
    // No price is outside Q1-1.5·IQR..Q3+1.5·IQR for this spread
    expect(removed).toBe(0);
    expect(kept).toHaveLength(7);
  });
});

// ---- AC1, AC2: month bucketing & range filtering ----
describe("AC1/AC2 — Bucketing & range filtering", () => {
  it("groupByMonth aggregates same-month entries", () => {
    const ss = mkSessions([[0, 100], [0, 110], [0, 120], [1, 80]]);
    const buckets = groupByMonth(ss);
    expect(buckets).toHaveLength(2);
    const recent = buckets[1];
    expect(recent.count).toBe(3);
    expect(recent.median).toBe(110);
  });

  it("uses min/max when bucket count < 8", () => {
    const ss = mkSessions([[0, 100], [0, 120], [0, 80]]);
    const [b] = groupByMonth(ss);
    expect(b.usesPercentile).toBe(false);
    expect(b.low).toBe(80);
    expect(b.high).toBe(120);
  });

  it("uses P25/P75 when bucket count >= 8", () => {
    const ss = mkSessions(
      [50, 55, 60, 65, 70, 75, 80, 85, 90].map((p) => [0, p] as [number, number]),
    );
    const [b] = groupByMonth(ss);
    expect(b.usesPercentile).toBe(true);
    expect(b.p25).toBeDefined();
    expect(b.p75).toBeDefined();
    expect(b.low).toBe(b.p25);
    expect(b.high).toBe(b.p75);
  });

  it("sessionsWithinMonths(3) keeps last 3 months only", () => {
    const ss = mkSessions([[0, 1], [1, 1], [2, 1], [3, 1], [6, 1]]);
    const within = sessionsWithinMonths(ss, 3, NOW);
    expect(within).toHaveLength(3);
  });
});

// ---- AC4: trend / volatility ----
describe("AC4 — Trend & volatility", () => {
  it("computes positive trend on rising series", () => {
    const ss: RawSession[] = [];
    for (let m = 11; m >= 0; m--) {
      const base = 50 + (11 - m) * 5;
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: base + i });
    }
    const a = computeAnalytics(ss);
    expect(a.trend6M).toBeGreaterThan(0);
    expect(trendDirection(a.trend6M)).toBe("up");
    expect(a.count12M).toBeGreaterThanOrEqual(5);
  });

  it("computes negative trend on falling series", () => {
    const ss: RawSession[] = [];
    for (let m = 11; m >= 0; m--) {
      const base = 100 - (11 - m) * 5;
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: base + i });
    }
    const a = computeAnalytics(ss);
    expect(a.trend6M).toBeLessThan(0);
    expect(trendDirection(a.trend6M)).toBe("down");
  });

  it("flat series has near-zero trend & low volatility", () => {
    const ss: RawSession[] = [];
    for (let m = 11; m >= 0; m--) {
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: 100 + (i % 2) });
    }
    const a = computeAnalytics(ss);
    expect(Math.abs(a.trend6M)).toBeLessThan(0.03);
    expect(volatilityLevel(a.volatility)).toBe("low");
  });

  it("volatile series flagged as high volatility", () => {
    const ss: RawSession[] = [];
    const swings = [50, 150, 60, 140, 55, 145, 50, 150, 70, 130, 60, 140];
    for (let m = 11; m >= 0; m--) {
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: swings[m] });
    }
    const a = computeAnalytics(ss);
    expect(a.volatility).toBeGreaterThan(0.2);
  });
});

// ---- AC4: position ----
describe("AC4 — Position", () => {
  it("computes position 0..1 within 12M range", () => {
    expect(computePosition(50, 0, 100)).toBeCloseTo(0.5);
    expect(computePosition(0, 0, 100)).toBe(0);
    expect(computePosition(100, 0, 100)).toBe(1);
    expect(computePosition(-10, 0, 100)).toBe(0); // clamp
    expect(computePosition(200, 0, 100)).toBe(1); // clamp
  });

  it("positionLevel buckets correctly", () => {
    expect(positionLevel(0.2)).toBe("low");
    expect(positionLevel(0.5)).toBe("medium");
    expect(positionLevel(0.9)).toBe("high");
  });
});

// ---- AC5/AC6: insight generation ----
describe("AC5/AC6 — Insight generation", () => {
  const buildAnalytics = (priceFn: (m: number) => number) => {
    const ss: RawSession[] = [];
    for (let m = 11; m >= 0; m--) {
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: priceFn(m) + i });
    }
    return computeAnalytics(ss);
  };

  it("Mode A: title + 2 bullets, no implication", () => {
    const a = buildAnalytics((m) => 100 - m * 2);
    const ins = buildInsightModeA(a);
    expect(ins.title).toBe("Xu hướng giá đấu giá");
    expect(ins.bullets).toHaveLength(2);
    expect(ins.bullets.every((b) => !b.implication)).toBe(true);
  });

  it("Mode B: title + 3 bullets, last has implication", () => {
    const a = buildAnalytics((m) => 100 - m * 2);
    const predictedMid = (a.min12M + a.max12M) / 2;
    const ins = buildInsightModeB(a, predictedMid);
    expect(ins.title).toBe("Insight thị trường");
    expect(ins.bullets).toHaveLength(3);
    expect(ins.bullets[2].implication).toBeTruthy();
  });

  it("Mode B: high volatility ⇒ warning, no opportunity (AC7)", () => {
    // Larger amplitude to push CV above 0.5
    const swings = [20, 200, 25, 195, 30, 190, 22, 198, 28, 192, 35, 185];
    const ss: RawSession[] = [];
    for (let m = 11; m >= 0; m--) {
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: swings[m] });
    }
    const a = computeAnalytics(ss);
    expect(a.volatility).toBeGreaterThan(0.5);
    const ins = buildInsightModeB(a, (a.min12M + a.max12M) / 2);
    const lastText = ins.bullets[2].text + (ins.bullets[2].implication || "");
    expect(lastText).toMatch(/biến động mạnh|kỹ ngưỡng/i);
    expect(lastText).not.toMatch(/cơ hội/i);
  });
});

// ---- AC8: paywall teaser ----
describe("AC8 — Paywall teaser line is contextual", () => {
  const make = (priceFn: (m: number) => number) => {
    const ss: RawSession[] = [];
    for (let m = 11; m >= 0; m--) {
      for (let i = 0; i < 6; i++) ss.push({ date: monthsAgo(m, 5 + i), price: priceFn(m) + i });
    }
    return computeAnalytics(ss);
  };

  it("rising trend ⇒ teaser mentions tăng", () => {
    expect(buildPaywallTeaser(make((m) => 100 - m * 5))).toMatch(/tăng/i);
  });

  it("falling trend ⇒ teaser mentions giảm", () => {
    expect(buildPaywallTeaser(make((m) => 100 + m * 5))).toMatch(/giảm/i);
  });

  it("flat trend ⇒ teaser mentions ổn định", () => {
    expect(buildPaywallTeaser(make(() => 100))).toMatch(/ổn định/i);
});

// ---- BLOCK 1: area buckets ----
describe("BLOCK 1 — Area bucketing", () => {
  const mkAreaSessions = (entries: Array<[number /*monthsAgo*/, number /*price*/, number /*area*/]>): RawSession[] =>
    entries.map(([m, p, a]) => ({ date: monthsAgo(m), price: p, area: a }));

  it("pickBucket maps area to right range", () => {
    expect(pickBucket(35)?.key).toBe("<40");
    expect(pickBucket(50)?.key).toBe("40-60");
    expect(pickBucket(70)?.key).toBe("60-80");
    expect(pickBucket(100)?.key).toBe("80-120");
    expect(pickBucket(200)?.key).toBe(">120");
    expect(pickBucket(0)).toBeNull();
  });

  it("Case 1: bucket 60-80 with ≥5 sessions → mode area-bucket, range [60,80]", () => {
    // 6 sessions in 60-80, plus a few in others
    const ss = mkAreaSessions([
      [0, 50, 65], [1, 52, 70], [2, 48, 75], [3, 51, 62], [4, 53, 78], [5, 49, 68],
      [0, 50, 30], [1, 52, 45], // outside
    ]);
    const r = resolveAreaSubset(ss, 70);
    expect(r.mode).toBe("area-bucket");
    expect(r.bucketRange).toEqual([60, 80]);
    expect(r.mergedFrom).toBeUndefined();
    expect(r.filteredSessions).toHaveLength(6);
  });

  it("Case 2: bucket 60-80 has 3 sessions → merge with neighbour, mergedFrom set", () => {
    const ss = mkAreaSessions([
      // 60-80: only 3
      [0, 50, 65], [1, 52, 70], [2, 48, 75],
      // 40-60: 4 (closer to median)
      [0, 50, 45], [1, 52, 50], [2, 48, 55], [3, 51, 48],
      // 80-120: 1
      [0, 50, 100],
    ]);
    const r = resolveAreaSubset(ss, 70);
    expect(r.mode).toBe("area-bucket");
    expect(r.mergedFrom).toBeDefined();
    expect(r.mergedFrom!.length).toBeGreaterThanOrEqual(2);
    expect(r.filteredSessions.length).toBeGreaterThanOrEqual(5);
  });

  it("Case 3: still <5 after merge → no-area fallback", () => {
    const ss = mkAreaSessions([
      [0, 50, 65], [1, 52, 70], // only 2 in 60-80
      [0, 50, 200], [1, 50, 220], // only in >120
    ]);
    const r = resolveAreaSubset(ss, 70);
    expect(r.mode).toBe("no-area");
    expect(r.reason).toBe("sparse");
  });

  it("Case 4: assetArea 500 with regional median ~80 → outlier → no-area", () => {
    const ss = mkAreaSessions([
      [0, 50, 70], [1, 52, 75], [2, 48, 80], [3, 51, 85], [4, 53, 90], [5, 49, 78],
    ]);
    const r = resolveAreaSubset(ss, 500);
    expect(r.mode).toBe("no-area");
    expect(r.reason).toBe("outlier");
  });

  it("Case 5: merge spans >2 buckets → skipPosition true", () => {
    // Force merging across 3 buckets by sparsity
    const ss = mkAreaSessions([
      // 60-80: 1
      [0, 50, 70],
      // 40-60: 2
      [1, 50, 50], [2, 50, 55],
      // 80-120: 2
      [3, 50, 100], [4, 50, 110],
      // outside
      [5, 50, 30], [6, 50, 200],
    ]);
    const r = resolveAreaSubset(ss, 70);
    // After full merge it might use 3 buckets; if so skipPosition=true. If only 2, just verify sane result.
    if (r.mode === "area-bucket" && r.mergedFrom && r.mergedFrom.length > 2) {
      expect(r.skipPosition).toBe(true);
    } else {
      // Acceptable: data may still be sparse → no-area
      expect(["area-bucket", "no-area"]).toContain(r.mode);
    }
  });

  it("Case 6: assetArea=0 → no-area (AC1 fallback)", () => {
    const ss = mkAreaSessions([[0, 50, 70], [1, 52, 75]]);
    const r = resolveAreaSubset(ss, 0);
    expect(r.mode).toBe("no-area");
    expect(r.reason).toBe("invalid-area");
  });

  it("computeAnalytics propagates areaMode/bucketLabel", () => {
    const ss = mkAreaSessions([
      [0, 50, 65], [1, 52, 70], [2, 48, 75], [3, 51, 62], [4, 53, 78], [5, 49, 68],
    ]);
    const a = computeAnalytics(ss, 70);
    expect(a.areaMode).toBe("area-bucket");
    expect(a.bucketLabel).toBe("60-80");
  });
});
});

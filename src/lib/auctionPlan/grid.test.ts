import { describe, expect, it } from "vitest";
import { planGridCells, planGridMonthLabel, isPlanGridCellMarked } from "./grid";

const marked = (cells: ReturnType<typeof planGridCells>) =>
  cells.filter(isPlanGridCellMarked).map((c) => ({
    month: c.month,
    baseline: c.baseline,
    forecast: c.forecast,
    done: c.done,
    late: c.late,
  }));

describe("planGridCells", () => {
  it("always returns 12 cells with T-labels", () => {
    const cells = planGridCells({ baselineMonth: null, forecastMonth: null, health: "on_track", outcomeDate: null });
    expect(cells).toHaveLength(12);
    expect(marked(cells)).toEqual([]);
    expect(planGridMonthLabel(7)).toBe("T7");
  });

  it("marks the baseline month", () => {
    const cells = planGridCells({ baselineMonth: "2026-06-01", forecastMonth: null, health: "on_track", outcomeDate: null });
    expect(marked(cells)).toEqual([{ month: 6, baseline: true, forecast: false, done: false, late: false }]);
  });

  it("marks baseline and forecast separately", () => {
    const cells = planGridCells({ baselineMonth: "2026-06-01", forecastMonth: "2026-09-01", health: "at_risk", outcomeDate: null });
    expect(marked(cells)).toEqual([
      { month: 6, baseline: true, forecast: false, done: false, late: false },
      { month: 9, baseline: false, forecast: true, done: false, late: false },
    ]);
  });

  it("does not draw a forecast on the baseline month itself", () => {
    const cells = planGridCells({ baselineMonth: "2026-06-01", forecastMonth: "2026-06-01", health: "on_track", outcomeDate: null });
    expect(marked(cells)).toEqual([{ month: 6, baseline: true, forecast: false, done: false, late: false }]);
  });

  it("puts the done dot in the month the auction actually landed", () => {
    const cells = planGridCells({ baselineMonth: "2026-06-01", forecastMonth: null, health: "done", outcomeDate: "2026-07-15" });
    expect(marked(cells)).toEqual([
      { month: 6, baseline: true, forecast: false, done: false, late: false },
      { month: 7, baseline: false, forecast: false, done: true, late: false },
    ]);
  });

  it("falls back to the baseline month when the outcome has no date", () => {
    const cells = planGridCells({ baselineMonth: "2026-06-01", forecastMonth: null, health: "done", outcomeDate: null });
    expect(marked(cells)).toEqual([{ month: 6, baseline: true, forecast: false, done: true, late: false }]);
  });

  it("marks the baseline month as late only when the item is late", () => {
    expect(marked(planGridCells({ baselineMonth: "2026-05-01", forecastMonth: null, health: "late", outcomeDate: null }))).toEqual([
      { month: 5, baseline: true, forecast: false, done: false, late: true },
    ]);
    expect(marked(planGridCells({ baselineMonth: "2026-05-01", forecastMonth: null, health: "at_risk", outcomeDate: null }))).toEqual([
      { month: 5, baseline: true, forecast: false, done: false, late: false },
    ]);
  });

  it("never marks a done dot for an item that is not done", () => {
    const cells = planGridCells({ baselineMonth: "2026-06-01", forecastMonth: null, health: "failed_retry", outcomeDate: "2026-07-15" });
    expect(marked(cells)).toEqual([{ month: 6, baseline: true, forecast: false, done: false, late: false }]);
  });
});

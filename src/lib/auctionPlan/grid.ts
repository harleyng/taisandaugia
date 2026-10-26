// Lưới 12 tháng của tab "Tiến độ" (A6 "Detail Tiến độ" + A9).
//
// Luật vẽ ô nằm ở đây để component chỉ còn việc gắn class: ô viền
// `border-primary` = tháng của BẢN MỐC · nền `bg-primary/15` = tháng dự kiến mới
// · chấm `bg-success` = đã đấu thành · viền `border-destructive` = trễ kế hoạch.

import { monthNumberOf } from "./totals";
import type { PlanItemHealth } from "./health";

export interface PlanGridCell {
  month: number;
  /** Tháng của bản mốc (cam kết đang có hiệu lực). */
  baseline: boolean;
  /** Tháng đơn vị đã dời dự kiến sang. */
  forecast: boolean;
  /** Tháng đã đấu thành (theo ngày kết quả, thiếu thì theo tháng bản mốc). */
  done: boolean;
  /** Ô của bản mốc nhưng tài sản đang trễ ⇒ viền destructive. */
  late: boolean;
}

export interface PlanGridRowInput {
  baselineMonth: string | null;
  forecastMonth: string | null;
  health: PlanItemHealth;
  /** Ngày có kết quả phiên (`owner_asset_outcomes.auction_date`), nếu đã có. */
  outcomeDate: string | null;
}

export const PLAN_GRID_MONTHS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Nhãn cột: "T1" … "T12". */
export const planGridMonthLabel = (month: number): string => `T${month}`;

/** Một dòng của lưới — 12 ô, đã quyết định sẵn mọi dấu hiệu. */
export function planGridCells(row: PlanGridRowInput): PlanGridCell[] {
  const baseline = monthNumberOf(row.baselineMonth);
  const forecast = monthNumberOf(row.forecastMonth);
  const doneMonth = row.health === "done" ? (monthNumberOf(row.outcomeDate) ?? baseline) : null;
  const late = row.health === "late";

  return PLAN_GRID_MONTHS.map((month) => ({
    month,
    baseline: baseline === month,
    // Dời dự kiến về đúng tháng bản mốc thì không vẽ hai lần.
    forecast: forecast === month && forecast !== baseline,
    done: doneMonth === month,
    late: late && baseline === month,
  }));
}

/** Ô có dấu hiệu nào không — dùng để bỏ qua việc gắn class cho ô trống. */
export const isPlanGridCellMarked = (cell: PlanGridCell): boolean =>
  cell.baseline || cell.forecast || cell.done || cell.late;

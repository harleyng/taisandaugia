// "Toàn tỉnh" — kiểu dữ liệu và luật THUẦN của màn tổng hợp cấp tỉnh (Phase 7).
//
// Mọi CON SỐ ở đây đến từ `auction_plan_rollup` (SQL), không tính lại: hàm roll-up
// cộng chính các dòng `auction_plan_period_metrics` của từng kế hoạch, nên tổng của
// tỉnh bằng tổng các số "Theo kỳ" của từng xã do CẤU TRÚC. File này chỉ:
//   · gộp các dòng thành một câu trả lời L1 (`provinceSummary`);
//   · chia việc cần làm thành ba nhóm L2 (`provinceAttention`);
//   · sắp xếp bảng L3 (`sortProvinceRows`).
//
// ⚠️ Không thêm luật mới ở đây. Nếu cần một con số khác, thêm cột vào roll-up —
// hai nơi cùng tính một thứ là cách chắc nhất để tỉnh và xã đọc hai số khác nhau.

import { daysToDeadline } from "./cycles";
import type { AuctionPlanCycleKind, AuctionPlanCycleStatus, AuctionPlanStatus } from "./types";

/** Hình triển khai của một đơn vị trong bảng (A2). `none` = chưa gắn chi nhánh / Trạm con. */
export type ProvinceUnitShape = "branch" | "child" | "none";

/** Một dòng `auction_plan_rollup` — khớp 1:1 cột của RPC. */
export interface ProvinceRollupRow {
  admin_unit_code: string;
  unit_name: string;
  unit_level: "province" | "commune";
  shape: ProvinceUnitShape;
  branch_id: string | null;
  child_workspace_id: string | null;
  in_cycle: boolean;
  cycle_id: string | null;
  cycle_kind: AuctionPlanCycleKind | null;
  cycle_status: AuctionPlanCycleStatus | null;
  submit_deadline: string | null;
  /** Kế hoạch đã lập ĐÚNG cho đợt đang hiển thị; null = chưa lập cho đợt đó. */
  cycle_plan_id: string | null;
  cycle_plan_status: AuctionPlanStatus | null;
  assigned_revenue: number | null;
  assigned_count: number | null;
  plan_count: number;
  /** Kế hoạch "đại diện" của xã trong năm (kế hoạch năm nếu có). */
  plan_id: string | null;
  plan_status: AuctionPlanStatus | null;
  plan_statuses: AuctionPlanStatus[];
  has_submitted: boolean;
  is_returned: boolean;
  period_type: string;
  period_start: string;
  period_end: string;
  planned_count: number;
  planned_start_value: number;
  offered_count: number;
  sold_count: number;
  actual_start_value: number;
  winning_total: number;
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  done_pct: number | null;
  late_count: number;
  at_risk_count: number;
  last_update: string | null;
}

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Chỉ các xã — kế hoạch CẤP TỈNH (đất do tỉnh quản) không vào mẫu số "x/y xã đã trình". */
export const communeRows = (rows: readonly ProvinceRollupRow[]): ProvinceRollupRow[] =>
  rows.filter((r) => r.unit_level !== "province");

export interface ProvinceSummary {
  /** Số xã có dòng trong bảng (không tính kế hoạch cấp tỉnh). */
  unitCount: number;
  /** Số xã được gọi tên trong một đợt của năm. */
  inCycleCount: number;
  /** Số xã đã trình (hoặc đã duyệt / đang điều chỉnh / đã đóng). */
  submittedCount: number;
  /** Mẫu số của "x/y xã đã trình": số xã trong đợt nếu có đợt, ngược lại tổng số xã. */
  submittedOf: number;
  assignedRevenue: number;
  plannedCount: number;
  plannedStartValue: number;
  offeredCount: number;
  soldCount: number;
  winningTotal: number;
  collected: number;
  awaiting: number;
  lateCount: number;
  atRiskCount: number;
  /** Tỷ lệ thu trên chỉ tiêu giao (0–100, làm tròn XUỐNG); null khi chưa giao chỉ tiêu. */
  assignedPct: number | null;
  /** Đã đấu thành ÷ kế hoạch của kỳ (làm tròn XUỐNG); null khi kỳ không có kế hoạch. */
  donePct: number | null;
}

/** Câu trả lời L1 của "Toàn tỉnh" — cộng các dòng, không tính lại gì. */
export function provinceSummary(rows: readonly ProvinceRollupRow[]): ProvinceSummary {
  const communes = communeRows(rows);
  const sum = (pick: (r: ProvinceRollupRow) => number | null) =>
    rows.reduce((t, r) => t + num(pick(r)), 0);

  const inCycleCount = communes.filter((r) => r.in_cycle).length;
  const submittedCount = communes.filter((r) => r.has_submitted).length;
  const assignedRevenue = sum((r) => r.assigned_revenue);
  const collected = sum((r) => r.collected);
  const plannedCount = sum((r) => r.planned_count);
  const soldCount = sum((r) => r.sold_count);

  return {
    unitCount: communes.length,
    inCycleCount,
    submittedCount,
    submittedOf: inCycleCount > 0 ? inCycleCount : communes.length,
    assignedRevenue,
    plannedCount,
    plannedStartValue: sum((r) => r.planned_start_value),
    offeredCount: sum((r) => r.offered_count),
    soldCount,
    winningTotal: sum((r) => r.winning_total),
    collected,
    awaiting: sum((r) => r.awaiting),
    lateCount: sum((r) => r.late_count),
    atRiskCount: sum((r) => r.at_risk_count),
    assignedPct: assignedRevenue > 0 ? Math.floor((collected * 100) / assignedRevenue) : null,
    donePct: plannedCount > 0 ? Math.floor((soldCount * 100) / plannedCount) : null,
  };
}

/* ─── Tầng L2: việc cần làm ───────────────────────────────────────────────── */

export interface ProvinceAttention {
  /** Xã trong đợt ĐANG MỞ mà chưa trình kế hoạch cho đợt đó. */
  notSubmitted: ProvinceRollupRow[];
  /** Xã có kế hoạch bị trả lại — việc đang nằm ở xã. */
  returned: ProvinceRollupRow[];
  /** Xã chờ cấp trên xem xét. */
  awaitingReview: ProvinceRollupRow[];
  /** Xã có tài sản trễ hoặc nguy cơ trễ. */
  late: ProvinceRollupRow[];
}

/**
 * Một xã "chưa trình" khi đợt đang hiển thị còn MỞ và kế hoạch của xã cho ĐÚNG
 * đợt đó chưa được trình (chưa lập, còn nháp, hoặc đang bị trả lại).
 *
 * Xét theo `cycle_plan_status` chứ không theo `has_submitted`: một xã đã có kế
 * hoạch NĂM được duyệt vẫn đang nợ kế hoạch BỔ SUNG của đợt đang mở.
 */
const SUBMITTED_FOR_CYCLE: readonly (AuctionPlanStatus | null)[] = [
  "submitted",
  "approved",
  "adjusting",
  "closed",
];

export function provinceAttention(rows: readonly ProvinceRollupRow[]): ProvinceAttention {
  const communes = communeRows(rows);
  return {
    notSubmitted: communes.filter(
      (r) => r.in_cycle && r.cycle_status === "open" && !SUBMITTED_FOR_CYCLE.includes(r.cycle_plan_status),
    ),
    returned: communes.filter((r) => r.is_returned),
    awaitingReview: communes.filter((r) => r.plan_statuses.includes("submitted")),
    late: communes
      .filter((r) => r.late_count > 0 || r.at_risk_count > 0)
      .sort((a, b) => b.late_count - a.late_count || b.at_risk_count - a.at_risk_count),
  };
}

/** "còn 12 ngày" · "hạn trình là hôm nay" · "quá hạn 3 ngày"; null khi đợt không đặt hạn. */
export function deadlineNote(row: ProvinceRollupRow, todayIso: string): string | null {
  const days = daysToDeadline(row.submit_deadline, todayIso);
  if (days === null) return null;
  if (days === 0) return "hạn trình là hôm nay";
  return days > 0 ? `còn ${days} ngày tới hạn trình` : `quá hạn trình ${Math.abs(days)} ngày`;
}

/** Nhãn tình trạng của xã trong bảng L3 — đọc được khi chưa có kế hoạch nào. */
export function unitStatusLabel(row: ProvinceRollupRow): string {
  if (row.plan_count === 0) return "Chưa lập kế hoạch";
  if (row.is_returned) return "Bị trả lại";
  if (row.plan_statuses.includes("submitted")) return "Chờ xem xét";
  if (row.plan_statuses.includes("adjusting")) return "Đang điều chỉnh";
  if (row.plan_statuses.includes("approved")) return "Đã duyệt";
  if (row.plan_statuses.every((s) => s === "closed")) return "Đã đóng";
  return "Nháp";
}

/* ─── Tầng L3: sắp xếp bảng ───────────────────────────────────────────────── */

export const PROVINCE_SORT_KEYS = [
  "unit",
  "status",
  "assigned",
  "planned",
  "winning",
  "collected",
  "done",
  "late",
] as const;

export type ProvinceSortKey = (typeof PROVINCE_SORT_KEYS)[number];

export const PROVINCE_SORT_LABELS: Record<ProvinceSortKey, string> = {
  unit: "Đơn vị",
  status: "Tình trạng",
  assigned: "Chỉ tiêu giao",
  planned: "Theo kế hoạch",
  winning: "Tổng giá trúng",
  collected: "Đã thu",
  done: "% hoàn thành",
  late: "Trễ",
};

/** Thứ tự tình trạng khi sắp xếp: việc gấp nhất lên trước. */
const STATUS_RANK: Record<string, number> = {
  "Bị trả lại": 0,
  "Chưa lập kế hoạch": 1,
  Nháp: 2,
  "Chờ xem xét": 3,
  "Đang điều chỉnh": 4,
  "Đã duyệt": 5,
  "Đã đóng": 6,
};

const VALUE_OF: Record<ProvinceSortKey, (r: ProvinceRollupRow) => number> = {
  unit: () => 0,
  status: (r) => STATUS_RANK[unitStatusLabel(r)] ?? 9,
  assigned: (r) => num(r.assigned_revenue),
  planned: (r) => num(r.planned_start_value),
  winning: (r) => num(r.winning_total),
  collected: (r) => num(r.collected),
  done: (r) => (r.done_pct === null ? -1 : r.done_pct),
  late: (r) => r.late_count * 1000 + r.at_risk_count,
};

/**
 * Bảng L3 sắp xếp được. Khoá `unit` so theo TÊN (tiếng Việt, `localeCompare`);
 * các khoá còn lại so theo số, mặc định GIẢM dần — người dùng bấm vào "Trễ" là
 * muốn thấy xã trễ nhiều nhất trước.
 */
export function sortProvinceRows(
  rows: readonly ProvinceRollupRow[],
  key: ProvinceSortKey,
  dir: "asc" | "desc",
): ProvinceRollupRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: ProvinceRollupRow, b: ProvinceRollupRow) =>
    a.unit_name.localeCompare(b.unit_name, "vi");
  return [...rows].sort((a, b) => {
    if (key === "unit") return sign * byName(a, b);
    const d = VALUE_OF[key](a) - VALUE_OF[key](b);
    return d !== 0 ? sign * d : byName(a, b);
  });
}

/** Chiều mặc định khi bấm một cột lần đầu: tên tăng dần, số giảm dần. */
export const defaultSortDir = (key: ProvinceSortKey): "asc" | "desc" =>
  key === "unit" ? "asc" : "desc";

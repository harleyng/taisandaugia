// So sánh hai bản mốc của một kế hoạch đấu giá — luật D4 / A4.6.
//
// ⚠️ NHÂN BẢN SQL ↔ TS. Server đã có ĐÚNG cách phân loại này trong
// `auction_plan_baseline_diff(plan_id)` (và `auction_plan_submit` gọi lại nó khi
// trình bản điều chỉnh). Hàm ở đây là BẢN SAO cho hai việc client cần mà RPC
// không làm được:
//   1. so hai bản mốc ĐÃ LƯU với nhau (v1 ↔ v2) ở tab "Phê duyệt & lịch sử";
//   2. hiện trước thay đổi mà không phải gọi mạng.
// Sửa một bên thì phải sửa bên kia. Luật của server (đọc từ
// `pg_get_functiondef` ngày 26/10/2026):
//   - `added`  = mã có ở bản SAU, không có ở bản TRƯỚC;
//   - `dropped`= mã có ở bản TRƯỚC, không có ở bản SAU;
//   - `moved_quarter` = cùng mã, `date_trunc('quarter', planned_month)`
//     **IS DISTINCT FROM** nhau ⇒ so cả NĂM lẫn quý, và "có tháng → trống" cũng
//     tính là dời;
//   - `value_shift` = cùng mã, bản trước có `expected_start_value` > 0 và
//     `abs(sau − trước) > trước × 0,1` (DẤU LỚN HƠN NGẶT: đúng 10% KHÔNG tính).
// Mảng của server sắp theo mã tăng dần — ở đây cũng vậy.
//
// `other` là nhóm DUY NHẤT chỉ có ở TS (server không cần): đổi các trường mốc
// khác (tên, diện tích, đơn giá, hình thức…) mà không dời quý, không lệch giá.
// Nó KHÔNG phải một phần của luật D4 — chỉ để người xem biết bản mốc mới khác
// chỗ nào.

import type { AuctionPlanBaselineDiff } from "./types";

/** Tối thiểu để phân loại. Cả `AuctionPlanItem` và item trong payload bản mốc đều khớp. */
export interface BaselineDiffItem {
  item_code: string;
  planned_month: string | null;
  expected_start_value: number | string | null;
  asset_type?: string | null;
  title?: string | null;
  lot_labels?: string | null;
  lot_count?: number | string | null;
  map_sheet?: string | null;
  parcel_no?: string | null;
  location?: string | null;
  area_m2?: number | string | null;
  land_use_code?: string | null;
  allocation_form?: string | null;
  unit_start_price?: number | string | null;
  planned_method?: string | null;
  executing_unit?: string | null;
}

export interface BaselineDiff {
  /** Mã tài sản mới so với bản trước. */
  added: string[];
  /** Mã tài sản không còn trong bản sau. */
  dropped: string[];
  /** Mã tài sản dời sang QUÝ khác (tính cả năm). */
  movedQuarter: string[];
  /** Mã tài sản lệch giá trị khởi điểm dự kiến quá 10%. */
  valueShift: string[];
  /** Chỉ có ở client: đổi trường mốc khác (không thuộc luật D4). */
  other: string[];
  /** Số mã tài sản bị ảnh hưởng (một mã dù vào nhiều nhóm vẫn đếm một lần). */
  affected: number;
}

export const EMPTY_BASELINE_DIFF: BaselineDiff = {
  added: [],
  dropped: [],
  movedQuarter: [],
  valueShift: [],
  other: [],
  affected: 0,
};

/** "2027-03-01" → "2027-Q1"; trống / sai định dạng ⇒ null (bản sao `date_trunc('quarter', …)`). */
export function quarterKeyOf(planned: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(planned ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-Q${Math.floor((month - 1) / 3) + 1}`;
}

/** Số tiền / số đo: chuỗi rỗng, null, NaN đều là null — KHÔNG phải 0. */
function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Các trường mốc còn lại, chuẩn hoá về chuỗi để so bằng. */
const OTHER_KEYS = [
  "asset_type",
  "title",
  "lot_labels",
  "lot_count",
  "map_sheet",
  "parcel_no",
  "location",
  "area_m2",
  "land_use_code",
  "allocation_form",
  "unit_start_price",
  "planned_method",
  "executing_unit",
] as const satisfies readonly (keyof BaselineDiffItem)[];

function sameOtherFields(a: BaselineDiffItem, b: BaselineDiffItem): boolean {
  return OTHER_KEYS.every((key) => {
    const x = a[key];
    const y = b[key];
    if (x === undefined || y === undefined) return true; // thiếu dữ liệu ⇒ không kết luận
    const sx = x === null ? "" : String(x).trim();
    const sy = y === null ? "" : String(y).trim();
    if (sx === sy) return true;
    const nx = numOrNull(x as number | string | null);
    const ny = numOrNull(y as number | string | null);
    return nx !== null && ny !== null && nx === ny;
  });
}

/** Lệch quá 10% so với bản TRƯỚC — bản sao nguyên văn điều kiện của SQL. */
export function isValueShift(
  prevExpected: number | string | null | undefined,
  nextExpected: number | string | null | undefined,
): boolean {
  const before = numOrNull(prevExpected);
  if (before === null || before <= 0) return false;
  const after = numOrNull(nextExpected) ?? 0;
  return Math.abs(after - before) > before * 0.1;
}

/**
 * Thay đổi mốc giữa bản TRƯỚC (`prev`) và bản SAU (`next`).
 *
 * `prev` = `payload.items` của bản mốc; `next` = `payload.items` của bản sau,
 * hoặc danh mục HIỆN TẠI đã lọc `exec_status = 'active'` (server lọc đúng như
 * vậy — tài sản bị bỏ khỏi kế hoạch rơi vào `dropped`).
 */
export function diffBaselines(
  prev: readonly BaselineDiffItem[],
  next: readonly BaselineDiffItem[],
): BaselineDiff {
  const before = new Map(prev.map((i) => [i.item_code, i]));
  const after = new Map(next.map((i) => [i.item_code, i]));

  const added: string[] = [];
  const dropped: string[] = [];
  const movedQuarter: string[] = [];
  const valueShift: string[] = [];
  const other: string[] = [];

  for (const [code, item] of after) {
    const old = before.get(code);
    if (!old) {
      added.push(code);
      continue;
    }
    let touched = false;
    if (quarterKeyOf(old.planned_month) !== quarterKeyOf(item.planned_month)) {
      movedQuarter.push(code);
      touched = true;
    }
    if (isValueShift(old.expected_start_value, item.expected_start_value)) {
      valueShift.push(code);
      touched = true;
    }
    if (!touched && !sameOtherFields(old, item)) other.push(code);
  }
  for (const code of before.keys()) if (!after.has(code)) dropped.push(code);

  const sort = (codes: string[]) => codes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const affected = new Set([...added, ...dropped, ...movedQuarter, ...valueShift, ...other]).size;

  return {
    added: sort(added),
    dropped: sort(dropped),
    movedQuarter: sort(movedQuarter),
    valueShift: sort(valueShift),
    other: sort(other),
    affected,
  };
}

/** Kết quả RPC `auction_plan_baseline_diff` → cùng kiểu để dùng chung một bộ hiển thị. */
export function fromServerBaselineDiff(raw: AuctionPlanBaselineDiff | null | undefined): BaselineDiff | null {
  if (!raw || raw.baseline !== true) return null;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const added = arr(raw.added);
  const dropped = arr(raw.dropped);
  const movedQuarter = arr(raw.moved_quarter);
  const valueShift = arr(raw.value_shift);
  return {
    added,
    dropped,
    movedQuarter,
    valueShift,
    other: [],
    affected: new Set([...added, ...dropped, ...movedQuarter, ...valueShift]).size,
  };
}

export const BASELINE_DIFF_GROUP_LABELS = {
  added: "Thêm",
  dropped: "Bỏ",
  movedQuarter: "Dời quý",
  valueShift: "Đổi giá trị",
  other: "Sửa khác",
} as const;

export type BaselineDiffGroup = keyof typeof BASELINE_DIFF_GROUP_LABELS;

export const BASELINE_DIFF_GROUPS: BaselineDiffGroup[] = [
  "added",
  "dropped",
  "movedQuarter",
  "valueShift",
  "other",
];

export function baselineDiffHasChanges(diff: BaselineDiff | null | undefined): boolean {
  return !!diff && BASELINE_DIFF_GROUPS.some((g) => diff[g].length > 0);
}

/** "Thêm 3 · Bỏ 1 · Dời quý 2"; không có gì đổi ⇒ null. */
export function baselineDiffSummary(diff: BaselineDiff | null | undefined): string | null {
  if (!diff) return null;
  const parts = BASELINE_DIFF_GROUPS.filter((g) => diff[g].length > 0).map(
    (g) => `${BASELINE_DIFF_GROUP_LABELS[g]} ${diff[g].length}`,
  );
  return parts.length ? parts.join(" · ") : null;
}

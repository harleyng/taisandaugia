// Mốc thời gian sẵn có cho báo cáo admin.
//
// Tách khỏi DateRangeGranularityBar.tsx để file component chỉ xuất component
// (rule react-refresh/only-export-components). DateRangeSelect cũng dùng danh
// sách này mà không cần JSX.

import { startOfMonth, startOfYear, subDays, subMonths } from "date-fns";

export type PresetKey = "7d" | "30d" | "thisMonth" | "3m" | "12m" | "thisYear" | "custom";

export interface PresetDef {
  key: PresetKey;
  label: string;
  /** Hàm chứ không phải giá trị sẵn: mốc phải tính lúc BẤM, không phải lúc nạp
   *  module — nếu không, tab mở qua đêm sẽ lọc theo "hôm nay" của ngày hôm trước. */
  range: () => { from: Date; to: Date };
}

export const REPORT_PRESETS: PresetDef[] = [
  { key: "7d", label: "7 ngày", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { key: "30d", label: "30 ngày", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { key: "thisMonth", label: "Tháng này", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { key: "3m", label: "3 tháng", range: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { key: "12m", label: "12 tháng", range: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
  { key: "thisYear", label: "Năm nay", range: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

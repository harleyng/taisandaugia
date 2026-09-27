// Tab + tìm kiếm của danh sách báo cáo định kỳ (/chu-tai-san/bao-cao-dinh-ky) — THUẦN.

import { stripViDiacritics } from "./normalizeVi";
import { reportTitle, type OwnerReport } from "./ownerPeriodicReport";

export type OwnerReportTab = "draft" | "final" | "all";

export const OWNER_REPORT_TABS: { key: OwnerReportTab; label: string }[] = [
  { key: "draft", label: "Nháp chờ chốt" },
  { key: "final", label: "Đã chốt" },
  { key: "all", label: "Tất cả" },
];

type ReportLike = Pick<OwnerReport, "status">;

export function inOwnerReportTab(r: ReportLike, tab: OwnerReportTab): boolean {
  return tab === "all" || r.status === tab;
}

export function ownerReportTabCounts(rows: readonly ReportLike[]): Record<OwnerReportTab, number> {
  const counts: Record<OwnerReportTab, number> = { draft: 0, final: 0, all: 0 };
  for (const r of rows) {
    for (const t of OWNER_REPORT_TABS) if (inOwnerReportTab(r, t.key)) counts[t.key] += 1;
  }
  return counts;
}

/**
 * Lọc theo tab + từ khoá (không dấu). `extraText` = phạm vi / người lập đã tra tên
 * ở trang — lib không biết tên chi nhánh, thành viên.
 */
export function filterOwnerReports<T extends Pick<OwnerReport, "status" | "periodType" | "periodStart">>(
  rows: readonly T[],
  tab: OwnerReportTab,
  q: string,
  extraText: (r: T) => string = () => "",
): T[] {
  const needle = stripViDiacritics(q);
  return rows.filter(
    (r) =>
      inOwnerReportTab(r, tab) &&
      (!needle || stripViDiacritics(`${reportTitle(r.periodType, r.periodStart)} ${extraText(r)}`).includes(needle)),
  );
}

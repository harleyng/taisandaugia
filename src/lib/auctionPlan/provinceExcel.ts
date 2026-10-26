// "Xuất Excel" của danh mục hợp nhất toàn tỉnh (Phase 7, §A6 tầng L4).
//
// MỘT sheet cho mỗi đơn vị hành chính + MỘT sheet "Tổng hợp" ở đầu. Cột của sheet
// đơn vị là BẢY cột biểu mẫu chính thức (`PLAN_PRINT_COLUMNS`) — cùng bộ cột với
// bản in và với Excel vào/ra của Phase 3, nên tỉnh và xã nói cùng một thứ tiếng.
//
// Tiền là SỐ (định dạng #,##0 — nhóm nghìn bằng dấu PHẨY) để cộng / lọc được.
// Không có một id nội bộ nào trong workbook.

import * as XLSX from "xlsx-js-style";
import { PLAN_PRINT_COLUMNS } from "./print";
import { consolidatedTotals, type ConsolidatedItemRow, type ConsolidatedUnit } from "./consolidated";
import { AUCTION_PLAN_KIND_LABELS } from "./types";

interface Column {
  label: string;
  width: number;
  format?: string;
}

const MONEY = "#,##0";
const AREA = "#,##0.0";

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "E5F2EC" } },
  border: { bottom: { style: "thin", color: { rgb: "1F2937" } } },
  alignment: { vertical: "center", wrapText: true },
};
const TITLE_STYLE = { font: { bold: true, sz: 14, color: { rgb: "14532D" } } };
const TOTAL_STYLE = { font: { bold: true } };

type Cell = string | number | null;

/** Tên sheet Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ] */
export function sheetNameOf(unitName: string, used: Set<string>): string {
  const base = (unitName || "Đơn vị").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Đơn vị";
  let name = base;
  let n = 2;
  while (used.has(name)) {
    name = `${base.slice(0, 28 - String(n).length)} ${n}`;
    n += 1;
  }
  used.add(name);
  return name;
}

function cellAt(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
}

const COL_WIDTHS = [6, 34, 16, 14, 34, 22, 16];
const COL_FORMATS: (string | undefined)[] = [undefined, undefined, undefined, AREA, undefined, MONEY, undefined];

function unitSheet(unit: ConsolidatedUnit, planYear: number): XLSX.WorkSheet {
  const head = [
    [`Danh mục tài sản đấu giá năm ${planYear} — ${unit.unitName}`],
    [
      "Căn cứ phê duyệt",
      unit.plans
        .map((p) =>
          [
            AUCTION_PLAN_KIND_LABELS[p.planKind],
            p.approvalDocNo ? `QĐ số ${p.approvalDocNo}` : null,
            p.approvalDocDate,
            `bản mốc v${p.baselineVersion}`,
          ]
            .filter(Boolean)
            .join(" · "),
        )
        .join(" | "),
    ],
    [],
  ];
  const body: Cell[][] = unit.rows.map((r) => [
    r.seq,
    r.title,
    r.lotLabels === "—" ? "" : r.lotLabels,
    r.area,
    r.location === "—" ? "" : r.location,
    r.unitPrice,
    r.period === "—" ? "" : r.period,
  ]);
  const total: Cell[] = [
    null,
    `Tổng cộng: ${unit.totals.count} tài sản`,
    null,
    unit.totals.area || null,
    `Giá trị khởi điểm dự kiến: ${Math.round(unit.totals.expected).toLocaleString("en-US")} ₫`,
    null,
    null,
  ];

  const ws = XLSX.utils.aoa_to_sheet([...head, [...PLAN_PRINT_COLUMNS], ...body, total]);
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  const headerRow = head.length;
  const titleCell = cellAt(ws, 0, 0);
  if (titleCell) titleCell.s = TITLE_STYLE;
  PLAN_PRINT_COLUMNS.forEach((_, c) => {
    const cell = cellAt(ws, headerRow, c);
    if (cell) cell.s = HEADER_STYLE;
    const format = COL_FORMATS[c];
    if (!format) return;
    body.forEach((_row, i) => {
      const value = cellAt(ws, headerRow + 1 + i, c);
      if (value?.t === "n") value.z = format;
    });
  });
  for (let c = 0; c < PLAN_PRINT_COLUMNS.length; c += 1) {
    const cell = cellAt(ws, headerRow + 1 + body.length, c);
    if (cell) cell.s = TOTAL_STYLE;
  }
  return ws;
}

const SUMMARY_COLUMNS: Column[] = [
  { label: "Đơn vị", width: 30 },
  { label: "Cấp", width: 10 },
  { label: "Số kế hoạch", width: 13 },
  { label: "Số tài sản", width: 12 },
  { label: "Diện tích (m²)", width: 16, format: AREA },
  { label: "Giá trị khởi điểm dự kiến (₫)", width: 28, format: MONEY },
  { label: "Chưa có thời gian dự kiến", width: 22 },
];

function summarySheet(units: readonly ConsolidatedUnit[], rows: readonly ConsolidatedItemRow[], planYear: number) {
  const totals = consolidatedTotals(rows);
  const body: Cell[][] = units.map((u) => [
    u.unitName,
    u.unitLevel === "province" ? "Tỉnh" : "Xã / phường",
    u.plans.length,
    u.totals.count,
    u.totals.area || null,
    Math.round(u.totals.expected),
    u.totals.withoutMonth || null,
  ]);
  const head: Cell[][] = [
    [`Tổng hợp kế hoạch đấu giá toàn tỉnh năm ${planYear}`],
    ["Nguồn", "Bản mốc đã phê duyệt của từng đơn vị (không gồm kế hoạch đang soạn)"],
    ["Số đơn vị", units.length],
    ["Tổng số tài sản", totals.count],
    ["Tổng giá trị khởi điểm dự kiến (₫)", Math.round(totals.expected)],
    [],
  ];
  const total: Cell[] = [
    "Tổng cộng",
    null,
    null,
    totals.count,
    totals.area || null,
    Math.round(totals.expected),
    totals.withoutMonth || null,
  ];

  const ws = XLSX.utils.aoa_to_sheet([...head, SUMMARY_COLUMNS.map((c) => c.label), ...body, total]);
  ws["!cols"] = SUMMARY_COLUMNS.map((c) => ({ wch: c.width }));
  const headerRow = head.length;
  const titleCell = cellAt(ws, 0, 0);
  if (titleCell) titleCell.s = TITLE_STYLE;
  const moneyCell = cellAt(ws, 4, 1);
  if (moneyCell?.t === "n") moneyCell.z = MONEY;
  SUMMARY_COLUMNS.forEach((col, c) => {
    const cell = cellAt(ws, headerRow, c);
    if (cell) cell.s = HEADER_STYLE;
    if (!col.format) return;
    [...body, total].forEach((_row, i) => {
      const value = cellAt(ws, headerRow + 1 + i, c);
      if (value?.t === "n") value.z = col.format;
    });
  });
  for (let c = 0; c < SUMMARY_COLUMNS.length; c += 1) {
    const cell = cellAt(ws, headerRow + 1 + body.length, c);
    if (cell) cell.s = TOTAL_STYLE;
  }
  return ws;
}

export const PROVINCE_SUMMARY_SHEET = "Tổng hợp";

/** Workbook hợp nhất: sheet "Tổng hợp" + một sheet cho mỗi đơn vị hành chính. */
export function buildProvincePlanWorkbook(
  units: readonly ConsolidatedUnit[],
  rows: readonly ConsolidatedItemRow[],
  planYear: number,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(units, rows, planYear), PROVINCE_SUMMARY_SHEET);
  const used = new Set<string>([PROVINCE_SUMMARY_SHEET]);
  for (const unit of units) {
    XLSX.utils.book_append_sheet(wb, unitSheet(unit, planYear), sheetNameOf(unit.unitName, used));
  }
  return wb;
}

export function downloadProvincePlanXlsx(
  units: readonly ConsolidatedUnit[],
  rows: readonly ConsolidatedItemRow[],
  planYear: number,
  fileName = `ke-hoach-dau-gia-toan-tinh-${planYear}.xlsx`,
) {
  XLSX.writeFile(buildProvincePlanWorkbook(units, rows, planYear), fileName);
}

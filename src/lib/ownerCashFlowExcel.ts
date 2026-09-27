// "Xuất Excel" của trang Dòng tiền (báo cáo theo kỳ). Cùng tập số liệu với màn hình:
// các tài sản BÁN trong kỳ mà đơn vị tự theo dõi tiền, số đã thu tính tới hôm nay.
// Tiền là SỐ (định dạng #,##0 — nhóm nghìn bằng dấu phẩy) để cộng / lọc được. Không có cột id.

import * as XLSX from "xlsx-js-style";
import { CASH_KIND_LABEL, CASH_KIND_SIGN } from "@/lib/ownerCashEvent";
import { cohortAssets, type CashFlowData, type CashReportView } from "@/lib/ownerCashFlow";
import { ownerPeriodLabel } from "@/lib/ownerPeriods";
import { formatDayFull } from "@/lib/ownerPulse";

export const CASH_FLOW_SHEETS = ["Tổng quan", "Theo đơn vị", "Tài sản bán trong kỳ", "Sổ thu chi"] as const;

type Cell = string | number | null;

const MONEY = "#,##0";
const PERCENT = "0%";

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "E5F2EC" } },
  border: { bottom: { style: "thin", color: { rgb: "1F2937" } } },
  alignment: { vertical: "center", wrapText: true },
};
const TITLE_STYLE = { font: { bold: true, sz: 14, color: { rgb: "14532D" } } };
const LABEL_STYLE = { font: { color: { rgb: "4B5563" } } };

const day = (iso: string | null) => (iso ? formatDayFull(iso) : "");
const money = (n: number) => Math.round(n);

interface Column {
  label: string;
  width: number;
  format?: string;
}

function cellAt(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
}

function tableSheet(columns: Column[], rows: Cell[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.label), ...rows]);
  ws["!cols"] = columns.map((c) => ({ wch: c.width }));
  columns.forEach((col, c) => {
    const head = cellAt(ws, 0, c);
    if (head) head.s = HEADER_STYLE;
    if (!col.format) return;
    rows.forEach((_, i) => {
      const cell = cellAt(ws, i + 1, c);
      if (cell?.t === "n") cell.z = col.format;
    });
  });
  return ws;
}

export interface CashFlowExportMeta {
  periodId: string;
  /** "Toàn hệ thống" hoặc tên đơn vị đang lọc. */
  scopeName: string;
}

function summarySheet(view: CashReportView, meta: CashFlowExportMeta): XLSX.WorkSheet {
  const w = view.waterfall;
  const n = w.notes;
  const rows: Cell[][] = [
    [`Dòng tiền — ${ownerPeriodLabel(meta.periodId)}`],
    ["Phạm vi", meta.scopeName],
    ["Số đã thu tính đến ngày", day(view.asOf)],
    ["Cách tính", "Tài sản bán trong kỳ (theo ngày phiên) mà đơn vị tự khai kết quả và theo dõi tiền"],
    [],
    ["Chỉ số", "Giá trị"],
    ["Số tài sản", w.count],
    ["Giá trúng (₫)", money(w.winning)],
    ["Đã thu (₫)", money(w.recorded)],
    ["Còn phải thu (₫)", money(w.awaiting)],
    ["Phí & chi phí (₫)", money(w.fees)],
    ["Thực nhận (₫)", money(w.net)],
    ["Tỷ lệ thu", view.rate],
    [],
    ["Không tính vào số trên", "Số tài sản", "Giá trúng (₫)"],
    ["Người trúng bỏ cọc", n.defaulted, null],
    ["Bán trên sàn — sàn theo dõi thanh toán", n.platform.count, money(n.platform.value)],
    ["Bán theo số của tổ chức / tin đăng, đơn vị chưa tự khai", n.untracked.count, money(n.untracked.value)],
    [],
    ["Sheet «Sổ thu chi»: mọi khoản của các tài sản bán trong kỳ (mọi lượt, mọi ngày tiền về)."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 52 }, { wch: 22 }, { wch: 18 }];
  const title = cellAt(ws, 0, 0);
  if (title) title.s = TITLE_STYLE;
  [1, 2, 3].forEach((r) => {
    const c = cellAt(ws, r, 0);
    if (c) c.s = LABEL_STYLE;
  });
  [5, 14].forEach((r) =>
    [0, 1, 2].forEach((c) => {
      const cell = cellAt(ws, r, c);
      if (cell) cell.s = HEADER_STYLE;
    }),
  );
  [7, 8, 9, 10, 11].forEach((r) => {
    const cell = cellAt(ws, r, 1);
    if (cell?.t === "n") cell.z = MONEY;
  });
  const rate = cellAt(ws, 12, 1);
  if (rate?.t === "n") rate.z = PERCENT;
  [16, 17].forEach((r) => {
    const cell = cellAt(ws, r, 2);
    if (cell?.t === "n") cell.z = MONEY;
  });
  return ws;
}

export function buildCashFlowWorkbook(data: CashFlowData, view: CashReportView, meta: CashFlowExportMeta): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const multi = data.units.length > 1;
  const unitName = new Map(data.units.map((u) => [u.id, u.name]));
  const assets = cohortAssets(data.rows, view.range, data.asOf);

  XLSX.utils.book_append_sheet(wb, summarySheet(view, meta), CASH_FLOW_SHEETS[0]);

  if (multi) {
    XLSX.utils.book_append_sheet(
      wb,
      tableSheet(
        [
          { label: "Đơn vị", width: 36 },
          { label: "Số tài sản", width: 12 },
          { label: "Giá trúng (₫)", width: 18, format: MONEY },
          { label: "Đã thu (₫)", width: 18, format: MONEY },
          { label: "Phí & chi phí (₫)", width: 18, format: MONEY },
          { label: "Thực nhận (₫)", width: 18, format: MONEY },
          { label: "Còn phải thu (₫)", width: 18, format: MONEY },
          { label: "Quá hạn (₫)", width: 18, format: MONEY },
          { label: "Tỷ lệ thu", width: 12, format: PERCENT },
        ],
        view.units.map((u) => [
          u.unit.isSelf ? `${u.unit.name} (trụ sở)` : u.unit.name,
          u.totals.count,
          money(u.totals.winning),
          money(u.totals.recorded),
          money(u.totals.fees),
          money(u.totals.net),
          money(u.totals.awaiting),
          money(u.overdue),
          u.rate,
        ]),
      ),
      CASH_FLOW_SHEETS[1],
    );
  }

  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        ...(multi ? [{ label: "Đơn vị", width: 28 }] : []),
        { label: "Chi nhánh", width: 28 },
        { label: "Ngày phiên", width: 12 },
        { label: "Giá trúng (₫)", width: 18, format: MONEY },
        { label: "Đã thu (₫)", width: 18, format: MONEY },
        { label: "Còn phải thu (₫)", width: 18, format: MONEY },
        { label: "Hạn thu", width: 12 },
        { label: "Trễ (ngày)", width: 10 },
        { label: "Ghi chú", width: 30 },
      ],
      assets.map((a) => [
        a.row.assetCode ?? "Ngoài sàn",
        a.row.title,
        ...(multi ? [unitName.get(a.row.unitId) ?? ""] : []),
        a.row.branchName ?? "",
        day(a.row.date),
        a.row.price === null ? null : money(a.row.price),
        money(a.recorded),
        money(a.awaiting),
        a.awaiting > 0 ? day(a.dueOn) : "",
        a.daysOverdue || null,
        a.defaulted ? "Người trúng bỏ cọc — không tính" : "",
      ]),
    ),
    CASH_FLOW_SHEETS[2],
  );

  const cohort = new Set(assets.map((a) => `${a.row.unitId}|${a.row.rowKey}`));
  const events = data.events
    .filter((e) => cohort.has(`${e.unitId}|${e.rowKey}`))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Ngày tiền về", width: 12 },
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        ...(multi ? [{ label: "Đơn vị", width: 28 }] : []),
        { label: "Lượt", width: 6 },
        { label: "Loại", width: 16 },
        { label: "Số tiền (₫)", width: 18, format: MONEY },
        { label: "Ghi chú", width: 36 },
        { label: "Người ghi", width: 24 },
      ],
      events.map((e) => [
        day(e.occurredOn),
        e.assetCode ?? "Ngoài sàn",
        e.title,
        ...(multi ? [unitName.get(e.unitId) ?? ""] : []),
        e.roundNo,
        CASH_KIND_LABEL[e.kind],
        money(CASH_KIND_SIGN[e.kind] * e.amount),
        e.note ?? "",
        e.updatedByName ?? e.createdByName ?? "",
      ]),
    ),
    CASH_FLOW_SHEETS[3],
  );

  return wb;
}

export function downloadCashFlowXlsx(data: CashFlowData, view: CashReportView, meta: CashFlowExportMeta, fileName: string) {
  XLSX.writeFile(buildCashFlowWorkbook(data, view, meta), fileName);
}

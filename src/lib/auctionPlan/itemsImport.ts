// Nhập / xuất danh mục tài sản của kế hoạch đấu giá bằng Excel.
//
// Cột của file là BẢY cột của biểu mẫu chính thức (A9 của
// docs/owner-auction-planning-plan.md) — đúng bảng mà cán bộ xã đang gõ trong
// Word/Excel hôm nay, nên dán sang được mà không phải sắp lại cột:
//
//   STT · Tên lô đất · Số lô · Diện tích (m²) · Đặc điểm, vị trí ·
//   Giá khởi điểm dự kiến (đồng/m²) · Thời gian dự kiến
//
// Thuần (trừ đọc File / ghi file) — cùng khuôn `ownerOutcomeImport.ts`: phân
// loại ở client để XEM TRƯỚC, chỉ gửi dòng hợp lệ, và server (quyền cột + RLS +
// trigger khoá trường mốc) vẫn là cổng thật.
//
// Thiếu "Thời gian dự kiến" KHÔNG phải lỗi: `auction_plan_submit` mới chặn việc
// đó (reason `items_without_month`), nên dòng vẫn ghi được và chỉ bị nhắc. Lỗi
// là những thứ không ghi nổi: thiếu tên lô, tên quá dài, số đọc không ra.

import * as XLSX from "xlsx-js-style";
import { fold, parseVndAmount } from "@/lib/orgContacts/contactImport";
import {
  AUCTION_PLAN_ALLOCATION_FORM_LABELS,
  AUCTION_PLAN_ASSET_TYPE_LABELS,
  AUCTION_PLAN_METHOD_LABELS,
  type AuctionPlanAssetType,
} from "./types";
import { monthLabel, suggestExpectedValue } from "./totals";

export const PLAN_IMPORT_MAX_ROWS = 300;

/** Bảy cột của biểu mẫu chính thức — dùng cho CẢ file mẫu và file xuất. */
export const PLAN_ITEM_TEMPLATE_HEADERS = [
  "STT",
  "Tên lô đất *",
  "Số lô",
  "Diện tích (m²)",
  "Đặc điểm, vị trí",
  "Giá khởi điểm dự kiến (đồng/m²)",
  "Thời gian dự kiến",
] as const;

const SHEET_NAME = "Danh mục tài sản";

/* ─── Đọc bảng ────────────────────────────────────────────────────────────── */

export interface ParsedPlanItemRow {
  /** Số dòng trong file (dòng tiêu đề = 1). */
  row: number;
  title: string;
  lotLabels: string;
  area: unknown;
  location: string;
  unitPrice: unknown;
  month: unknown;
}

type ColKey = Exclude<keyof ParsedPlanItemRow, "row">;

const cell = (v: unknown): string => String(v ?? "").replace(/\u00a0/g, " ").trim();
const folded = (v: unknown): string => fold(cell(v)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Thứ tự QUAN TRỌNG: luật cụ thể trước — "Diện tích" trước mọi thứ có chữ "tich",
// "Giá khởi điểm" trước mọi thứ có chữ "gia".
const HEADER_RULES: [ColKey, (h: string) => boolean][] = [
  ["area", (h) => h.includes("dien tich")],
  ["unitPrice", (h) => h.includes("khoi diem") || h.includes("don gia")],
  ["month", (h) => h.includes("thoi gian") || h.startsWith("thang") || h.includes("du kien dau gia")],
  ["lotLabels", (h) => h === "so lo" || h.startsWith("so lo") || h.includes("ky hieu lo")],
  ["location", (h) => h.includes("dac diem") || h.includes("vi tri")],
  ["title", (h) => h.includes("ten lo") || h.includes("ten tai san") || h === "ten" || h === "tai san"],
];

export function detectPlanItemColumns(headerRow: unknown[]): Partial<Record<ColKey, number>> {
  const map: Partial<Record<ColKey, number>> = {};
  headerRow.forEach((raw, idx) => {
    const h = folded(raw);
    if (!h) return;
    const hit = HEADER_RULES.find(([key, test]) => map[key] === undefined && test(h));
    if (hit) map[hit[0]] = idx;
  });
  return map;
}

/** Mảng 2 chiều (dòng đầu là tiêu đề) ⇒ dòng thô. Bỏ dòng trống hoàn toàn. */
export function planItemRowsFromSheet(aoa: unknown[][]): ParsedPlanItemRow[] {
  if (aoa.length < 2) return [];
  const col = detectPlanItemColumns(aoa[0] ?? []);
  const raw = (cells: unknown[], key: ColKey): unknown => (col[key] === undefined ? "" : cells[col[key]!]);
  const out: ParsedPlanItemRow[] = [];
  aoa.slice(1).forEach((cells, i) => {
    if (!cells || cells.every((c) => cell(c) === "")) return;
    out.push({
      row: i + 2,
      title: cell(raw(cells, "title")),
      lotLabels: cell(raw(cells, "lotLabels")),
      area: raw(cells, "area"),
      location: cell(raw(cells, "location")),
      unitPrice: raw(cells, "unitPrice"),
      month: raw(cells, "month"),
    });
  });
  return out;
}

/** Thiếu cột bắt buộc ⇒ câu lỗi (báo ngay thay vì đổ mọi dòng thành lỗi). */
export function missingPlanItemColumns(headerRow: unknown[]): string[] {
  const col = detectPlanItemColumns(headerRow);
  return col.title === undefined ? ["Tên lô đất"] : [];
}

export interface ParsedPlanItemFile {
  rows: ParsedPlanItemRow[];
  missingColumns: string[];
}

export function parsePlanItemsFile(file: File): Promise<ParsedPlanItemFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const name = wb.SheetNames.find((n) => folded(n).startsWith("danh muc")) ?? wb.SheetNames[0];
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
        resolve({ rows: planItemRowsFromSheet(aoa), missingColumns: missingPlanItemColumns(aoa[0] ?? []) });
      } catch {
        reject(new Error("Không đọc được file. Vui lòng dùng file .xlsx hoặc .csv."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file."));
    reader.readAsArrayBuffer(file);
  });
}

/* ─── Chuẩn hoá từng ô ────────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

const ROMAN_QUARTER: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, "1": 1, "2": 2, "3": 3, "4": 4 };

/**
 * "6/2027" · "06/2027" · "2027-06" · "Tháng 6/2027" · "T6" · "Quý II/2027" ·
 * "Quý 2" · số ngày Excel ⇒ "YYYY-MM-01". Quý ⇒ tháng ĐẦU của quý.
 *
 * Ô trống ⇒ `undefined` (chưa chọn tháng, vẫn ghi được); đọc không ra ⇒ `null`.
 */
export function parsePlannedMonth(raw: unknown, planYear: number): string | null | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const p = XLSX.SSF.parse_date_code(raw);
    if (p && p.y >= 1900 && p.m >= 1 && p.m <= 12) return `${p.y}-${pad2(p.m)}-01`;
    // Excel để ô là số thường ("6") thì parse_date_code ra năm 1900 — coi là số tháng.
    if (Number.isInteger(raw) && raw >= 1 && raw <= 12) return `${planYear}-${pad2(raw)}-01`;
    return null;
  }
  // `folded` đã biến mọi dấu phân cách ("/", "-", ".") thành KHOẢNG TRẮNG, nên
  // các mẫu dưới đây chỉ cần tách bằng \s.
  const s = folded(raw);
  if (!s) return undefined;

  const quarter = /^(?:quy|q)\s*(i{1,3}|iv|[1-4])(?:\s*(?:nam\s*)?(\d{4}))?$/.exec(s);
  if (quarter) {
    const q = ROMAN_QUARTER[quarter[1]];
    const year = quarter[2] ? Number(quarter[2]) : planYear;
    return q ? `${year}-${pad2(q * 3 - 2)}-01` : null;
  }

  // "15/6/2027" — có ngày, lấy tháng. Phải thử TRƯỚC mẫu "tháng năm".
  const day = /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/.exec(s);
  if (day) {
    const month = Number(day[2]);
    return month >= 1 && month <= 12 ? `${day[3]}-${pad2(month)}-01` : null;
  }

  const iso = /^(\d{4})\s+(\d{1,2})(?:\s+\d{1,2})?$/.exec(s);
  if (iso) {
    const month = Number(iso[2]);
    return month >= 1 && month <= 12 ? `${iso[1]}-${pad2(month)}-01` : null;
  }

  const vn = /^(?:thang|t)?\s*(\d{1,2})(?:\s+(\d{4}))?$/.exec(s);
  if (vn) {
    const month = Number(vn[1]);
    const year = vn[2] ? Number(vn[2]) : planYear;
    return month >= 1 && month <= 12 ? `${year}-${pad2(month)}-01` : null;
  }
  return null;
}

/**
 * Số thập phân người Việt gõ lẫn hai kiểu dấu. Dấu CUỐI cùng quyết định phần
 * thập phân, trừ khi sau nó đúng 3 chữ số và cả chuỗi chỉ dùng một loại dấu —
 * lúc đó nó là dấu nhóm nghìn ("1.234" = 1234 m², không phải 1,234 m²).
 *
 * Ô trống ⇒ `undefined`; rác ⇒ `null`.
 */
export function parseDecimalCell(raw: unknown): number | null | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const s = cell(raw).replace(/\s/g, "").replace(/m2|m²/gi, "");
  if (!s) return undefined;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);
  if (sep === -1) return /^\d+$/.test(s) ? Number(s) : null;
  const intPart = s.slice(0, sep).replace(/[.,]/g, "");
  const fracPart = s.slice(sep + 1);
  if (!/^\d+$/.test(intPart) || !/^\d+$/.test(fracPart)) return null;
  const oneKind = lastComma === -1 || lastDot === -1;
  if (oneKind && fracPart.length === 3) return Number(intPart + fracPart);
  return Number(`${intPart}.${fracPart}`);
}

/* ─── Phân loại ───────────────────────────────────────────────────────────── */

/** Đúng các cột client có GRANT INSERT trên `auction_plan_items` (trừ `plan_id`). */
export interface PlanItemImportPayload {
  asset_type: AuctionPlanAssetType;
  title: string;
  lot_labels: string | null;
  location: string | null;
  area_m2: number | null;
  unit_start_price: number | null;
  expected_start_value: number | null;
  planned_month: string | null;
}

export interface ValidPlanItemRow {
  row: number;
  title: string;
  payload: PlanItemImportPayload;
  warnings: string[];
}

export interface PlanItemIssue {
  row: number;
  title: string;
  reason: string;
}

export interface ClassifiedPlanItems {
  valid: ValidPlanItemRow[];
  invalid: PlanItemIssue[];
}

export interface PlanItemImportContext {
  planYear: number;
  /** Loại tài sản mặc định của kế hoạch — biểu mẫu chính thức không có cột này. */
  assetType: AuctionPlanAssetType;
}

const TITLE_MIN = 3;
const TITLE_MAX = 300;

export function classifyPlanItemRows(
  rows: readonly ParsedPlanItemRow[],
  ctx: PlanItemImportContext,
): ClassifiedPlanItems {
  const valid: ValidPlanItemRow[] = [];
  const invalid: PlanItemIssue[] = [];

  for (const row of rows) {
    const title = row.title.replace(/\s+/g, " ").trim();
    if (!title) {
      invalid.push({ row: row.row, title: "", reason: "Thiếu tên lô đất" });
      continue;
    }
    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      invalid.push({ row: row.row, title, reason: `Tên lô đất cần từ ${TITLE_MIN} đến ${TITLE_MAX} ký tự` });
      continue;
    }
    const area = parseDecimalCell(row.area);
    if (area === null) {
      invalid.push({ row: row.row, title, reason: "Diện tích không đọc được (chỉ nhập số, ví dụ 120.5)" });
      continue;
    }
    const price = cell(row.unitPrice) === "" ? undefined : parseVndAmount(row.unitPrice);
    if (price === null) {
      invalid.push({ row: row.row, title, reason: "Giá khởi điểm không đọc được (ví dụ 12,000,000)" });
      continue;
    }
    const month = parsePlannedMonth(row.month, ctx.planYear);
    if (month === null) {
      invalid.push({ row: row.row, title, reason: "Thời gian dự kiến không đọc được (ví dụ 6/2027 hoặc Quý II)" });
      continue;
    }

    const warnings: string[] = [];
    if (month === undefined) warnings.push("chưa có thời gian dự kiến — cần chọn tháng trước khi trình");
    else if (!month.startsWith(`${ctx.planYear}-`)) {
      invalid.push({
        row: row.row,
        title,
        reason: `Thời gian dự kiến phải trong năm ${ctx.planYear} (file ghi ${monthLabel(month)})`,
      });
      continue;
    }
    // Biểu mẫu không có cột "Giá trị khởi điểm" ⇒ suy ra như hộp thoại (diện tích × đơn giá).
    if (area === undefined || price === undefined) {
      warnings.push("chưa đủ diện tích và đơn giá nên chưa có giá trị khởi điểm dự kiến");
    }

    valid.push({
      row: row.row,
      title,
      warnings,
      payload: {
        asset_type: ctx.assetType,
        title,
        lot_labels: row.lotLabels || null,
        location: row.location || null,
        area_m2: area ?? null,
        unit_start_price: price ?? null,
        expected_start_value: suggestExpectedValue(area ?? null, price ?? null),
        planned_month: month ?? null,
      },
    });
  }

  return { valid, invalid };
}

/* ─── File mẫu · file xuất · file lỗi ─────────────────────────────────────── */

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "E5F2EC" } },
  border: { bottom: { style: "medium", color: { rgb: "1F2937" } } },
};

const COL_WIDTHS = [6, 44, 16, 14, 40, 26, 16];

function styledSheet(aoa: (string | number)[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  (aoa[0] ?? []).forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) (ws[ref] as XLSX.CellObject).s = HEADER_STYLE;
  });
  return ws;
}

const guideRows = (planYear: number): (string | number)[][] => [
  ["Cột", "Cách điền"],
  ["STT", "Không cần điền — hệ thống tự cấp mã tài sản theo thứ tự trong kế hoạch."],
  ["Tên lô đất *", "Bắt buộc, 3–300 ký tự. Ví dụ: Lô LK1-10, khu dân cư Đồng Chùa."],
  ["Số lô", 'Ký hiệu lô như trong quy hoạch, ví dụ "LK1-10" hoặc "LK2-13→16".'],
  ["Diện tích (m²)", "Chỉ số, ví dụ 120 hoặc 120.5."],
  ["Đặc điểm, vị trí", "Mô tả ngắn: giáp đường, hạ tầng, tờ bản đồ / thửa nếu có."],
  ["Giá khởi điểm dự kiến (đồng/m²)", "Số tiền đồng cho một m², ví dụ 12,000,000 hoặc 12 triệu."],
  [
    "Thời gian dự kiến",
    `Tháng trong năm ${planYear}: "6/${planYear}", "Tháng 6", hoặc "Quý II" (lấy tháng đầu quý). Để trống được, nhưng chưa có tháng thì không trình kế hoạch được.`,
  ],
  ["", ""],
  ["Lưu ý", ""],
  ["Giá trị khởi điểm", "Tự tính = Diện tích × Giá khởi điểm; mở từng tài sản để sửa nếu cần."],
  ["Loại tài sản, hình thức", "Lấy theo mặc định của kế hoạch; sửa trong từng tài sản sau khi nhập."],
  ["Số dòng", `Tối đa ${PLAN_IMPORT_MAX_ROWS} dòng mỗi lần nhập.`],
];

export function downloadPlanItemsTemplate(planYear: number) {
  const wb = XLSX.utils.book_new();
  const example = [
    1,
    "Lô LK1-10, khu dân cư Đồng Chùa",
    "LK1-10",
    120,
    "Giáp đường bê tông 5 m, đã có hạ tầng",
    12000000,
    `6/${planYear}`,
  ];
  XLSX.utils.book_append_sheet(
    wb,
    styledSheet([[...PLAN_ITEM_TEMPLATE_HEADERS], example as (string | number)[]], COL_WIDTHS),
    SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(wb, styledSheet(guideRows(planYear), [32, 96]), "Hướng dẫn");
  XLSX.writeFile(wb, `mau-danh-muc-ke-hoach-${planYear}.xlsx`);
}

/** Dòng xuất của một tài sản — đúng bảy cột của biểu mẫu. */
export interface PlanItemExportRow {
  item_code: string;
  title: string;
  lot_labels: string | null;
  area_m2: number | null;
  location: string | null;
  unit_start_price: number | null;
  planned_month: string | null;
  asset_type: AuctionPlanAssetType;
  allocation_form: keyof typeof AUCTION_PLAN_ALLOCATION_FORM_LABELS | null;
  planned_method: keyof typeof AUCTION_PLAN_METHOD_LABELS;
  expected_start_value: number | null;
}

/**
 * Xuất danh mục đang có: sheet 1 là bảy cột của biểu mẫu chính thức (dán được
 * vào văn bản trình), sheet 2 là các trường còn lại để không mất dữ liệu.
 */
export function downloadPlanItemsExport(fileStem: string, items: readonly PlanItemExportRow[]) {
  const official: (string | number)[][] = [
    [...PLAN_ITEM_TEMPLATE_HEADERS],
    ...items.map((it, i) => [
      i + 1,
      it.title,
      it.lot_labels ?? "",
      it.area_m2 ?? "",
      it.location ?? "",
      it.unit_start_price ?? "",
      monthLabel(it.planned_month),
    ]),
  ];
  const totalArea = items.reduce((s, it) => s + Number(it.area_m2 ?? 0), 0);
  official.push(["", "Tổng", "", totalArea || "", "", "", ""]);

  const extra: (string | number)[][] = [
    ["Mã tài sản", "Tên lô đất", "Loại tài sản", "Hình thức giao đất", "Hình thức đấu giá", "Giá trị khởi điểm dự kiến (đồng)"],
    ...items.map((it) => [
      it.item_code,
      it.title,
      AUCTION_PLAN_ASSET_TYPE_LABELS[it.asset_type],
      it.allocation_form ? AUCTION_PLAN_ALLOCATION_FORM_LABELS[it.allocation_form] : "",
      AUCTION_PLAN_METHOD_LABELS[it.planned_method],
      it.expected_start_value ?? "",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, styledSheet(official, COL_WIDTHS), SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, styledSheet(extra, [14, 44, 22, 30, 24, 28]), "Thông tin thêm");
  XLSX.writeFile(wb, `${fileStem}.xlsx`);
}

export function downloadPlanItemIssues(issues: readonly PlanItemIssue[]) {
  const ws = styledSheet(
    [["Dòng", "Tên lô đất", "Lý do"], ...[...issues].sort((a, b) => a.row - b.row).map((i) => [i.row, i.title, i.reason])],
    [8, 44, 56],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dòng chưa ghi");
  XLSX.writeFile(wb, "ke-hoach-dong-chua-ghi.xlsx");
}

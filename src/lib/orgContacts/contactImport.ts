// Import danh bạ khách hàng của tổ chức từ Excel/CSV.
//
// Logic thuần (trừ đọc File / ghi file). Phân loại ở client chỉ để XEM TRƯỚC;
// server (org_import_contacts) vẫn tự bỏ dòng trùng qua unique index.

import * as XLSX from "xlsx-js-style";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { EMAIL_RE } from "@/lib/marketing/importClassify";
import { phoneDigits } from "./phone";
import type { OrgContactImportRow } from "@/types/org-contacts";

export const CONTACT_TEMPLATE_HEADERS = [
  "Họ tên *",
  "Loại (cá nhân/tổ chức)",
  "Tên công ty",
  "Điện thoại",
  "Email",
  "Zalo",
  "Tỉnh/thành",
  "Đồng ý nhận tin (có/không)",
  "Loại tài sản quan tâm",
  "Tỉnh quan tâm",
  "Giá từ",
  "Giá đến",
  "Nhóm",
  "Ghi chú",
];

export interface ParsedContactRow extends OrgContactImportRow {
  /** Tên loại tài sản không nhận ra — bị bỏ, dòng vẫn hợp lệ. */
  unknownCategories: string[];
}

export interface ContactIssue {
  row: number;
  name: string;
  reason: string;
}

export interface ClassifiedContacts {
  valid: ParsedContactRow[];
  invalid: ContactIssue[];
  duplicates: ContactIssue[];
}

// ─── Chuẩn hoá ───────────────────────────────────────────────────────────────

export const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

const normalizeHeader = (h: unknown): string =>
  fold(String(h ?? "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const cell = (v: unknown): string => String(v ?? "").trim();

const splitList = (v: unknown): string[] =>
  cell(v)
    .split(/[,;|\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

type ColKey =
  | "full_name" | "contact_type" | "company_name" | "phone" | "email" | "zalo" | "province"
  | "consent" | "categories" | "interest_provinces" | "price_min" | "price_max" | "groups" | "note";

// Thứ tự QUAN TRỌNG: luật cụ thể đứng trước ("Tỉnh quan tâm" trước "Tỉnh/thành",
// "Loại tài sản" trước "Loại (cá nhân/tổ chức)").
const HEADER_RULES: [ColKey, (h: string) => boolean][] = [
  ["interest_provinces", (h) => h.includes("tinh") && h.includes("quan tam")],
  ["categories", (h) => h.includes("loai tai san") || h.includes("tai san quan tam")],
  ["consent", (h) => h.includes("dong y")],
  ["contact_type", (h) => h.startsWith("loai")],
  ["company_name", (h) => h.includes("cong ty")],
  ["full_name", (h) => h.includes("ho ten") || h === "ten" || h.includes("ten khach") || h.includes("full name")],
  ["phone", (h) => h.includes("dien thoai") || h === "sdt" || h.includes("phone")],
  ["email", (h) => h.includes("email")],
  ["zalo", (h) => h.includes("zalo")],
  ["price_min", (h) => h.includes("gia tu") || h.includes("gia toi thieu")],
  ["price_max", (h) => h.includes("gia den") || h.includes("gia toi da")],
  ["province", (h) => h.includes("tinh") || h.includes("thanh pho")],
  ["groups", (h) => h.includes("nhom")],
  ["note", (h) => h.includes("ghi chu")],
];

export function detectColumns(headerRow: unknown[]): Partial<Record<ColKey, number>> {
  const map: Partial<Record<ColKey, number>> = {};
  headerRow.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    const hit = HEADER_RULES.find(([key, test]) => map[key] === undefined && test(h));
    if (hit) map[hit[0]] = idx;
  });
  return map;
}

const CATEGORY_BY_FOLD = new Map<string, string>(
  ASSET_CATEGORIES.flatMap((p) => [
    [fold(p.name).toLowerCase(), p.slug],
    [p.slug, p.slug],
    ...p.children.flatMap((c) => [
      [fold(c.name).toLowerCase(), c.slug],
      [c.slug, c.slug],
    ]),
  ] as [string, string][]),
);

/** "10 tỷ" / "1,5 tỷ" / "500 triệu" / "1,500,000,000" / 1500000000 → số VND. */
export function parseVndAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  const s = fold(cell(raw)).toLowerCase().replace(/\s*(vnd|d|dong|₫)$/, "").trim();
  if (!s) return null;
  const m = s.match(/^([\d.,]+)\s*(ty|trieu|tr|k|nghin)?$/);
  if (!m) return null;
  const unit = m[2];
  if (!unit) {
    const digits = m[1].replace(/[.,]/g, "");
    return digits ? Number(digits) : null;
  }
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const mult = unit === "ty" ? 1e9 : unit === "trieu" || unit === "tr" ? 1e6 : 1e3;
  return Math.round(n * mult);
}

const YES = new Set(["co", "yes", "y", "true", "1", "x", "dong y"]);
export const parseConsent = (raw: unknown): boolean => YES.has(fold(cell(raw)).toLowerCase());

/** Excel hay nuốt số 0 đầu của SĐT lưu dạng số. */
const importedPhone = (raw: unknown): string | null => {
  const s = cell(raw);
  if (!s) return null;
  return /^\d{9,10}$/.test(s) && !s.startsWith("0") ? `0${s}` : s;
};

// ─── Đọc bảng ────────────────────────────────────────────────────────────────

/** Mảng 2 chiều (dòng đầu là tiêu đề) → dòng khách. Bỏ dòng trống. */
export function rowsFromSheet(aoa: unknown[][]): ParsedContactRow[] {
  if (aoa.length < 2) return [];
  const col = detectColumns(aoa[0] ?? []);
  const get = (cells: unknown[], key: ColKey): unknown => (col[key] === undefined ? "" : cells[col[key]!]);
  const out: ParsedContactRow[] = [];

  aoa.slice(1).forEach((cells, i) => {
    if (!cells || cells.every((c) => cell(c) === "")) return;
    const categories: string[] = [];
    const unknownCategories: string[] = [];
    for (const token of splitList(get(cells, "categories"))) {
      const slug = CATEGORY_BY_FOLD.get(fold(token).toLowerCase());
      if (slug) {
        if (!categories.includes(slug)) categories.push(slug);
      } else unknownCategories.push(token);
    }
    const typeRaw = fold(cell(get(cells, "contact_type"))).toLowerCase();
    out.push({
      row: i + 2,
      full_name: cell(get(cells, "full_name")),
      contact_type: typeRaw.includes("to chuc") || typeRaw.includes("cong ty") ? "company" : "individual",
      company_name: cell(get(cells, "company_name")) || null,
      phone: importedPhone(get(cells, "phone")),
      email: cell(get(cells, "email")).toLowerCase() || null,
      zalo: importedPhone(get(cells, "zalo")),
      province: cell(get(cells, "province")) || null,
      note: cell(get(cells, "note")) || null,
      notifications_enabled: parseConsent(get(cells, "consent")),
      categories,
      provinces: splitList(get(cells, "interest_provinces")),
      price_min: parseVndAmount(get(cells, "price_min")),
      price_max: parseVndAmount(get(cells, "price_max")),
      groups: splitList(get(cells, "groups")),
      unknownCategories,
    });
  });
  return out;
}

export function parseContactFile(file: File): Promise<ParsedContactRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        resolve(rowsFromSheet(aoa));
      } catch {
        reject(new Error("Không đọc được file. Vui lòng dùng file .xlsx hoặc .csv."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Phân loại ───────────────────────────────────────────────────────────────

export function classifyContacts(
  rows: ParsedContactRow[],
  existing: { phone_digits: string | null; email: string | null }[],
): ClassifiedContacts {
  const phones = new Set(existing.map((c) => c.phone_digits).filter(Boolean) as string[]);
  const emails = new Set(existing.map((c) => c.email?.trim().toLowerCase()).filter(Boolean) as string[]);
  const res: ClassifiedContacts = { valid: [], invalid: [], duplicates: [] };

  for (const r of rows) {
    const issue = (reason: string): ContactIssue => ({ row: r.row, name: r.full_name || "(không tên)", reason });
    const digits = phoneDigits(r.phone);
    if (r.full_name.length < 2) {
      res.invalid.push(issue("Thiếu họ tên"));
      continue;
    }
    if (!r.phone && !r.email && !r.zalo) {
      res.invalid.push(issue("Không có SĐT, email hoặc Zalo"));
      continue;
    }
    if (r.email && !EMAIL_RE.test(r.email)) {
      res.invalid.push(issue("Email sai định dạng"));
      continue;
    }
    if (r.phone && !/^0\d{9,10}$/.test(digits ?? "")) {
      res.invalid.push(issue("Số điện thoại không hợp lệ"));
      continue;
    }
    if ((digits && phones.has(digits)) || (r.email && emails.has(r.email))) {
      res.duplicates.push(issue("Trùng SĐT hoặc email đã có"));
      continue;
    }
    if (digits) phones.add(digits);
    if (r.email) emails.add(r.email);
    res.valid.push(r);
  }
  return res;
}

// ─── File mẫu & file lỗi ─────────────────────────────────────────────────────

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "E5F2EC" } },
  border: { bottom: { style: "medium", color: { rgb: "1F2937" } } },
};

function styledSheet(aoa: (string | number)[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  aoa[0].forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) (ws[ref] as XLSX.CellObject).s = HEADER_STYLE;
  });
  return ws;
}

export function downloadContactTemplate() {
  const ws = styledSheet(
    [
      CONTACT_TEMPLATE_HEADERS,
      [
        "Nguyễn Văn A", "cá nhân", "", "0901234567", "a@example.com", "0901234567", "TP. Hồ Chí Minh", "có",
        "Nhà phố, Đất ở", "TP. Hồ Chí Minh, Bình Dương", "5 tỷ", "12 tỷ", "Nhà đầu tư BĐS", "Gặp tại phiên tháng 8",
      ],
    ],
    [22, 20, 24, 14, 24, 14, 18, 22, 26, 26, 12, 12, 20, 24],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Khách hàng");
  XLSX.writeFile(wb, "mau-import-khach-hang.xlsx");
}

export function downloadContactIssues(issues: ContactIssue[]) {
  const ws = styledSheet(
    [["Dòng", "Họ tên", "Lý do"], ...[...issues].sort((a, b) => a.row - b.row).map((i) => [i.row, i.name, i.reason])],
    [8, 28, 32],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dòng bị bỏ");
  XLSX.writeFile(wb, "khach-hang-dong-bi-bo.xlsx");
}

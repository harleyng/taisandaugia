// Nhập kết quả phiên từ Excel (docs/owner-control-tower-plan.md Phase 8).
//
// Thuần (trừ đọc File / ghi file). Phân loại ở client để XEM TRƯỚC và chỉ gửi
// dòng hợp lệ; server (RPC owner_import_outcomes, SECURITY INVOKER) vẫn là cổng
// thật — RLS, trigger guard, unique index — và báo lỗi theo TỪNG dòng.
//
// Định danh tài sản:
//   * "Mã tài sản" (mã 8 ký tự hiện ở danh sách, hoặc đủ UUID) ⇒ tin trên sàn;
//     mã không khớp là LỖI (không tự biến thành tài sản ngoài sàn).
//   * Không có mã: tên trùng khít (bỏ dấu) DUY NHẤT một tin trong danh mục ⇒ tin
//     đó; trùng nhiều tin ⇒ lỗi; không trùng ⇒ tài sản ngoài sàn.

import * as XLSX from "xlsx-js-style";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { fold, parseVndAmount } from "@/lib/orgContacts/contactImport";
import { matchAssetId } from "@/lib/ownerAssetId";
import type { ResolvedOutcomeKind, UnsoldReason } from "@/lib/ownerOutcomes";

export const OUTCOME_IMPORT_MAX_ROWS = 500;

export const OUTCOME_TEMPLATE_HEADERS = [
  "Mã tài sản",
  "Tên tài sản *",
  "Loại tài sản",
  "Chi nhánh",
  "Tổ chức đấu giá",
  "Lượt",
  "Ngày đấu giá *",
  "Kết quả *",
  "Giá khởi điểm",
  "Giá trúng",
  "Số người tham gia",
  "Lý do / ghi chú",
];

// ─── Đọc bảng ────────────────────────────────────────────────────────────────

export interface ParsedOutcomeRow {
  /** Số dòng trong file (dòng tiêu đề = 1). */
  row: number;
  code: string;
  title: string;
  category: string;
  branch: string;
  org: string;
  round: unknown;
  date: unknown;
  outcome: string;
  startingPrice: unknown;
  winningPrice: unknown;
  participants: unknown;
  note: string;
}

type ColKey = Exclude<keyof ParsedOutcomeRow, "row">;

const cell = (v: unknown): string => String(v ?? "").replace(/\u00a0/g, " ").trim();
const folded = (v: unknown): string => fold(cell(v)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Thứ tự QUAN TRỌNG: luật cụ thể trước ("Loại tài sản" trước "Tên tài sản",
// "Giá khởi điểm"/"Giá trúng" trước mọi thứ có chữ "giá").
const HEADER_RULES: [ColKey, (h: string) => boolean][] = [
  ["code", (h) => h === "ma" || h.startsWith("ma tai san") || h.startsWith("ma tin")],
  ["category", (h) => h.startsWith("loai")],
  ["branch", (h) => h.includes("chi nhanh")],
  ["org", (h) => h.includes("to chuc")],
  ["startingPrice", (h) => h.includes("khoi diem")],
  ["winningPrice", (h) => h.includes("gia trung") || h.includes("trung gia")],
  ["participants", (h) => h.includes("nguoi") || h.includes("tham gia")],
  ["round", (h) => h.startsWith("luot") || h.includes("lan dau gia")],
  ["date", (h) => h.startsWith("ngay")],
  ["outcome", (h) => h.startsWith("ket qua")],
  ["note", (h) => h.includes("ly do") || h.includes("ghi chu")],
  ["title", (h) => h.includes("ten tai san") || h === "ten" || h === "tai san"],
];

export function detectOutcomeColumns(headerRow: unknown[]): Partial<Record<ColKey, number>> {
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
export function outcomeRowsFromSheet(aoa: unknown[][]): ParsedOutcomeRow[] {
  if (aoa.length < 2) return [];
  const col = detectOutcomeColumns(aoa[0] ?? []);
  const raw = (cells: unknown[], key: ColKey): unknown => (col[key] === undefined ? "" : cells[col[key]!]);
  const out: ParsedOutcomeRow[] = [];
  aoa.slice(1).forEach((cells, i) => {
    if (!cells || cells.every((c) => cell(c) === "")) return;
    out.push({
      row: i + 2,
      code: cell(raw(cells, "code")),
      title: cell(raw(cells, "title")),
      category: cell(raw(cells, "category")),
      branch: cell(raw(cells, "branch")),
      org: cell(raw(cells, "org")),
      round: raw(cells, "round"),
      date: raw(cells, "date"),
      outcome: cell(raw(cells, "outcome")),
      startingPrice: raw(cells, "startingPrice"),
      winningPrice: raw(cells, "winningPrice"),
      participants: raw(cells, "participants"),
      note: cell(raw(cells, "note")),
    });
  });
  return out;
}

/** Thiếu cột bắt buộc ⇒ câu lỗi (để báo ngay thay vì đổ mọi dòng thành lỗi). */
export function missingRequiredColumns(headerRow: unknown[]): string[] {
  const col = detectOutcomeColumns(headerRow);
  const missing: string[] = [];
  if (col.code === undefined && col.title === undefined) missing.push("Mã tài sản hoặc Tên tài sản");
  if (col.date === undefined) missing.push("Ngày đấu giá");
  if (col.outcome === undefined) missing.push("Kết quả");
  return missing;
}

export interface ParsedOutcomeFile {
  rows: ParsedOutcomeRow[];
  missingColumns: string[];
}

export function parseOutcomeFile(file: File): Promise<ParsedOutcomeFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const name = wb.SheetNames.find((n) => folded(n) === "ket qua") ?? wb.SheetNames[0];
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
        resolve({ rows: outcomeRowsFromSheet(aoa), missingColumns: missingRequiredColumns(aoa[0] ?? []) });
      } catch {
        reject(new Error("Không đọc được file. Vui lòng dùng file .xlsx hoặc .csv."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Chuẩn hoá từng ô ────────────────────────────────────────────────────────

export function parseOutcomeWord(raw: string): ResolvedOutcomeKind | null {
  const s = folded(raw);
  if (!s) return null;
  if (s.startsWith("khong") || s === "that bai" || s === "unsold") return "unsold";
  if (s.startsWith("thanh") || s === "da ban" || s === "ban duoc" || s === "sold") return "sold";
  if (s.startsWith("hoan") || s.startsWith("tam hoan") || s === "postponed") return "postponed";
  if (s.startsWith("huy") || s === "cancelled") return "cancelled";
  if (s.startsWith("rut") || s === "withdrawn") return "withdrawn";
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function realDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 31/02 ⇒ Date tự trôi sang tháng 3 — coi là sai.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Số ngày kiểu Excel, "dd/mm/yyyy", "d-m-yyyy", "yyyy-mm-dd" ⇒ "YYYY-MM-DD"; sai ⇒ null. */
export function parseImportDate(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const p = XLSX.SSF.parse_date_code(raw);
    return p ? realDate(p.y, p.m, p.d) : null;
  }
  const s = cell(raw);
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return realDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return realDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/** Ô trống ⇒ undefined; đọc được ⇒ số; rác ⇒ null. */
function amount(raw: unknown): number | null | undefined {
  if (cell(raw) === "") return undefined;
  return parseVndAmount(raw);
}

function wholeNumber(raw: unknown): number | null | undefined {
  const s = cell(raw);
  if (s === "") return undefined;
  return /^\d+$/.test(s) ? Number(s) : null;
}

const UNSOLD_BY_FOLD: [string, UnsoldReason][] = [
  ["khong ai dang ky", "no_registrants"],
  ["khong co nguoi dang ky", "no_registrants"],
  ["chi 1 nguoi", "single_bidder"],
  ["chi mot nguoi", "single_bidder"],
  ["bo coc", "deposit_forfeited"],
];

function unsoldReasonOf(note: string): string | null {
  const s = folded(note);
  if (!s) return null;
  const hit = UNSOLD_BY_FOLD.find(([k]) => s === k || s.startsWith(k));
  return hit ? hit[1] : note;
}

const CATEGORY_BY_FOLD = new Map<string, string>(
  ASSET_CATEGORIES.flatMap((p) => [
    [folded(p.name), p.slug],
    [p.slug, p.slug],
    ...p.children.flatMap((c) => [
      [folded(c.name), c.slug],
      [c.slug, c.slug],
    ]),
  ] as [string, string][]),
);

/** Khoá tài sản ngoài sàn phía client — khớp cột title_key ở server. */
export function offPlatformKey(title: string): string {
  return title.normalize("NFC").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
}

// ─── Phân loại ───────────────────────────────────────────────────────────────

export interface OutcomeImportPayload {
  listing_id: string | null;
  asset_title: string | null;
  asset_category: string | null;
  branch_id: string | null;
  round_no: number;
  auction_date: string;
  auction_org_id: string | null;
  outcome: ResolvedOutcomeKind;
  failure_reason: string | null;
  starting_price: number | null;
  winning_price: number | null;
  participants: number | null;
}

export interface ValidImportRow {
  row: number;
  title: string;
  /** null = tài sản ngoài sàn. */
  listingId: string | null;
  matchedBy: "code" | "name" | null;
  payload: OutcomeImportPayload;
  warnings: string[];
}

export interface ImportIssue {
  row: number;
  title: string;
  reason: string;
}

export interface ClassifiedImport {
  valid: ValidImportRow[];
  /** Số dòng chưa điền kết quả — bỏ qua, không phải lỗi. */
  skipped: number[];
  invalid: ImportIssue[];
}

export interface ImportContext {
  /** Tin ĐANG thuộc danh mục của không gian. */
  listings: { id: string; title: string }[];
  branches: { id: string; label: string }[];
  orgs: { id: string; name: string }[];
  /** null = không bị giới hạn chi nhánh. */
  branchScope: string[] | null;
  /** Người dùng ghi được kết quả cho tin này không (phạm vi chi nhánh). */
  canWriteListing: (listingId: string) => boolean;
  today: string;
}

function byFold<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = folded(key(it));
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

export function classifyOutcomeRows(rows: ParsedOutcomeRow[], ctx: ImportContext): ClassifiedImport {
  const res: ClassifiedImport = { valid: [], skipped: [], invalid: [] };
  const listingIds = ctx.listings.map((l) => l.id);
  const listingTitle = new Map(ctx.listings.map((l) => [l.id, l.title]));
  const listingsByName = byFold(ctx.listings, (l) => l.title);
  const branchByName = byFold(ctx.branches, (b) => b.label);
  const orgByName = byFold(ctx.orgs, (o) => o.name);
  const seen = new Map<string, number>();

  for (const r of rows) {
    const bad = (reason: string, title = r.title || r.code) => res.invalid.push({ row: r.row, title, reason });

    const outcome = parseOutcomeWord(r.outcome);
    if (!r.outcome) {
      res.skipped.push(r.row);
      continue;
    }
    if (!outcome) {
      bad("Kết quả không hợp lệ — dùng Thành / Không thành / Hoãn / Huỷ / Rút");
      continue;
    }

    // Tài sản
    let listingId: string | null = null;
    let matchedBy: ValidImportRow["matchedBy"] = null;
    if (r.code) {
      const m = matchAssetId(r.code, listingIds);
      if (m.kind === "invalid") { bad("Mã tài sản không hợp lệ (8 ký tự như ở danh sách tài sản)"); continue; }
      if (m.kind === "none") { bad("Mã tài sản không có trong danh mục của đơn vị"); continue; }
      if (m.kind === "ambiguous") { bad("Mã tài sản trùng nhiều tài sản — ghi đủ mã"); continue; }
      listingId = m.id;
      matchedBy = "code";
    } else {
      if (r.title.length < 3) { bad("Thiếu tên tài sản (ít nhất 3 ký tự) hoặc mã tài sản"); continue; }
      if (r.title.length > 300) { bad("Tên tài sản tối đa 300 ký tự"); continue; }
      const hits = listingsByName.get(folded(r.title)) ?? [];
      if (hits.length > 1) { bad("Tên trùng nhiều tài sản trên sàn — ghi mã tài sản"); continue; }
      if (hits.length === 1) {
        listingId = hits[0].id;
        matchedBy = "name";
      }
    }
    const title = listingId ? listingTitle.get(listingId) ?? r.title : r.title;

    // Ngày, lượt, số
    const date = parseImportDate(r.date);
    if (!cell(r.date)) { bad("Thiếu ngày đấu giá", title); continue; }
    if (!date) { bad("Ngày đấu giá không hợp lệ (dd/mm/yyyy)", title); continue; }
    if (date > ctx.today) { bad("Ngày đấu giá không được sau hôm nay", title); continue; }

    const round = wholeNumber(r.round);
    if (round === null || (round !== undefined && (round < 1 || round > 99))) { bad("Lượt phải là số từ 1 đến 99", title); continue; }

    const starting = amount(r.startingPrice);
    if (starting === null) { bad("Giá khởi điểm không đọc được", title); continue; }
    const winning = amount(r.winningPrice);
    if (winning === null) { bad("Giá trúng không đọc được", title); continue; }
    if (outcome === "sold" && !winning) { bad("Phiên thành phải có giá trúng", title); continue; }

    let participants = wholeNumber(r.participants);
    if (participants === null) { bad("Số người tham gia phải là số nguyên", title); continue; }
    if (outcome === "sold" && participants !== undefined && participants < 1) {
      bad("Phiên thành có ít nhất 1 người tham gia", title);
      continue;
    }

    let failureReason: string | null = null;
    if (outcome === "unsold") {
      failureReason = unsoldReasonOf(r.note);
      if (failureReason === "no_registrants") participants = 0;
      if (failureReason === "single_bidder") participants = 1;
    } else if (outcome !== "sold") {
      failureReason = r.note || null;
    }

    const warnings: string[] = [];

    // Chi nhánh: tin trên sàn do server suy từ claim.
    let branchId: string | null = null;
    if (listingId) {
      if (!ctx.canWriteListing(listingId)) { bad("Tài sản thuộc chi nhánh ngoài phạm vi của bạn", title); continue; }
    } else {
      if (r.branch) {
        const hits = branchByName.get(folded(r.branch)) ?? [];
        if (hits.length === 1) branchId = hits[0].id;
        else warnings.push(`Không tìm thấy chi nhánh «${r.branch}» — để trống`);
      }
      if (ctx.branchScope) {
        if (!branchId && ctx.branchScope.length === 1) {
          branchId = ctx.branchScope[0];
          warnings.push("Gắn vào chi nhánh của bạn");
        }
        if (!branchId) { bad("Chọn chi nhánh trong phạm vi của bạn", title); continue; }
        if (!ctx.branchScope.includes(branchId)) { bad("Chi nhánh ngoài phạm vi của bạn", title); continue; }
      }
    }

    let orgId: string | null = null;
    if (r.org) {
      const hits = orgByName.get(folded(r.org)) ?? [];
      if (hits.length === 1) orgId = hits[0].id;
      else warnings.push(`Không tìm thấy tổ chức «${r.org}» trong danh bạ — để trống`);
    }

    let category: string | null = null;
    if (!listingId && r.category) {
      category = CATEGORY_BY_FOLD.get(folded(r.category)) ?? null;
      if (!category) warnings.push(`Không nhận ra loại tài sản «${r.category}» — để trống`);
    }

    const roundNo = round ?? 1;
    const key = `${listingId ?? `t:${offPlatformKey(r.title)}`}#${roundNo}`;
    const dupOf = seen.get(key);
    if (dupOf !== undefined) { bad(`Trùng lượt ${roundNo} của cùng tài sản với dòng ${dupOf}`, title); continue; }
    seen.set(key, r.row);

    res.valid.push({
      row: r.row,
      title,
      listingId,
      matchedBy,
      warnings,
      payload: {
        listing_id: listingId,
        asset_title: listingId ? null : r.title,
        asset_category: category,
        branch_id: branchId,
        round_no: roundNo,
        auction_date: date,
        auction_org_id: orgId,
        outcome,
        failure_reason: failureReason,
        starting_price: starting ?? null,
        winning_price: outcome === "sold" ? winning ?? null : null,
        participants: participants ?? null,
      },
    });
  }
  return res;
}

// ─── Kết quả từ server ───────────────────────────────────────────────────────

export interface ImportRowResult {
  idx: number;
  ok: boolean;
  code?: string | null;
  message?: string | null;
}

export function importFailureReason(code: string | null | undefined, message: string | null | undefined): string {
  if (code === "23505") return "Lượt này đã được khai cho tài sản này";
  if (code === "42501") return "Ngoài phạm vi chi nhánh hoặc không có quyền ghi";
  if (code === "23514") {
    return /outcome_title_len|outcome_needs_asset/.test(message ?? "")
      ? "Tên tài sản cần từ 3 đến 300 ký tự"
      : "Phiên thành phải có giá trúng";
  }
  if (code === "P0001" && message) return message;
  if (code?.startsWith("22")) return "Dữ liệu không đúng định dạng";
  return "Không ghi được dòng này";
}

/** Ghép kết quả RPC (theo thứ tự payload) với số dòng trong file. */
export function mergeImportResults(
  valid: ValidImportRow[],
  results: ImportRowResult[],
): { written: number; failures: ImportIssue[] } {
  let written = 0;
  const failures: ImportIssue[] = [];
  for (const r of results) {
    const v = valid[r.idx];
    if (!v) continue;
    if (r.ok) written += 1;
    else failures.push({ row: v.row, title: v.title, reason: importFailureReason(r.code, r.message) });
  }
  return { written, failures };
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

const GUIDE: (string | number)[][] = [
  ["Cột", "Cách điền"],
  ["Mã tài sản", "Mã 8 ký tự hiện dưới tên tài sản ở trang Tài sản / Kết quả phiên. Để trống nếu là tài sản ngoài sàn."],
  ["Tên tài sản *", "Bắt buộc khi không có mã. Tài sản ngoài sàn được nhận diện theo tên — ghi giống nhau giữa các lượt."],
  ["Loại tài sản", "Tuỳ chọn, ví dụ: Đất ở, Nhà phố, Căn hộ, Ô tô, Xe tải, Máy móc."],
  ["Chi nhánh", "Tên chi nhánh như ở trang Chi nhánh. Tài sản trên sàn tự lấy chi nhánh theo danh mục."],
  ["Tổ chức đấu giá", "Tên tổ chức trong danh bạ; không tìm thấy thì để trống."],
  ["Lượt", "Số lượt đấu (1, 2, 3…). Để trống = 1."],
  ["Ngày đấu giá *", "dd/mm/yyyy, không sau hôm nay."],
  ["Kết quả *", "Thành / Không thành / Hoãn / Huỷ / Rút. Để trống = bỏ qua dòng này."],
  ["Giá khởi điểm, Giá trúng", "Số tiền đồng, ví dụ 1,500,000,000 hoặc 1,5 tỷ. Phiên thành bắt buộc có giá trúng."],
  ["Số người tham gia", "Số nguyên."],
  ["Lý do / ghi chú", "Không thành: Không ai đăng ký / Chỉ 1 người / Bỏ cọc / lý do khác. Hoãn, huỷ: ghi lý do."],
  ["", ""],
  ["Ví dụ", ""],
  ["Mã tài sản", "3F9A12BC"],
  ["Tên tài sản", "QSDĐ thửa 123, tờ bản đồ 45, xã An Phú"],
  ["Kết quả", "Thành"],
  ["Giá trúng", "12,400,000,000"],
];

export function downloadOutcomeTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    styledSheet([OUTCOME_TEMPLATE_HEADERS], [12, 40, 16, 24, 28, 7, 14, 13, 18, 18, 10, 30]),
    "Kết quả",
  );
  XLSX.utils.book_append_sheet(wb, styledSheet(GUIDE, [24, 90]), "Hướng dẫn");
  XLSX.writeFile(wb, "mau-nhap-ket-qua-phien.xlsx");
}

export function downloadOutcomeIssues(issues: ImportIssue[]) {
  const ws = styledSheet(
    [["Dòng", "Tài sản", "Lý do"], ...[...issues].sort((a, b) => a.row - b.row).map((i) => [i.row, i.title, i.reason])],
    [8, 40, 50],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dòng chưa ghi");
  XLSX.writeFile(wb, "ket-qua-phien-dong-chua-ghi.xlsx");
}

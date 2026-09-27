// Nhập tài sản từ Excel (menu "Số hoá tài sản").
//
// Mỗi dòng hợp lệ ⇒ MỘT hồ sơ NHÁP; ảnh + giấy tờ bổ sung sau trong wizard, nên
// thiếu thông số bắt buộc của loại tài sản KHÔNG phải lỗi (% hoàn thiện ở danh
// sách sẽ báo). Phân loại ở client để XEM TRƯỚC; RPC owner_import_postings
// (SECURITY INVOKER) mới là cổng thật — RLS so-hoa:create + phạm vi chi nhánh —
// và báo lỗi theo TỪNG dòng.
//
// File mẫu: MỘT sheet cho mỗi nhóm tài sản, cột = cột chung + hợp các trường
// riêng (ASSET_DELTA_FIELDS) của các loại trong nhóm — sinh từ registry nên thêm
// loại/trường mới là file mẫu tự đổi. Khi đọc, loại tài sản lấy từ cột "Loại tài
// sản" (tên loại là duy nhất toàn sàn) chứ không từ tên sheet, nên sheet đổi tên
// hay file .csv một sheet vẫn đọc được.

import * as XLSX from "xlsx-js-style";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields, type DeltaFieldDescriptor } from "@/constants/asset-delta-fields";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { VIETNAM_PROVINCE_NAMES } from "@/constants/vietnam-provinces";
import { fold, parseVndAmount } from "@/lib/orgContacts/contactImport";

export const POSTING_IMPORT_MAX_ROWS = 500;
const TITLE_MAX = 300;
const TEXT_MAX = 5000;
const GUIDE_SHEET = "Hướng dẫn";

// ─── Chuẩn hoá ───────────────────────────────────────────────────────────────

const cell = (v: unknown): string => String(v ?? "").replace(/\u00a0/g, " ").trim();
const norm = (v: unknown): string =>
  fold(cell(v)).toLowerCase().replace(/\*/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
/** Bỏ phần đơn vị trong ngoặc: "Giá khởi điểm (VND)" ⇒ "gia khoi diem". */
const normNoUnit = (v: unknown): string => norm(cell(v).replace(/\([^)]*\)/g, " "));

// ─── Nhóm & cột ──────────────────────────────────────────────────────────────

type CommonKey =
  | "title"
  | "child"
  | "province"
  | "district"
  | "ward"
  | "address"
  | "branch"
  | "description"
  | "startingPrice"
  | "auctionFormat"
  | "hasDispute"
  | "hasMortgage"
  | "isSeized"
  | "legalNotes";

interface CommonColumn {
  key: CommonKey;
  header: string;
  width: number;
  guide: string;
  /** Tên cột khác được chấp nhận (đã norm, bỏ đơn vị). */
  aliases: string[];
  workspaceOnly?: boolean;
}

const COMMON_COLUMNS: CommonColumn[] = [
  { key: "title", header: "Tên tài sản *", width: 40, aliases: ["ten tai san", "ten", "tai san", "tieu de"],
    guide: "Bắt buộc, 3–300 ký tự. Ví dụ: QSDĐ thửa 123, tờ bản đồ 45, xã An Phú." },
  { key: "child", header: "Loại tài sản *", width: 18, aliases: ["loai tai san", "loai", "danh muc"],
    guide: "Bắt buộc. Một trong các loại liệt kê bên dưới cho nhóm của sheet." },
  { key: "province", header: "Tỉnh/Thành phố *", width: 18, aliases: ["tinh thanh pho", "tinh thanh", "tinh", "thanh pho"],
    guide: "Bắt buộc. Tên tỉnh/thành, ví dụ: Hà Nội, TP. Hồ Chí Minh, Đồng Nai." },
  { key: "district", header: "Quận/Huyện", width: 16, aliases: ["quan huyen", "quan", "huyen"],
    guide: "Ví dụ: Quận 1, Huyện Củ Chi." },
  { key: "ward", header: "Phường/Xã", width: 18, aliases: ["phuong xa", "phuong", "xa"],
    guide: "Ví dụ: Phường Bến Nghé." },
  { key: "address", header: "Địa chỉ", width: 28, aliases: ["dia chi", "dia chi chi tiet", "so nha duong"],
    guide: "Số nhà, đường." },
  { key: "branch", header: "Chi nhánh", width: 22, aliases: ["chi nhanh"], workspaceOnly: true,
    guide: "Tên chi nhánh như ở trang Chi nhánh. Cán bộ chi nhánh bắt buộc ghi chi nhánh trong phạm vi của mình." },
  { key: "description", header: "Mô tả", width: 36, aliases: ["mo ta"],
    guide: "Mô tả tình trạng, đặc điểm nổi bật." },
  { key: "startingPrice", header: "Giá khởi điểm (VND)", width: 18, aliases: ["gia khoi diem", "gia"],
    guide: "Giá mong muốn, ví dụ 1,500,000,000 hoặc 1,5 tỷ. Để trống nếu chưa có." },
  { key: "auctionFormat", header: "Hình thức đấu giá", width: 16, aliases: ["hinh thuc dau gia", "hinh thuc"],
    guide: "Trực tiếp / Trực tuyến / Cả hai. Để trống = Trực tiếp." },
  { key: "hasDispute", header: "Đang tranh chấp", width: 14, aliases: ["dang tranh chap", "tranh chap"],
    guide: "Có / Không. Để trống = chưa trả lời." },
  { key: "hasMortgage", header: "Đang thế chấp", width: 14, aliases: ["dang the chap", "the chap"],
    guide: "Có / Không." },
  { key: "isSeized", header: "Bị kê biên", width: 12, aliases: ["bi ke bien", "ke bien"],
    guide: "Có / Không." },
  { key: "legalNotes", header: "Ghi chú pháp lý", width: 28, aliases: ["ghi chu phap ly", "ghi chu"],
    guide: "Ghi chú thêm về giấy tờ, tình trạng pháp lý." },
];

export interface ImportGroup {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
  /** Cột trường riêng của nhóm (hợp theo tên cột + đơn vị). */
  deltaColumns: { header: string; label: string; unit?: string; required: boolean }[];
}

const headerOf = (d: DeltaFieldDescriptor) => (d.unit ? `${d.label} (${d.unit})` : d.label);

/** Nhóm có loại con (nhóm "Khác" không có loại ⇒ không nhập được, như wizard). */
export const IMPORT_GROUPS: ImportGroup[] = ASSET_CATEGORIES.filter((g) => g.children.length > 0).map((g) => {
  const cols = new Map<string, { header: string; label: string; unit?: string; requiredIn: number; presentIn: number }>();
  for (const ch of g.children) {
    for (const d of getDeltaFields(ch.slug)) {
      const header = headerOf(d);
      const c = cols.get(header) ?? { header, label: d.label, unit: d.unit, requiredIn: 0, presentIn: 0 };
      c.presentIn += 1;
      if (d.required) c.requiredIn += 1;
      cols.set(header, c);
    }
  }
  return {
    slug: g.slug,
    name: g.name,
    children: g.children.map((c) => ({ slug: c.slug, name: c.name })),
    // "*" chỉ khi bắt buộc với MỌI loại có trường đó — nếu không sẽ gây hiểu nhầm.
    deltaColumns: [...cols.values()].map((c) => ({
      header: c.requiredIn === c.presentIn ? `${c.header} *` : c.header,
      label: c.label,
      unit: c.unit,
      required: c.requiredIn === c.presentIn,
    })),
  };
});

const CHILD_BY_NAME = new Map<string, { parent: string; child: string }>(
  IMPORT_GROUPS.flatMap((g) =>
    g.children.flatMap((c) => [
      [norm(c.name), { parent: g.slug, child: c.slug }],
      [c.slug, { parent: g.slug, child: c.slug }],
    ]),
  ) as [string, { parent: string; child: string }][],
);

// ─── Địa danh ────────────────────────────────────────────────────────────────

const PROVINCE_PREFIX = /^(tp|thanh pho|tinh)\s+/;
const provinceKey = (s: string) => {
  const k = norm(s).replace(PROVINCE_PREFIX, "");
  return k === "hcm" || k === "sai gon" || k === "tphcm" ? "ho chi minh" : k;
};
const PROVINCE_BY_KEY = new Map<string, string>(
  [...VIETNAM_PROVINCE_NAMES, ...vietnamProvinces.map((p) => p.name)].map((n) => [provinceKey(n), n]),
);

const DISTRICT_PREFIX = /^(quan|huyen|thi xa|thanh pho|tp)\s+/;
const WARD_PREFIX = /^(phuong|xa|thi tran)\s+/;

function findPlace<T>(items: T[], name: (t: T) => string, raw: string, prefix: RegExp): T | undefined {
  const k = norm(raw);
  const bare = k.replace(prefix, "");
  return (
    items.find((t) => norm(name(t)) === k) ??
    items.find((t) => norm(name(t)).replace(prefix, "") === bare)
  );
}

// ─── Đọc bảng ────────────────────────────────────────────────────────────────

export interface ParsedPostingRow {
  sheet: string;
  /** Số dòng trong sheet (dòng tiêu đề = 1). */
  row: number;
  common: Partial<Record<CommonKey, unknown>>;
  /** Tên cột đã norm ⇒ giá trị ô (mọi cột không phải cột chung). */
  extra: Map<string, unknown>;
}

export function detectCommonColumns(headerRow: unknown[]): Partial<Record<CommonKey, number>> {
  const map: Partial<Record<CommonKey, number>> = {};
  headerRow.forEach((raw, idx) => {
    const h = normNoUnit(raw);
    if (!h) return;
    const hit = COMMON_COLUMNS.find((c) => map[c.key] === undefined && c.aliases.includes(h));
    if (hit) map[hit.key] = idx;
  });
  return map;
}

/** Mảng 2 chiều của một sheet (dòng đầu là tiêu đề) ⇒ dòng thô. Bỏ dòng trống hoàn toàn. */
export function postingRowsFromSheet(sheet: string, aoa: unknown[][]): ParsedPostingRow[] {
  if (aoa.length < 2) return [];
  const header = aoa[0] ?? [];
  const col = detectCommonColumns(header);
  const commonIdx = new Set(Object.values(col));
  const extraCols: [string, number][] = [];
  header.forEach((h, idx) => {
    if (!commonIdx.has(idx) && norm(h)) extraCols.push([norm(h), idx]);
  });
  const out: ParsedPostingRow[] = [];
  aoa.slice(1).forEach((cells, i) => {
    if (!cells || cells.every((c) => cell(c) === "")) return;
    const common: ParsedPostingRow["common"] = {};
    for (const [key, idx] of Object.entries(col) as [CommonKey, number][]) common[key] = cells[idx];
    out.push({ sheet, row: i + 2, common, extra: new Map(extraCols.map(([h, idx]) => [h, cells[idx]])) });
  });
  return out;
}

export interface ParsedPostingFile {
  rows: ParsedPostingRow[];
  /** Không sheet nào có đủ cột bắt buộc ⇒ tên các cột còn thiếu. */
  missingColumns: string[];
}

/** Workbook ⇒ dòng thô của MỌI sheet có cột "Tên tài sản" (trừ sheet hướng dẫn). */
export function postingRowsFromWorkbook(wb: XLSX.WorkBook): ParsedPostingFile {
  const rows: ParsedPostingRow[] = [];
  let sawTitle = false;
  let sawChild = false;
  let sawProvince = false;
  for (const name of wb.SheetNames) {
    if (norm(name) === norm(GUIDE_SHEET)) continue;
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
    const col = detectCommonColumns(aoa[0] ?? []);
    if (col.title === undefined) continue;
    sawTitle = true;
    if (col.child !== undefined) sawChild = true;
    if (col.province !== undefined) sawProvince = true;
    rows.push(...postingRowsFromSheet(name, aoa));
  }
  const missingColumns: string[] = [];
  if (!sawTitle) missingColumns.push("Tên tài sản");
  if (!sawChild) missingColumns.push("Loại tài sản");
  if (!sawProvince) missingColumns.push("Tỉnh/Thành phố");
  return { rows, missingColumns };
}

export function parsePostingFile(file: File): Promise<ParsedPostingFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(postingRowsFromWorkbook(XLSX.read(e.target?.result, { type: "array" })));
      } catch {
        reject(new Error("Không đọc được file. Vui lòng dùng file .xlsx hoặc .csv."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Chuẩn hoá từng ô ────────────────────────────────────────────────────────

/** "Có"/"Không" ⇒ boolean; trống ⇒ null; không hiểu ⇒ undefined. */
export function parseYesNo(raw: unknown): boolean | null | undefined {
  if (typeof raw === "boolean") return raw;
  const s = norm(raw);
  if (!s) return null;
  if (["co", "yes", "y", "x", "1", "true", "dung"].includes(s)) return true;
  if (["khong", "no", "n", "0", "false", "sai"].includes(s)) return false;
  return undefined;
}

/** "1,234.5" / "85,5" / "120 m2" / 1234 ⇒ số; không đọc được ⇒ null. */
export function parseImportNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  // Bỏ đơn vị ở đuôi: "120 m2", "85m²", "3 tấn".
  const s = cell(raw).replace(/\s+/g, "").replace(/(\d)[^\d.,].*$/, "$1");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^-?\d+([.,]\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return null;
}

export type AuctionFormat = "truc_tiep" | "truc_tuyen" | "ca_hai";

export function parseAuctionFormat(raw: unknown): AuctionFormat | null | undefined {
  const s = norm(raw);
  if (!s) return null;
  if (s.startsWith("truc tiep") || s === "offline") return "truc_tiep";
  if (s.startsWith("truc tuyen") || s === "online") return "truc_tuyen";
  if (s.startsWith("ca hai") || s.startsWith("ket hop") || s === "hybrid") return "ca_hai";
  return undefined;
}

function deltaValue(d: DeltaFieldDescriptor, raw: unknown): { value?: string | number | boolean; bad?: boolean } {
  if (cell(raw) === "") return {};
  if (d.type === "number") {
    const n = parseImportNumber(raw);
    return n === null || n < 0 ? { bad: true } : { value: n };
  }
  if (d.type === "select") {
    const k = norm(raw);
    const hit = d.options?.find((o) => norm(o.label) === k || o.value === cell(raw));
    return hit ? { value: hit.value } : { bad: true };
  }
  if (d.type === "boolean") {
    const b = parseYesNo(raw);
    return b === undefined || b === null ? { bad: true } : { value: b };
  }
  return { value: cell(raw).slice(0, TEXT_MAX) };
}

// ─── Phân loại ───────────────────────────────────────────────────────────────

export interface PostingImportPayload {
  parent_slug: string;
  child_slug: string;
  title: string;
  description: string | null;
  province: string;
  district: string | null;
  ward: string | null;
  address: string | null;
  branch_id: string | null;
  starting_price: number | null;
  auction_format: AuctionFormat | null;
  has_dispute: boolean | null;
  has_mortgage: boolean | null;
  is_seized: boolean | null;
  legal_notes: string | null;
  delta_fields: Record<string, string | number | boolean>;
}

export interface ValidPostingRow {
  sheet: string;
  row: number;
  title: string;
  payload: PostingImportPayload;
  warnings: string[];
}

export interface PostingImportIssue {
  sheet: string;
  row: number;
  title: string;
  reason: string;
}

export interface ClassifiedPostingImport {
  valid: ValidPostingRow[];
  invalid: PostingImportIssue[];
}

export interface PostingImportContext {
  /** false = tenant Cá nhân: bỏ qua cột Chi nhánh. */
  isWorkspace: boolean;
  branches: { id: string; label: string; isActive?: boolean }[];
  /** null = không bị giới hạn chi nhánh. */
  branchScope: string[] | null;
  /** Hồ sơ đã có của tenant — để cảnh báo trùng. */
  existing: { title: string; province: string | null; code: string }[];
}

const dupKey = (title: string, province: string) => `${norm(title)}#${provinceKey(province)}`;

export function classifyPostingRows(rows: ParsedPostingRow[], ctx: PostingImportContext): ClassifiedPostingImport {
  const res: ClassifiedPostingImport = { valid: [], invalid: [] };
  const existingByKey = new Map(ctx.existing.map((e) => [dupKey(e.title, e.province ?? ""), e.code]));
  const activeBranches = ctx.branches.filter((b) => b.isActive !== false);
  const seen = new Map<string, string>();

  for (const r of rows) {
    const title = cell(r.common.title);
    const bad = (reason: string) => res.invalid.push({ sheet: r.sheet, row: r.row, title, reason });
    const warnings: string[] = [];

    if (title.length < 3) { bad("Thiếu tên tài sản (ít nhất 3 ký tự)"); continue; }
    if (title.length > TITLE_MAX) { bad(`Tên tài sản tối đa ${TITLE_MAX} ký tự`); continue; }

    const childRaw = cell(r.common.child);
    if (!childRaw) { bad("Thiếu loại tài sản"); continue; }
    const cat = CHILD_BY_NAME.get(norm(childRaw)) ?? CHILD_BY_NAME.get(childRaw);
    if (!cat) { bad(`Không nhận ra loại tài sản «${childRaw}» — xem sheet Hướng dẫn`); continue; }

    const provinceRaw = cell(r.common.province);
    if (!provinceRaw) { bad("Thiếu tỉnh/thành phố"); continue; }
    const province = PROVINCE_BY_KEY.get(provinceKey(provinceRaw));
    if (!province) { bad(`Không nhận ra tỉnh/thành «${provinceRaw}»`); continue; }

    // Quận/phường: chỉ kiểm được với tỉnh có dữ liệu chi tiết; tỉnh khác giữ nguyên chữ.
    let district: string | null = cell(r.common.district) || null;
    let ward: string | null = cell(r.common.ward) || null;
    const detail = vietnamProvinces.find((p) => p.name === province);
    if (detail && district) {
      const d = findPlace(detail.districts, (x) => x.name, district, DISTRICT_PREFIX);
      if (!d) {
        warnings.push(`Không tìm thấy quận/huyện «${district}» ở ${province} — để trống`);
        district = null;
        ward = null;
      } else {
        district = d.name;
        if (ward) {
          const w = findPlace(d.wards, (x) => x, ward, WARD_PREFIX);
          if (!w) {
            warnings.push(`Không tìm thấy phường/xã «${ward}» ở ${d.name} — để trống`);
            ward = null;
          } else ward = w;
        }
      }
    } else if (detail && ward) {
      warnings.push("Có phường/xã nhưng thiếu quận/huyện — bỏ phường/xã");
      ward = null;
    }

    // Chi nhánh
    let branchId: string | null = null;
    const branchRaw = cell(r.common.branch);
    if (ctx.isWorkspace) {
      if (branchRaw) {
        const hits = activeBranches.filter((b) => norm(b.label) === norm(branchRaw));
        if (hits.length === 1) branchId = hits[0].id;
        else if (!ctx.branchScope) warnings.push(`Không tìm thấy chi nhánh «${branchRaw}» — để trống`);
      }
      if (ctx.branchScope) {
        if (!branchId && ctx.branchScope.length === 1) {
          branchId = ctx.branchScope[0];
          warnings.push(branchRaw ? `Không tìm thấy chi nhánh «${branchRaw}» — gắn vào chi nhánh của bạn` : "Gắn vào chi nhánh của bạn");
        }
        if (!branchId) { bad(branchRaw ? `Không tìm thấy chi nhánh «${branchRaw}»` : "Chọn chi nhánh trong phạm vi của bạn"); continue; }
        if (!ctx.branchScope.includes(branchId)) { bad("Chi nhánh ngoài phạm vi của bạn"); continue; }
      }
    }

    // Giá, hình thức, pháp lý
    let startingPrice: number | null = null;
    if (cell(r.common.startingPrice)) {
      const p = parseVndAmount(r.common.startingPrice);
      if (p && p > 0) startingPrice = p;
      else warnings.push("Giá khởi điểm không đọc được — để trống");
    }
    let auctionFormat = parseAuctionFormat(r.common.auctionFormat);
    if (auctionFormat === undefined) {
      warnings.push("Hình thức đấu giá không hợp lệ — dùng Trực tiếp");
      auctionFormat = null;
    }
    const yn = (key: CommonKey, label: string): boolean | null => {
      const v = parseYesNo(r.common[key]);
      if (v === undefined) {
        warnings.push(`«${label}» chỉ nhận Có / Không — để trống`);
        return null;
      }
      return v;
    };
    const hasDispute = yn("hasDispute", "Đang tranh chấp");
    const hasMortgage = yn("hasMortgage", "Đang thế chấp");
    const isSeized = yn("isSeized", "Bị kê biên");

    // Trường riêng theo loại
    const delta: Record<string, string | number | boolean> = {};
    for (const d of getDeltaFields(cat.child)) {
      const key = [norm(headerOf(d)), norm(d.label)].find((k) => r.extra.has(k));
      if (!key) continue;
      const { value, bad: invalid } = deltaValue(d, r.extra.get(key));
      if (invalid) warnings.push(`«${d.label}» không hợp lệ — để trống`);
      else if (value !== undefined) delta[d.key] = value;
    }

    const k = dupKey(title, province);
    const dupRow = seen.get(k);
    if (dupRow) { bad(`Trùng tên và tỉnh/thành với ${dupRow}`); continue; }
    seen.set(k, `${r.sheet} dòng ${r.row}`);
    const existingCode = existingByKey.get(k);
    if (existingCode) warnings.push(`Có thể trùng hồ sơ ${existingCode}`);

    res.valid.push({
      sheet: r.sheet,
      row: r.row,
      title,
      warnings,
      payload: {
        parent_slug: cat.parent,
        child_slug: cat.child,
        title,
        description: cell(r.common.description).slice(0, TEXT_MAX) || null,
        province,
        district,
        ward,
        address: cell(r.common.address) || null,
        branch_id: branchId,
        starting_price: startingPrice,
        auction_format: auctionFormat,
        has_dispute: hasDispute,
        has_mortgage: hasMortgage,
        is_seized: isSeized,
        legal_notes: cell(r.common.legalNotes).slice(0, TEXT_MAX) || null,
        delta_fields: delta,
      },
    });
  }
  return res;
}

// ─── Kết quả từ server ───────────────────────────────────────────────────────

export interface PostingImportRowResult {
  idx: number;
  ok: boolean;
  id?: string | null;
  posting_code?: string | null;
  code?: string | null;
  message?: string | null;
}

export interface CreatedPosting {
  sheet: string;
  row: number;
  title: string;
  id: string;
  code: string;
}

export function postingImportFailureReason(code: string | null | undefined): string {
  if (code === "42501") return "Không có quyền tạo hồ sơ (hoặc chi nhánh ngoài phạm vi)";
  if (code === "23503") return "Chi nhánh không còn tồn tại";
  if (code === "23514" || code?.startsWith("22")) return "Dữ liệu không đúng định dạng";
  return "Không ghi được dòng này";
}

/** Ghép kết quả RPC (theo thứ tự payload) với dòng trong file. */
export function mergePostingImportResults(
  valid: ValidPostingRow[],
  results: PostingImportRowResult[],
): { created: CreatedPosting[]; failures: PostingImportIssue[] } {
  const created: CreatedPosting[] = [];
  const failures: PostingImportIssue[] = [];
  for (const r of results) {
    const v = valid[r.idx];
    if (!v) continue;
    if (r.ok && r.id) created.push({ sheet: v.sheet, row: v.row, title: v.title, id: r.id, code: r.posting_code ?? "" });
    else failures.push({ sheet: v.sheet, row: v.row, title: v.title, reason: postingImportFailureReason(r.code) });
  }
  return { created, failures };
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

/** Tên sheet Excel: ≤ 31 ký tự, không : \ / ? * [ ]. */
const sheetName = (s: string) => s.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);

function guideRows(isWorkspace: boolean): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Cột", "Cách điền"],
    ["", "Mỗi dòng là MỘT hồ sơ nháp. Sau khi nhập, mở từng hồ sơ để bổ sung ảnh, giấy tờ rồi hoàn tất số hoá."],
    ["", "Mỗi nhóm tài sản một sheet; có thể xoá các sheet không dùng. Cột có dấu * là bắt buộc."],
    ["", ""],
    ...COMMON_COLUMNS.filter((c) => isWorkspace || !c.workspaceOnly).map((c) => [c.header, c.guide]),
    ["Các cột thông số", "Theo loại tài sản; cột không áp dụng cho loại của dòng sẽ được bỏ qua. Số ghi kiểu 1,250.5. Để trống nếu chưa có."],
  ];
  for (const g of IMPORT_GROUPS) {
    rows.push(["", ""], [`Nhóm: ${g.name}`, `Loại tài sản: ${g.children.map((c) => c.name).join(", ")}`]);
    const seenSelect = new Set<string>();
    for (const ch of g.children) {
      for (const d of getDeltaFields(ch.slug)) {
        if (d.type !== "select" || !d.options || seenSelect.has(d.label)) continue;
        seenSelect.add(d.label);
        rows.push([d.label, d.options.map((o) => o.label).join(" / ")]);
      }
    }
  }
  return rows;
}

export function downloadPostingTemplate(isWorkspace: boolean) {
  const wb = XLSX.utils.book_new();
  const common = COMMON_COLUMNS.filter((c) => isWorkspace || !c.workspaceOnly);
  for (const g of IMPORT_GROUPS) {
    const headers = [...common.map((c) => c.header), ...g.deltaColumns.map((d) => d.header)];
    const widths = [...common.map((c) => c.width), ...g.deltaColumns.map((d) => Math.max(14, d.header.length + 2))];
    XLSX.utils.book_append_sheet(wb, styledSheet([headers], widths), sheetName(g.name));
  }
  XLSX.utils.book_append_sheet(wb, styledSheet(guideRows(isWorkspace), [28, 100]), GUIDE_SHEET);
  XLSX.writeFile(wb, "mau-nhap-tai-san.xlsx");
}

export function downloadPostingIssues(issues: PostingImportIssue[]) {
  const sorted = [...issues].sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row);
  const ws = styledSheet(
    [["Sheet", "Dòng", "Tài sản", "Lý do"], ...sorted.map((i) => [i.sheet, i.row, i.title, i.reason])],
    [18, 8, 40, 50],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dòng chưa nhập");
  XLSX.writeFile(wb, "nhap-tai-san-dong-chua-nhap.xlsx");
}

// Phân loại danh sách email import cho "Danh sách cụ thể" (Email Marketing).
// Đọc file theo dòng (giữ số dòng), phân loại hợp lệ / trùng / sai định dạng /
// chưa cho phép nhận, và xuất file các dòng lỗi. Logic thuần — việc tra
// notifications_enabled (opt-in) chạy ở tầng component.
import * as XLSX from "xlsx-js-style";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ImportRow {
  /** Số dòng trong bảng tính (1-based) để đối chiếu với file gốc. */
  row: number;
  /** Giá trị email của dòng (đã trim; chuẩn hoá lowercase sau khi phân loại). */
  raw: string;
}

export interface ClassifiedImport {
  /** Email sẽ được thêm (đã lowercase, không trùng, không opt-out). */
  valid: ImportRow[];
  /** Trùng với email đã có trong danh sách hoặc trùng trong chính file. */
  dups: ImportRow[];
  /** Sai định dạng email. */
  invalid: ImportRow[];
  /** Thuộc tài khoản chưa cho phép nhận email. */
  optout: ImportRow[];
}

export interface ImportIssue extends ImportRow {
  reason: string;
  tone: "danger" | "warning";
}

/** Đọc file .xlsx/.csv thành danh sách dòng có số dòng; bỏ dòng trống & dòng tiêu đề. */
export function parseFileRows(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const out: ImportRow[] = [];
        aoa.forEach((cells, i) => {
          const strs = (cells ?? [])
            .map((c) => String(c ?? "").trim())
            .filter((v) => v !== "");
          if (strs.length === 0) return; // bỏ dòng trống
          // ưu tiên ô trông giống email, nếu không có thì lấy ô đầu tiên (để dòng lỗi vẫn hiện)
          const raw = strs.find((v) => EMAIL_RE.test(v.toLowerCase())) ?? strs[0];
          // bỏ dòng tiêu đề: chứa chữ "email" nhưng không phải email hợp lệ
          if (i === 0 && /email/i.test(raw) && !EMAIL_RE.test(raw)) return;
          out.push({ row: i + 1, raw });
        });
        resolve(out);
      } catch {
        reject(new Error("Không thể đọc file. Vui lòng dùng .xlsx hoặc .csv."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Phân loại các dòng import theo thứ tự: sai định dạng → trùng → chưa cho phép
 * nhận → hợp lệ. `existing` là email đã có trong danh sách; `optOut` là email
 * thuộc tài khoản chưa bật nhận thông báo (tra từ profiles ở tầng component).
 */
export function classifyRows(
  rows: ImportRow[],
  existing: string[],
  optOut: Set<string> = new Set(),
): ClassifiedImport {
  const seen = new Set(existing.map((e) => e.toLowerCase()));
  const batchSeen = new Set<string>();
  const res: ClassifiedImport = { valid: [], dups: [], invalid: [], optout: [] };
  for (const r of rows) {
    const val = r.raw.trim().toLowerCase();
    if (!EMAIL_RE.test(val)) {
      res.invalid.push(r);
      continue;
    }
    if (seen.has(val) || batchSeen.has(val)) {
      res.dups.push({ ...r, raw: val });
      continue;
    }
    if (optOut.has(val)) {
      res.optout.push({ ...r, raw: val });
      continue;
    }
    batchSeen.add(val);
    res.valid.push({ ...r, raw: val });
  }
  return res;
}

/** Gộp mọi dòng bị bỏ thành một danh sách theo thứ tự dòng (kèm lý do). */
export function collectIssues(res: ClassifiedImport): ImportIssue[] {
  return [
    ...res.invalid.map((r) => ({ ...r, reason: "Sai định dạng", tone: "danger" as const })),
    ...res.dups.map((r) => ({ ...r, reason: "Trùng", tone: "warning" as const })),
    ...res.optout.map((r) => ({ ...r, reason: "Chưa cho phép nhận", tone: "warning" as const })),
  ].sort((a, b) => a.row - b.row);
}

/** Tải file .xlsx gồm các dòng bị bỏ (Dòng / Email / Lý do). */
export function downloadIssueRows(issues: ImportIssue[]) {
  const aoa: (string | number)[][] = [
    ["Dòng", "Email", "Lý do"],
    ...issues.map((r) => [r.row, r.raw, r.reason]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 8 }, { wch: 34 }, { wch: 20 }];
  for (const addr of ["A1", "B1", "C1"]) {
    const cell = ws[addr] as XLSX.CellObject;
    cell.s = {
      font: { bold: true, sz: 12, color: { rgb: "1F2937" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", horizontal: "left" },
      border: { bottom: { style: "medium", color: { rgb: "1F2937" } } },
    };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dòng lỗi");
  XLSX.writeFile(wb, "cac-dong-loi.xlsx");
}

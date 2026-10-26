// Đọc CSV mời cán bộ xã theo lô — Phase 9 của docs/owner-auction-planning-plan.md.
//
// Ba cột: email, mã đơn vị hành chính (cấp xã), vai trò. Hàm thuần, không đụng
// DOM — mọi kiểm tra "mã này có trong tỉnh không" là việc của server
// (`admin_province_bulk_invite` trả trạng thái từng dòng).

/** Vai trò mời được: bảng lời mời chỉ nhận hai giá trị này (CHECK ở DB). */
export type InviteRole = "staff" | "viewer";

export const INVITE_ROLE_LABELS: Record<InviteRole, string> = {
  staff: "Cán bộ",
  viewer: "Người xem",
};

export interface InviteCsvRow {
  email: string;
  admin_unit_code: string;
  role: InviteRole;
}

export interface InviteCsvResult {
  rows: InviteCsvRow[];
  /** Dòng không đọc được, kèm số dòng (1-based theo tệp) để người dùng sửa. */
  errors: { line: number; text: string; reason: string }[];
}

export const INVITE_CSV_TEMPLATE = [
  "email,ma_don_vi,vai_tro",
  "canbo.xatandinh@example.gov.vn,09169,staff",
  "lanhdao.xatandinh@example.gov.vn,09169,viewer",
].join("\n");

const HEADER_HINTS = ["email", "e-mail", "thu dien tu"];

/** Tách một dòng CSV: hỗ trợ dấu phẩy, chấm phẩy, tab và ô bọc ngoặc kép. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function normalizeRole(raw: string): InviteRole | null {
  const v = raw.toLowerCase().replace(/\s+/g, "");
  if (["staff", "canbo", "cánbộ", "cb"].includes(v)) return "staff";
  if (["viewer", "nguoixem", "ngườixem", "xem"].includes(v)) return "viewer";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Đọc nội dung CSV (tệp đã đọc thành chuỗi, hoặc ô dán tay).
 * Dòng tiêu đề được bỏ qua, dòng trống bỏ qua, vai trò để trống ⇒ "staff".
 * Trùng (email, mã đơn vị) chỉ giữ dòng ĐẦU — server cũng dùng lại lời mời cũ,
 * nhưng loại ở đây để bảng xem trước không hiện hai dòng y hệt.
 */
export function parseInviteCsv(text: string): InviteCsvResult {
  const rows: InviteCsvRow[] = [];
  const errors: InviteCsvResult["errors"] = [];
  const seen = new Set<string>();

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;

    const cells = splitCsvLine(line);
    const email = (cells[0] ?? "").toLowerCase();
    const code = (cells[1] ?? "").replace(/\s+/g, "");
    const roleRaw = cells[2] ?? "";

    // Dòng tiêu đề: ô đầu là chữ "email" và không phải địa chỉ thật.
    if (idx === 0 && HEADER_HINTS.includes(email) && !EMAIL_RE.test(email)) return;

    if (!EMAIL_RE.test(email)) {
      errors.push({ line: idx + 1, text: line, reason: "Email không hợp lệ" });
      return;
    }
    if (!/^\d{5}$/.test(code)) {
      errors.push({ line: idx + 1, text: line, reason: "Mã đơn vị phải là 5 chữ số (cấp xã)" });
      return;
    }
    const role = roleRaw.trim() === "" ? "staff" : normalizeRole(roleRaw);
    if (!role) {
      errors.push({ line: idx + 1, text: line, reason: "Vai trò chỉ nhận staff hoặc viewer" });
      return;
    }

    const key = `${email}|${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ email, admin_unit_code: code, role });
  });

  return { rows, errors };
}

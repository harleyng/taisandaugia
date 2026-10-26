/**
 * Đơn vị hành chính sau sáp nhập 01/07/2025 — kiểu + nhãn dùng chung.
 *
 * Sổ gốc là bảng `public.admin_units` (migration 20261026100000 + seed
 * 20261026100100, nguồn `docs/admin-units/`): 34 tỉnh/thành phố → 3.321 xã /
 * phường / đặc khu, HAI cấp, không còn cấp huyện.
 *
 * KHÔNG dùng `src/constants/vietnam-locations.ts` cho mã ĐVHC: tệp đó là địa chỉ
 * 3 cấp TRƯỚC sáp nhập, chỉ còn phục vụ các form địa chỉ cũ.
 *
 * `normalizeAdminSearch` ở đây chỉ dành cho Ô TÌM KIẾM phía trình duyệt. Nó
 * KHÔNG phải bản sao của `public.normalize_admin_name` (hàm SQL dựng
 * `normalized_name` và chạy `admin_unit_resolve`) — hai bên không cần khớp nhau
 * và không có test ghim cặp nào, vì không bên nào đọc kết quả của bên kia.
 */

export type AdminUnitLevel = "province" | "commune";

export type AdminUnitType = "tinh" | "thanh_pho" | "xa" | "phuong" | "dac_khu";

export interface AdminUnit {
  code: string;
  name: string;
  level: AdminUnitLevel;
  unit_type: AdminUnitType;
  parent_code: string | null;
  legacy_names: string[];
  is_active: boolean;
}

export const ADMIN_UNIT_TYPE_LABELS: Record<AdminUnitType, string> = {
  tinh: "Tỉnh",
  thanh_pho: "Thành phố",
  xa: "Xã",
  phuong: "Phường",
  dac_khu: "Đặc khu",
};

export const ADMIN_UNIT_LEVEL_LABELS: Record<AdminUnitLevel, string> = {
  province: "Tỉnh / thành phố",
  commune: "Xã / phường / đặc khu",
};

/** Tiền tố hành chính ở đầu tên chính thức ("Tỉnh Bắc Ninh", "Xã Tân Dĩnh"). */
const PREFIX_RE = /^(Thành phố|Tỉnh|Đặc khu|Phường|Xã)\s+/i;

/** Tên gọn để hiện trong bảng / chip: "Tỉnh Bắc Ninh" → "Bắc Ninh". */
export function adminUnitShortName(name: string): string {
  return name.replace(PREFIX_RE, "").trim() || name;
}

/** Nhãn đầy đủ của một đơn vị kèm tỉnh: "Xã Tân Dĩnh, Tỉnh Bắc Ninh". */
export function adminUnitFullLabel(
  unit: Pick<AdminUnit, "name" | "level">,
  province?: Pick<AdminUnit, "name"> | null,
): string {
  if (unit.level === "province" || !province) return unit.name;
  return `${unit.name}, ${province.name}`;
}

/**
 * Cấp suy ra từ MÃ. `admin_unit_resolve` trả mã cụ thể nhất giải được, nên bên
 * gọi phải phân biệt được "ra tới xã" (5 chữ số) với "chỉ ra tỉnh" (2 chữ số)
 * mà không cần truy vấn thêm.
 */
export function adminUnitLevelOfCode(code: string | null | undefined): AdminUnitLevel | null {
  if (!code) return null;
  if (/^\d{2}$/.test(code)) return "province";
  if (/^\d{5}$/.test(code)) return "commune";
  return null;
}

/** Bỏ dấu + hạ chữ + gom dấu câu, chỉ cho ô tìm kiếm trên trình duyệt. */
export function normalizeAdminSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Khớp từ khoá không phân biệt dấu: tên hiện hành, mã, và tên trước sáp nhập
 * (gõ "Bắc Giang" vẫn tìm ra "Tỉnh Bắc Ninh").
 */
export function matchesAdminUnit(unit: AdminUnit, term: string): boolean {
  const q = normalizeAdminSearch(term);
  if (!q) return true;
  if (unit.code.startsWith(term.trim())) return true;
  if (normalizeAdminSearch(unit.name).includes(q)) return true;
  return (unit.legacy_names ?? []).some((n) => normalizeAdminSearch(n).includes(q));
}

/** Sắp theo tên tiếng Việt (mã chính thức không theo thứ tự chữ cái). */
export function sortAdminUnits(units: AdminUnit[]): AdminUnit[] {
  return [...units].sort((a, b) =>
    adminUnitShortName(a.name).localeCompare(adminUnitShortName(b.name), "vi"),
  );
}

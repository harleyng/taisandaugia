// Danh mục quyền cho khu /admin (RBAC cấp nền tảng).
//
// "module" là MÃ ỔN ĐỊNH lưu trong DB (admin_role_permissions.module) — không
// đổi. Nhãn hiển thị bằng tiếng Việt. Category code trùng tên section sidebar để
// việc lọc menu theo quyền trở nên trực tiếp.

export type AdminAction = "view" | "create" | "update" | "delete" | "approve" | "export";

export type AdminCategory =
  | "cham-soc-khach-hang"
  | "noi-dung"
  | "marketing"
  | "bao-cao"
  | "quan-tri";

export interface AdminModuleDef {
  module: string; // mã ổn định, vd "nguoi-dung"
  label: string; // tiếng Việt
  category: AdminCategory;
  actions: AdminAction[]; // tập action khả dụng của module này
}

// module -> danh sách action đang bật (dùng cho ma trận + quyền hiệu lực)
export type PermissionMatrix = Record<string, AdminAction[]>;

export const ADMIN_ACTIONS: AdminAction[] = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "export",
];

export const ACTION_LABELS: Record<AdminAction, string> = {
  view: "Xem",
  create: "Tạo",
  update: "Sửa",
  delete: "Xóa",
  approve: "Duyệt",
  export: "Xuất",
};

export const CATEGORY_LABELS: Record<AdminCategory, string> = {
  "cham-soc-khach-hang": "Chăm sóc khách hàng",
  "noi-dung": "Nội dung",
  marketing: "Sale & Marketing",
  "bao-cao": "Báo cáo",
  "quan-tri": "Quản trị",
};

export const CATEGORY_ORDER: AdminCategory[] = [
  "cham-soc-khach-hang",
  "noi-dung",
  "marketing",
  "bao-cao",
  "quan-tri",
];

export const MODULE_DEFINITIONS: AdminModuleDef[] = [
  // Chăm sóc khách hàng
  { module: "nguoi-dung", label: "Quản lý người dùng", category: "cham-soc-khach-hang", actions: ["view", "create", "update", "delete", "export"] },
  { module: "kyc-cong-ty", label: "Duyệt KYC Công ty", category: "cham-soc-khach-hang", actions: ["view", "approve", "export"] },
  { module: "kyc-chu-tai-san", label: "Duyệt Chủ tài sản", category: "cham-soc-khach-hang", actions: ["view", "approve", "export"] },
  { module: "lien-he", label: "Liên hệ & Hợp tác", category: "cham-soc-khach-hang", actions: ["view", "update", "delete", "export"] },
  // Nội dung
  { module: "tin-tuc", label: "Tin tức", category: "noi-dung", actions: ["view", "create", "update", "delete"] },
  { module: "doi-tac", label: "Quản lý đối tác", category: "noi-dung", actions: ["view", "create", "update", "delete"] },
  { module: "phap-ly", label: "Văn bản pháp lý", category: "noi-dung", actions: ["view", "create", "update", "delete"] },
  // Sale & Marketing
  { module: "email", label: "Email Marketing", category: "marketing", actions: ["view", "create", "update", "delete"] },
  { module: "quang-cao", label: "Quảng cáo", category: "marketing", actions: ["view", "create", "update", "delete"] },
  { module: "dich-vu", label: "Dịch vụ", category: "marketing", actions: ["view", "create", "update", "delete"] },
  { module: "don-hang", label: "Đơn hàng", category: "marketing", actions: ["view", "create", "update", "delete", "export"] },
  { module: "khach-hang", label: "Khách hàng", category: "marketing", actions: ["view", "update", "export"] },
  // Báo cáo
  { module: "doanh-thu", label: "Doanh thu", category: "bao-cao", actions: ["view", "export"] },
  { module: "giao-dich", label: "Giao dịch credit", category: "bao-cao", actions: ["view", "export"] },
  { module: "truy-cap", label: "Phân tích truy cập", category: "bao-cao", actions: ["view", "export"] },
  // Quản trị
  { module: "tai-khoan", label: "Tài khoản quản trị", category: "quan-tri", actions: ["view", "create", "update", "delete"] },
  { module: "vai-tro", label: "Vai trò", category: "quan-tri", actions: ["view", "create", "update", "delete"] },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const BY_MODULE = new Map(MODULE_DEFINITIONS.map((m) => [m.module, m]));

export const moduleDef = (m: string): AdminModuleDef | undefined => BY_MODULE.get(m);

export const MODULES_BY_CATEGORY: Record<AdminCategory, AdminModuleDef[]> = CATEGORY_ORDER.reduce(
  (acc, c) => {
    acc[c] = MODULE_DEFINITIONS.filter((m) => m.category === c);
    return acc;
  },
  {} as Record<AdminCategory, AdminModuleDef[]>,
);

export const emptyMatrix = (): PermissionMatrix => ({});

export const fullMatrix = (): PermissionMatrix =>
  Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.module, [...m.actions]]));

// Tổng số quyền có thể cấp (mọi module × mọi action của nó).
export const TOTAL_PERMISSIONS = MODULE_DEFINITIONS.reduce((n, m) => n + m.actions.length, 0);

// PermissionMatrix -> [{module, action}] để đẩy vào RPC admin_set_role_permissions.
export const flattenMatrix = (m: PermissionMatrix): { module: string; action: AdminAction }[] =>
  Object.entries(m).flatMap(([mod, acts]) => acts.map((action) => ({ module: mod, action })));

// Đếm số quyền đang bật trong ma trận.
export const countMatrix = (m: PermissionMatrix): number =>
  Object.values(m).reduce((n, acts) => n + acts.length, 0);

// rows từ DB -> PermissionMatrix (bỏ qua quyền không còn trong danh mục).
export const matrixFromRows = (rows: { module: string; action: string }[]): PermissionMatrix => {
  const out: PermissionMatrix = {};
  for (const r of rows) {
    const def = BY_MODULE.get(r.module);
    if (!def || !def.actions.includes(r.action as AdminAction)) continue;
    (out[r.module] ??= []).push(r.action as AdminAction);
  }
  return out;
};

// Kiểm tra 1 quyền trong ma trận hiệu lực.
export const matrixHas = (m: PermissionMatrix, module: string, action: AdminAction): boolean =>
  m[module]?.includes(action) ?? false;

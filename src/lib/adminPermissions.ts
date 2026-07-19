// Danh mục quyền cho khu /admin (RBAC cấp nền tảng).
//
// "module" là MÃ ỔN ĐỊNH lưu trong DB (admin_role_permissions.module) — không
// đổi. Nhãn hiển thị bằng tiếng Việt. Category code trùng tên section sidebar để
// việc lọc menu theo quyền trở nên trực tiếp.

export type AdminAction = "view" | "create" | "update" | "delete" | "approve" | "export";

export type AdminCategory =
  | "quan-tri-phe-duyet"
  | "ban-hang"
  | "van-hanh"
  | "marketing"
  | "noi-dung"
  | "bao-cao"
  | "he-thong";

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
  "quan-tri-phe-duyet": "Quản trị & Phê duyệt",
  "ban-hang": "Bán hàng",
  "van-hanh": "Vận hành & Hỗ trợ",
  marketing: "Marketing",
  "noi-dung": "Nội dung",
  "bao-cao": "Báo cáo",
  "he-thong": "Quản trị",
};

export const CATEGORY_ORDER: AdminCategory[] = [
  "quan-tri-phe-duyet",
  "ban-hang",
  "van-hanh",
  "marketing",
  "noi-dung",
  "bao-cao",
  "he-thong",
];

export const MODULE_DEFINITIONS: AdminModuleDef[] = [
  // Thứ tự + nhóm khớp CHÍNH XÁC sidebar (AdminLayout.tsx). Các mã module GIỮ
  // NGUYÊN dù đổi category/nhãn: mã lưu trong admin_role_permissions, đổi mã =
  // mọi vai trò mất quyền đó.

  // Quản trị & Phê duyệt
  { module: "nguoi-dung", label: "Quản lý người dùng", category: "quan-tri-phe-duyet", actions: ["view", "create", "update", "delete", "export"] },
  { module: "kyc-cong-ty", label: "Duyệt KYC Công ty", category: "quan-tri-phe-duyet", actions: ["view", "approve", "export"] },
  { module: "kyc-chu-tai-san", label: "Duyệt Chủ tài sản", category: "quan-tri-phe-duyet", actions: ["view", "approve", "export"] },

  // Bán hàng
  { module: "khach-hang-tiem-nang", label: "Khách hàng tiềm năng", category: "ban-hang", actions: ["view", "create", "update", "delete", "export"] },
  { module: "co-hoi", label: "Cơ hội", category: "ban-hang", actions: ["view", "create", "update", "delete", "approve", "export"] },
  { module: "khach-hang", label: "Khách hàng", category: "ban-hang", actions: ["view", "update", "export"] },
  { module: "don-hang", label: "Đơn hàng", category: "ban-hang", actions: ["view", "create", "update", "delete", "export"] },
  // Sổ đăng ký công ty (bảng suppliers). Mã giữ "nha-cung-cap" —
  // "doi-tac" đã thuộc về module thẻ hiển thị trang chủ từ trước.
  { module: "nha-cung-cap", label: "Đối tác", category: "ban-hang", actions: ["view", "create", "update", "delete"] },

  // Vận hành & Hỗ trợ
  { module: "dich-vu", label: "Dịch vụ", category: "van-hanh", actions: ["view", "create", "update", "delete"] },
  { module: "cong-viec", label: "Công việc", category: "van-hanh", actions: ["view", "create", "update", "delete", "export"] },
  // Mã "lien-he" GIỮ NGUYÊN: Ticket thay thế hộp thư cũ nên kế thừa quyền đã cấp.
  { module: "lien-he", label: "Ticket", category: "van-hanh", actions: ["view", "create", "update", "delete", "export"] },

  // Marketing
  { module: "email", label: "Email Marketing", category: "marketing", actions: ["view", "create", "update", "delete"] },
  { module: "quang-cao", label: "Quảng cáo", category: "marketing", actions: ["view", "create", "update", "delete"] },

  // Nội dung
  { module: "tin-tuc", label: "Tin tức", category: "noi-dung", actions: ["view", "create", "update", "delete"] },
  // Mã "doi-tac" giữ nguyên, nhưng module giờ quản lý THẺ HIỂN THỊ trang chủ;
  // sổ đăng ký công ty nằm ở "nha-cung-cap".
  { module: "doi-tac", label: "Đối tác trên sàn", category: "noi-dung", actions: ["view", "create", "update", "delete"] },
  { module: "phap-ly", label: "Văn bản pháp lý", category: "noi-dung", actions: ["view", "create", "update", "delete"] },
  // Báo cáo
  { module: "doanh-thu", label: "Doanh thu", category: "bao-cao", actions: ["view", "export"] },
  { module: "giao-dich", label: "Giao dịch credit", category: "bao-cao", actions: ["view", "export"] },
  { module: "truy-cap", label: "Phân tích truy cập", category: "bao-cao", actions: ["view", "export"] },
  // Quản trị hệ thống (phân quyền)
  { module: "tai-khoan", label: "Tài khoản quản trị", category: "he-thong", actions: ["view", "create", "update", "delete"] },
  { module: "vai-tro", label: "Vai trò", category: "he-thong", actions: ["view", "create", "update", "delete"] },
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

// Danh mục quyền của Trạm Điều Hành (cổng chủ tài sản) — ma trận module × thao tác.
//
// BẢN SAO phía client của owner_ws_permission_catalog() + owner_ws_default_role_permissions()
// (migration 20260927170000). Đổi ở SQL thì đổi cả ở đây — permissions.test.ts giữ
// số lượng khớp. Mã module là KHOÁ LƯU TRONG DB (owner_ws_role_permissions, RLS, RPC):
// không đổi tên.
//
// Quyền GHI do DB chặn theo đúng ma trận này (owner_ws_has / owner_ws_has_in). "Xem"
// chỉ ẩn/hiện menu và trang — ở DB mọi thành viên vẫn đọc được số liệu của Trạm.

export type OwnerAction = "view" | "create" | "update" | "delete" | "finalize" | "share";

export type OwnerCategory = "dieu-hanh" | "tac-nghiep" | "phan-tich" | "thiet-lap";

export type OwnerModule =
  | "chi-tieu"
  | "tai-san"
  | "ket-qua"
  | "so-hoa"
  | "ky-gui"
  | "hop-dong-mua-ban"
  | "thu-tien"
  | "phan-tich"
  | "dong-tien"
  | "bao-cao-dinh-ky"
  | "chi-nhanh"
  | "thanh-vien"
  | "vai-tro"
  | "lien-ket";

export interface OwnerModuleDef {
  module: OwnerModule;
  label: string;
  category: OwnerCategory;
  actions: OwnerAction[];
  /** Nhãn riêng của module khi nhãn chung không đủ rõ (vd. "Khai & sửa"). */
  actionLabels?: Partial<Record<OwnerAction, string>>;
  /** Một dòng giải thích dưới tên module trong trình sửa ma trận. */
  hint?: string;
}

/** module → các thao tác được cấp. Module không có quyền nào thì KHÔNG có khoá. */
export type OwnerPermissionMatrix = Record<string, OwnerAction[]>;

export const OWNER_ACTION_LABELS: Record<OwnerAction, string> = {
  view: "Xem",
  create: "Tạo",
  update: "Sửa",
  delete: "Xoá",
  finalize: "Chốt",
  share: "Chia sẻ",
};

export const OWNER_CATEGORY_LABELS: Record<OwnerCategory, string> = {
  "dieu-hanh": "Điều hành",
  "tac-nghiep": "Tác nghiệp",
  "phan-tich": "Phân tích",
  "thiet-lap": "Thiết lập",
};

export const OWNER_CATEGORY_ORDER: OwnerCategory[] = ["dieu-hanh", "tac-nghiep", "phan-tich", "thiet-lap"];

export const OWNER_MODULE_DEFINITIONS: OwnerModuleDef[] = [
  { module: "chi-tieu", label: "Chỉ tiêu", category: "dieu-hanh", actions: ["view", "create", "update", "delete"] },
  {
    module: "tai-san",
    label: "Tài sản",
    category: "dieu-hanh",
    actions: ["view", "update"],
    actionLabels: { update: "Xác nhận" },
    hint: "Xác nhận / từ chối tài sản sàn tự khớp về đơn vị.",
  },
  {
    module: "ket-qua",
    label: "Kết quả phiên",
    category: "dieu-hanh",
    actions: ["view", "update", "delete"],
    actionLabels: { update: "Khai & sửa" },
    hint: "Khai kết quả, đính biên bản, nhập Excel, xử lý lệch số liệu.",
  },
  {
    module: "so-hoa",
    label: "Số hoá tài sản",
    category: "tac-nghiep",
    actions: ["view", "create", "update"],
    actionLabels: { update: "Sửa & dịch vụ" },
    hint: "Hồ sơ số hoá và dịch vụ gắn thêm (3D, VR, giám định, tư vấn).",
  },
  {
    module: "ky-gui",
    label: "Ký gửi đấu giá",
    category: "tac-nghiep",
    actions: ["view", "create", "update"],
    actionLabels: { create: "Gửi tổ chức", update: "Chốt & hợp đồng" },
    hint: "Gửi yêu cầu báo giá, chọn báo giá, xác nhận hợp đồng dịch vụ.",
  },
  {
    module: "hop-dong-mua-ban",
    label: "Hợp đồng mua bán",
    category: "tac-nghiep",
    actions: ["view", "update"],
  },
  {
    module: "thu-tien",
    label: "Thu tiền",
    category: "tac-nghiep",
    actions: ["view", "create", "update", "delete"],
    actionLabels: { create: "Ghi thu" },
    hint: "Sổ thu chi, hạn thanh toán, người trúng bỏ cọc.",
  },
  { module: "phan-tich", label: "Phân tích danh mục", category: "phan-tich", actions: ["view"] },
  { module: "dong-tien", label: "Dòng tiền", category: "phan-tich", actions: ["view"] },
  {
    module: "bao-cao-dinh-ky",
    label: "Báo cáo định kỳ",
    category: "phan-tich",
    actions: ["view", "create", "update", "delete", "finalize", "share"],
    hint: "Tạo / sửa / xoá áp cho bản nháp. Chốt đóng băng số liệu; chia sẻ tạo link chỉ đọc.",
  },
  {
    module: "chi-nhanh",
    label: "Đơn vị & chi nhánh",
    category: "thiet-lap",
    actions: ["view", "update"],
    hint: "Tên đơn vị, danh sách chi nhánh, chạy khớp tài sản, địa chỉ Bên A.",
  },
  {
    module: "thanh-vien",
    label: "Thành viên",
    category: "thiet-lap",
    actions: ["view", "create", "update", "delete"],
    actionLabels: { create: "Mời", update: "Đổi vai trò", delete: "Gỡ" },
  },
  { module: "vai-tro", label: "Vai trò", category: "thiet-lap", actions: ["view", "create", "update", "delete"] },
  {
    module: "lien-ket",
    label: "Liên kết",
    category: "thiet-lap",
    actions: ["view", "update"],
    hint: "Liên kết trụ sở ↔ chi nhánh.",
  },
];

const BY_MODULE = new Map(OWNER_MODULE_DEFINITIONS.map((d) => [d.module, d]));

export function ownerModuleDef(module: string): OwnerModuleDef | undefined {
  return BY_MODULE.get(module as OwnerModule);
}

export const OWNER_MODULES_BY_CATEGORY: Record<OwnerCategory, OwnerModuleDef[]> = OWNER_CATEGORY_ORDER.reduce(
  (acc, cat) => {
    acc[cat] = OWNER_MODULE_DEFINITIONS.filter((d) => d.category === cat);
    return acc;
  },
  {} as Record<OwnerCategory, OwnerModuleDef[]>,
);

export const OWNER_TOTAL_PERMISSIONS = OWNER_MODULE_DEFINITIONS.reduce((n, d) => n + d.actions.length, 0);

export function emptyOwnerMatrix(): OwnerPermissionMatrix {
  return {};
}

export function fullOwnerMatrix(): OwnerPermissionMatrix {
  return Object.fromEntries(OWNER_MODULE_DEFINITIONS.map((d) => [d.module, [...d.actions]]));
}

/** Dạng RPC owner_ws_set_role_permissions nhận: [{module, action}]. */
export function flattenOwnerMatrix(m: OwnerPermissionMatrix): { module: string; action: OwnerAction }[] {
  return Object.entries(m).flatMap(([module, actions]) => actions.map((action) => ({ module, action })));
}

export function countOwnerMatrix(m: OwnerPermissionMatrix): number {
  return Object.values(m).reduce((n, actions) => n + actions.length, 0);
}

/** Dựng ma trận từ các dòng quyền; bỏ dòng không còn trong danh mục. */
export function ownerMatrixFromRows(rows: readonly { module: string; action: string }[]): OwnerPermissionMatrix {
  const out: OwnerPermissionMatrix = {};
  for (const { module, action } of rows) {
    const def = ownerModuleDef(module);
    if (!def || !def.actions.includes(action as OwnerAction)) continue;
    const list = (out[module] ??= []);
    if (!list.includes(action as OwnerAction)) list.push(action as OwnerAction);
  }
  return out;
}

export function ownerMatrixHas(m: OwnerPermissionMatrix, module: OwnerModule, action: OwnerAction): boolean {
  return m[module]?.includes(action) ?? false;
}

/** Có ít nhất một quyền khác "Xem" (dùng xếp thứ tự tenant). */
export function ownerMatrixHasWrite(m: OwnerPermissionMatrix): boolean {
  return Object.values(m).some((actions) => actions.some((a) => a !== "view"));
}

/** a ⊆ b — luật chống leo quyền (bản sao owner_ws_role_within_user). */
export function ownerMatrixSubset(a: OwnerPermissionMatrix, b: OwnerPermissionMatrix): boolean {
  return flattenOwnerMatrix(a).every(({ module, action }) => b[module]?.includes(action));
}

/**
 * "Xem" là ngầm định: module có thao tác nào thì phải có Xem (server cũng tự thêm).
 * Bỏ Xem của một module đang có thao tác khác ⇒ bỏ cả module (không có "sửa mà không
 * thấy"). `prev` = giá trị trước lần bấm, để biết người dùng vừa bỏ Xem.
 */
export function normalizeOwnerMatrix(next: OwnerPermissionMatrix, prev?: OwnerPermissionMatrix): OwnerPermissionMatrix {
  const out: OwnerPermissionMatrix = {};
  for (const [module, actions] of Object.entries(next)) {
    if (actions.length === 0) continue;
    const droppedView = prev?.[module]?.includes("view") && !actions.includes("view");
    if (droppedView) continue;
    const def = ownerModuleDef(module);
    const withView = actions.includes("view") ? actions : (["view", ...actions] as OwnerAction[]);
    // Giữ thứ tự của danh mục để so sánh "đã sửa" ổn định.
    out[module] = def ? def.actions.filter((a) => withView.includes(a)) : withView;
  }
  return out;
}

/**
 * Trưởng đơn vị của trụ sở xem Trạm chi nhánh đã liên kết: chỉ đọc, và không thấy
 * thành viên / vai trò / liên kết của chi nhánh (Phase 14).
 */
export const HQ_VIEW_MATRIX: OwnerPermissionMatrix = Object.fromEntries(
  OWNER_MODULE_DEFINITIONS.filter((d) => !["thanh-vien", "vai-tro", "lien-ket"].includes(d.module)).map((d) => [
    d.module,
    ["view"] as OwnerAction[],
  ]),
);

/** Bản sao owner_ws_default_role_permissions('STAFF') — chỉ để test/đối chiếu. */
export const STAFF_DEFAULT_MATRIX: OwnerPermissionMatrix = {
  "chi-tieu": ["view"],
  "tai-san": ["view", "update"],
  "ket-qua": ["view", "update", "delete"],
  "so-hoa": ["view", "create", "update"],
  "ky-gui": ["view", "create", "update"],
  "hop-dong-mua-ban": ["view", "update"],
  "thu-tien": ["view", "create", "update", "delete"],
  "phan-tich": ["view"],
  "dong-tien": ["view"],
  "bao-cao-dinh-ky": ["view", "create", "update", "delete"],
  "chi-nhanh": ["view"],
  "thanh-vien": ["view"],
  "vai-tro": ["view"],
  "lien-ket": ["view"],
};

/** Bản sao owner_ws_default_role_permissions('VIEWER'). */
export const VIEWER_DEFAULT_MATRIX: OwnerPermissionMatrix = Object.fromEntries(
  OWNER_MODULE_DEFINITIONS.map((d) => [d.module, ["view"] as OwnerAction[]]),
);

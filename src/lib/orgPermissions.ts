// Danh mục quyền cho portal tổ chức đấu giá (/portal) — RBAC cấp TỔ CHỨC.
//
// Song song với src/lib/adminPermissions.ts (RBAC cấp nền tảng) nhưng độc lập:
// tập action khác (không có "approve"), module theo sidebar portal, và ma trận
// được lưu ở org_role_permissions thay vì admin_role_permissions.
//
// "module" là MÃ ỔN ĐỊNH lưu trong DB — KHÔNG đổi. Đổi mã = mọi vai trò của mọi
// tổ chức mất quyền đó. Nhãn hiển thị bằng tiếng Việt, đổi thoải mái.

// "operate" / "finalize" chỉ dùng cho module điều hành đấu giá trực tuyến — ma
// trận vẽ action theo từng module nên các module khác không bị thêm cột.
export type OrgAction = "view" | "create" | "update" | "delete" | "export" | "operate" | "finalize";

export type OrgCategory =
  | "tong-quan"
  | "nang-luc"
  | "nhan-su"
  | "kinh-doanh"
  | "tai-chinh"
  | "to-chuc";

export interface OrgModuleDef {
  module: string; // mã ổn định, vd "nl-dau-gia-vien"
  label: string; // tiếng Việt
  category: OrgCategory;
  actions: OrgAction[]; // tập action khả dụng của module này
  hiddenFromNav?: boolean; // module không có mục sidebar tương ứng
}

// module -> danh sách action đang bật (dùng cho ma trận + quyền hiệu lực)
export type OrgPermissionMatrix = Record<string, OrgAction[]>;

export const ORG_ACTIONS: OrgAction[] = ["view", "create", "update", "delete", "export", "operate", "finalize"];

export const ORG_ACTION_LABELS: Record<OrgAction, string> = {
  view: "Xem",
  create: "Tạo",
  update: "Sửa",
  delete: "Xóa",
  export: "Xuất",
  operate: "Điều hành",
  finalize: "Chốt kết quả",
};

export const ORG_CATEGORY_LABELS: Record<OrgCategory, string> = {
  "tong-quan": "Tổng quan",
  "nang-luc": "Hồ sơ năng lực",
  "nhan-su": "Hồ sơ nhân sự",
  "kinh-doanh": "Kinh doanh",
  "tai-chinh": "Tài chính",
  "to-chuc": "Tổ chức",
};

export const ORG_CATEGORY_ORDER: OrgCategory[] = [
  "tong-quan",
  "nang-luc",
  "nhan-su",
  "kinh-doanh",
  "tai-chinh",
  "to-chuc",
];

export const ORG_MODULE_DEFINITIONS: OrgModuleDef[] = [
  // Thứ tự + nhóm khớp sidebar portal (nav-config.ts). Mã module GIỮ NGUYÊN dù
  // đổi nhãn/nhóm: mã lưu trong org_role_permissions.
  { module: "tong-quan", label: "Tổng quan", category: "tong-quan", actions: ["view"] },

  { module: "nl-thong-tin-chung", label: "Thông tin chung", category: "nang-luc", actions: ["view", "update"] },
  { module: "nl-dau-gia-vien", label: "Đấu giá viên", category: "nang-luc", actions: ["view", "create", "update", "delete"] },
  { module: "nl-co-so-vat-chat", label: "Cơ sở vật chất", category: "nang-luc", actions: ["view", "create", "update", "delete"] },
  { module: "nl-lich-su-dau-gia", label: "Lịch sử đấu giá", category: "nang-luc", actions: ["view", "create", "update", "delete", "export"] },
  { module: "nl-tai-chinh", label: "Tài chính & Thuế", category: "nang-luc", actions: ["view", "update"] },

  // Mục cấp cao riêng (tách khỏi Hồ sơ năng lực 2026-08-05). KHÔNG có create/delete:
  // thêm/xóa người vẫn nằm ở màn Đấu giá viên (nl-dau-gia-vien), đây chỉ số hoá hồ
  // sơ đã có. "export" = xuất file hồ sơ, có TRỪ CREDIT.
  { module: "nhan-su", label: "Hồ sơ nhân sự", category: "nhan-su", actions: ["view", "update", "export"] },

  // Sổ tuân thủ bồi dưỡng chuyên môn hằng năm (TT 19/2024/TT-BTP). CÓ create/delete
  // vì ghi nhận hoạt động là việc riêng của mục này, không phải sửa hồ sơ đã có.
  // "export" = xuất CSV danh sách tuân thủ, KHÔNG trừ credit.
  { module: "boi-duong", label: "Bồi dưỡng chuyên môn", category: "nhan-su", actions: ["view", "create", "update", "delete", "export"] },

  { module: "ho-so-du-tuyen", label: "Hồ sơ dự tuyển", category: "kinh-doanh", actions: ["view", "create", "update", "delete", "export"] },
  // Hộp thư tài sản chủ sở hữu muốn ký gửi (asset_service_requests). "update" =
  // được báo giá / từ chối; chỉ "view" thì xem chứ không trả lời được.
  { module: "yeu-cau-ky-gui", label: "Yêu cầu ký gửi", category: "kinh-doanh", actions: ["view", "update"] },
  // Phiên đấu giá (auction_sessions). Thêm/sửa/xoá LÔ tài sản cần "update" — đó là
  // sửa phiên. "delete" chỉ xoá được phiên nháp; phiên đã công bố thì huỷ.
  { module: "phien-dau-gia", label: "Phiên đấu giá", category: "kinh-doanh", actions: ["view", "create", "update", "delete"] },
  // Hộp thư hỏi đáp đa kênh (sàn + Zalo): trả lời người mua từ tài liệu phiên.
  // "update" = duyệt/gửi nháp AI, trả lời, xử lý câu hỏi chuyển tiếp. Tài liệu phiên
  // KHÔNG nằm ở đây — đó là sửa phiên (phien-dau-gia.update).
  { module: "hoi-dap", label: "Hỏi đáp & Omnichat", category: "kinh-doanh", actions: ["view", "update"] },
  // Bật TỰ GỬI câu trả lời AI là quyền tin cậy cao hơn trả lời ⇒ tách module riêng.
  { module: "hoi-dap-cai-dat", label: "Cấu hình trả lời tự động", category: "kinh-doanh", actions: ["update"], hiddenFromNav: true },
  // Danh bạ khách hàng RIÊNG của tổ chức (org_contacts) — sàn không cấp dữ liệu
  // người mua. Trùng mã với module admin "khach-hang" nhưng lưu ở bảng khác.
  // "update" = sửa khách/nhu cầu/nhóm VÀ ghi nhận "đã liên hệ" khi tiếp thị phiên.
  // "export" = xuất Excel danh bạ / danh sách người nhận.
  { module: "khach-hang", label: "Khách hàng", category: "kinh-doanh", actions: ["view", "create", "update", "delete", "export"] },
  // Hồ sơ tham gia người mua đã thanh toán (auction_bidding_contracts) — CHỨA CCCD,
  // nên tách khỏi phien-dau-gia. "update" = xác nhận tiền đặt trước + cấp số báo
  // danh. Không có create/delete: hồ sơ do người mua tạo và không bao giờ bị xoá.
  { module: "ho-so-tham-gia", label: "Hồ sơ tham gia đấu giá", category: "kinh-doanh", actions: ["view", "update"] },
  // Điều hành phiên đấu giá trực tuyến (auction_lot_states / auction_bids).
  // "operate" = mở / tạm dừng / tiếp tục / rút tài sản khỏi phiên đang diễn ra.
  // "finalize" = chốt kết quả phiên, phát hành biên bản, xác nhận người trúng thanh
  // toán — hệ quả tiền đặt trước không đảo ngược được nên tách khỏi operate.
  // Hoàn trả tiền đặt trước vẫn thuộc ho-so-tham-gia.update. Không có mục sidebar:
  // vào từ trang chi tiết phiên.
  {
    module: "dieu-hanh-dau-gia",
    label: "Điều hành đấu giá",
    category: "kinh-doanh",
    actions: ["view", "operate", "finalize"],
    hiddenFromNav: true,
  },
  // Hợp đồng mua bán tài sản đấu giá — giai đoạn SAU khi phiên chốt kết quả
  // (auction_sale_contracts + sổ tiền + bàn giao). Tách khỏi dieu-hanh-dau-gia vì
  // đây là việc của kế toán / pháp chế chứ không phải của đấu giá viên đang điều
  // hành phiên, và dòng hợp đồng mang CCCD của CẢ HAI bên.
  // "update" = lập hợp đồng, sửa điều khoản, ghi nhận thanh toán, hẹn bàn giao.
  { module: "hop-dong-mua-ban", label: "Hợp đồng mua bán", category: "kinh-doanh", actions: ["view", "update"] },
  // Không có mục sidebar: module này tồn tại để đỡ RLS listings (org_listings_update
  // / org_listings_delete trong 20260805000020_org_rbac.sql).
  { module: "tin-dang", label: "Tin đăng tài sản", category: "kinh-doanh", actions: ["view", "create", "update", "delete"], hiddenFromNav: true },

  // "create" ở đây nghĩa là NẠP CREDIT — giữ action chung để ma trận đồng nhất,
  // không phát minh action riêng.
  { module: "credit", label: "Credit & Thanh toán", category: "tai-chinh", actions: ["view", "create"] },

  { module: "thanh-vien", label: "Thành viên", category: "to-chuc", actions: ["view", "create", "update", "delete"] },
  { module: "vai-tro", label: "Vai trò", category: "to-chuc", actions: ["view", "create", "update", "delete"] },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const BY_MODULE = new Map(ORG_MODULE_DEFINITIONS.map((m) => [m.module, m]));

export const orgModuleDef = (m: string): OrgModuleDef | undefined => BY_MODULE.get(m);

export const ORG_MODULES_BY_CATEGORY: Record<OrgCategory, OrgModuleDef[]> =
  ORG_CATEGORY_ORDER.reduce(
    (acc, c) => {
      acc[c] = ORG_MODULE_DEFINITIONS.filter((m) => m.category === c);
      return acc;
    },
    {} as Record<OrgCategory, OrgModuleDef[]>,
  );

export const emptyOrgMatrix = (): OrgPermissionMatrix => ({});

export const fullOrgMatrix = (): OrgPermissionMatrix =>
  Object.fromEntries(ORG_MODULE_DEFINITIONS.map((m) => [m.module, [...m.actions]]));

// Tổng số quyền có thể cấp (mọi module × mọi action của nó).
export const ORG_TOTAL_PERMISSIONS = ORG_MODULE_DEFINITIONS.reduce(
  (n, m) => n + m.actions.length,
  0,
);

// OrgPermissionMatrix -> [{module, action}] để đẩy vào RPC org_set_role_permissions.
export const flattenOrgMatrix = (
  m: OrgPermissionMatrix,
): { module: string; action: OrgAction }[] =>
  Object.entries(m).flatMap(([mod, acts]) => acts.map((action) => ({ module: mod, action })));

// Đếm số quyền đang bật trong ma trận.
export const countOrgMatrix = (m: OrgPermissionMatrix): number =>
  Object.values(m).reduce((n, acts) => n + acts.length, 0);

// rows từ DB -> OrgPermissionMatrix (bỏ qua quyền không còn trong danh mục).
export const orgMatrixFromRows = (
  rows: { module: string; action: string }[],
): OrgPermissionMatrix => {
  const out: OrgPermissionMatrix = {};
  for (const r of rows) {
    const def = BY_MODULE.get(r.module);
    if (!def || !def.actions.includes(r.action as OrgAction)) continue;
    (out[r.module] ??= []).push(r.action as OrgAction);
  }
  return out;
};

// Kiểm tra 1 quyền trong ma trận hiệu lực.
export const orgMatrixHas = (
  m: OrgPermissionMatrix,
  module: string,
  action: OrgAction,
): boolean => m[module]?.includes(action) ?? false;

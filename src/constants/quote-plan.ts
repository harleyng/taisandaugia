// Danh mục cho phương án tổ chức đấu giá & chi phí trong báo giá ký gửi.
//
// Cố định trong code, KHÔNG master data: giá trị của phương án có cấu trúc nằm
// ở chỗ so sánh được. Nếu mỗi tổ chức tự đặt nhãn thì lại thành văn xuôi, đúng
// thứ mà việc này sinh ra để thay thế. Có ô "khác" tự do cho ngoại lệ.
//
// Các `key` được ghi thẳng vào JSONB (asset_service_requests.quote_plan /
// quote_fee_items) nên là chuỗi BẤT BIẾN — đổi key là mất dữ liệu của báo giá
// đã gửi. Đổi `label` thì thoải mái.

export interface CatalogItem {
  key: string;
  label: string;
}

/** Kênh niêm yết / thông báo công khai phiên đấu giá. */
export const PROMOTION_CHANNELS: CatalogItem[] = [
  { key: "cong_tsdg", label: "Cổng Đấu giá tài sản quốc gia" },
  { key: "bao_in", label: "Báo in" },
  { key: "website_tc", label: "Website tổ chức" },
  { key: "mxh", label: "Mạng xã hội" },
  { key: "san_tsdg", label: "Sàn Tài sản đấu giá" },
];

/**
 * Mốc thời gian, tính bằng SỐ NGÀY kể từ khi ký hợp đồng dịch vụ (luỹ tiến,
 * không phải khoảng cách giữa hai mốc liền nhau).
 *
 * `mo_phien` là mốc chốt: nó chính là quote_lead_time_days ở DB.
 */
export const QUOTE_MILESTONES: CatalogItem[] = [
  { key: "tham_dinh", label: "Thẩm định & định giá" },
  { key: "niem_yet", label: "Niêm yết" },
  { key: "ban_ho_so", label: "Bán hồ sơ" },
  { key: "mo_phien", label: "Mở phiên" },
];

export type QuoteMilestoneKey = (typeof QUOTE_MILESTONES)[number]["key"];

/** Mốc quyết định — đồng bộ với quote_lead_time_days. */
export const FINAL_MILESTONE_KEY = "mo_phien";

/** Phạm vi dịch vụ: mỗi mục tổ chức đánh dấu bao gồm / không bao gồm / bỏ trống. */
export const SERVICE_SCOPE_ITEMS: CatalogItem[] = [
  { key: "ho_so", label: "Lập hồ sơ đấu giá" },
  { key: "niem_yet", label: "Niêm yết & thông báo công khai" },
  { key: "dau_gia_vien", label: "Đấu giá viên điều hành phiên" },
  { key: "thu_tuc", label: "Thủ tục sau phiên" },
  { key: "van_chuyen", label: "Vận chuyển / bàn giao tài sản" },
  { key: "tham_dinh_gia", label: "Thẩm định giá" },
];

/** Gợi ý khoản mục chi phí — tổ chức chọn preset hoặc tự gõ nhãn. */
export const FEE_ITEM_PRESETS: CatalogItem[] = [
  { key: "phi_ho_so", label: "Phí lập hồ sơ" },
  { key: "phi_niem_yet", label: "Phí niêm yết & thông báo" },
  { key: "phi_tham_dinh", label: "Phí thẩm định giá" },
  { key: "phi_to_chuc", label: "Phí tổ chức phiên" },
  { key: "khac", label: "Khoản khác" },
];

/**
 * Tiền đặt trước theo Luật Đấu giá tài sản: 5–20% giá khởi điểm.
 * Dùng để CẢNH BÁO, không chặn cứng — vẫn có trường hợp đặc thù.
 */
export const DEPOSIT_LEGAL_RANGE = { min: 5, max: 20 } as const;

export const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
  PROMOTION_CHANNELS.map((c) => [c.key, c.label]),
);

export const MILESTONE_LABEL: Record<string, string> = Object.fromEntries(
  QUOTE_MILESTONES.map((m) => [m.key, m.label]),
);

export const SCOPE_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_SCOPE_ITEMS.map((s) => [s.key, s.label]),
);

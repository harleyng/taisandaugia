// Registry trường riêng theo nhóm con (delta fields), keyed theo child slug từ
// ASSET_CATEGORIES (src/constants/category.constants.ts). Bước 2 của wizard render
// các trường này generic qua <DeltaFieldInput>, lưu vào asset_postings.delta_fields (JSONB).
// Thêm một loại con mới chỉ cần thêm entry ở đây — không phải sửa code wizard.

export type DeltaFieldType = "text" | "number" | "select" | "boolean" | "textarea";

export interface DeltaFieldDescriptor {
  key: string;
  label: string;
  type: DeltaFieldType;
  options?: { value: string; label: string }[];
  unit?: string;
  required?: boolean;
  placeholder?: string;
}

// ─── Bộ option dùng chung ────────────────────────────────────────────────────

const DIRECTION_OPTIONS = [
  { value: "dong", label: "Đông" },
  { value: "tay", label: "Tây" },
  { value: "nam", label: "Nam" },
  { value: "bac", label: "Bắc" },
  { value: "dong-bac", label: "Đông Bắc" },
  { value: "dong-nam", label: "Đông Nam" },
  { value: "tay-bac", label: "Tây Bắc" },
  { value: "tay-nam", label: "Tây Nam" },
];

const LEGAL_BOOK_OPTIONS = [
  { value: "so-do", label: "Sổ đỏ (GCN QSDĐ)" },
  { value: "so-hong", label: "Sổ hồng" },
  { value: "giay-to-khac", label: "Giấy tờ hợp lệ khác" },
  { value: "chua-co-so", label: "Chưa có sổ" },
];

const CONDITION_OPTIONS = [
  { value: "moi", label: "Mới" },
  { value: "da-qua-su-dung", label: "Đã qua sử dụng" },
  { value: "can-sua-chua", label: "Cần sửa chữa" },
];

const FURNITURE_OPTIONS = [
  { value: "khong", label: "Không nội thất" },
  { value: "co-ban", label: "Cơ bản" },
  { value: "day-du", label: "Đầy đủ" },
  { value: "cao-cap", label: "Cao cấp" },
];

const QUANTITY_UNIT_OPTIONS = [
  { value: "vien", label: "Viên" },
  { value: "m2", label: "m²" },
  { value: "m3", label: "m³" },
  { value: "tan", label: "Tấn" },
  { value: "kg", label: "Kg" },
  { value: "cai", label: "Cái" },
  { value: "bo", label: "Bộ" },
];

// ─── Registry ────────────────────────────────────────────────────────────────

export const ASSET_DELTA_FIELDS: Record<string, DeltaFieldDescriptor[]> = {
  // ── Bất động sản ──
  "dat-o": [
    { key: "area", label: "Diện tích", type: "number", unit: "m²", required: true },
    { key: "frontage", label: "Mặt tiền", type: "number", unit: "m" },
    { key: "road_width", label: "Đường vào", type: "number", unit: "m" },
    { key: "direction", label: "Hướng đất", type: "select", options: DIRECTION_OPTIONS },
    { key: "legal_book", label: "Loại giấy tờ", type: "select", options: LEGAL_BOOK_OPTIONS },
  ],
  "dat-nong-nghiep": [
    { key: "area", label: "Diện tích", type: "number", unit: "m²", required: true },
    {
      key: "land_use",
      label: "Loại đất",
      type: "select",
      options: [
        { value: "trong-cay-hang-nam", label: "Trồng cây hàng năm" },
        { value: "trong-cay-lau-nam", label: "Trồng cây lâu năm" },
        { value: "nuoi-trong-thuy-san", label: "Nuôi trồng thủy sản" },
        { value: "dat-lua", label: "Đất lúa" },
      ],
    },
    { key: "remaining_term", label: "Thời hạn sử dụng còn lại", type: "number", unit: "năm" },
    { key: "legal_book", label: "Loại giấy tờ", type: "select", options: LEGAL_BOOK_OPTIONS },
  ],
  "nha-pho": [
    { key: "land_area", label: "Diện tích đất", type: "number", unit: "m²", required: true },
    { key: "floor_area", label: "Diện tích sàn", type: "number", unit: "m²" },
    { key: "floors", label: "Số tầng", type: "number" },
    { key: "bedrooms", label: "Số phòng ngủ", type: "number" },
    { key: "direction", label: "Hướng nhà", type: "select", options: DIRECTION_OPTIONS },
    { key: "legal_book", label: "Loại giấy tờ", type: "select", options: LEGAL_BOOK_OPTIONS },
  ],
  "can-ho": [
    { key: "area", label: "Diện tích thông thủy", type: "number", unit: "m²", required: true },
    { key: "bedrooms", label: "Số phòng ngủ", type: "number" },
    { key: "floor", label: "Tầng", type: "number" },
    { key: "block", label: "Tòa / Block", type: "text" },
    { key: "furniture", label: "Nội thất", type: "select", options: FURNITURE_OPTIONS },
    {
      key: "ownership_type",
      label: "Hình thức sở hữu",
      type: "select",
      options: [
        { value: "so-hong", label: "Sổ hồng" },
        { value: "hdmb", label: "Hợp đồng mua bán" },
      ],
    },
  ],
  "nha-xuong": [
    { key: "land_area", label: "Diện tích đất", type: "number", unit: "m²", required: true },
    { key: "built_area", label: "Diện tích xây dựng", type: "number", unit: "m²" },
    { key: "power_capacity", label: "Công suất điện", type: "text", placeholder: "VD: 250 KVA" },
    { key: "dismantle_condition", label: "Điều kiện tháo dỡ", type: "textarea" },
    { key: "transport_condition", label: "Điều kiện vận chuyển / lắp đặt", type: "textarea" },
  ],
  shophouse: [
    { key: "land_area", label: "Diện tích đất", type: "number", unit: "m²", required: true },
    { key: "floor_area", label: "Diện tích sàn", type: "number", unit: "m²" },
    { key: "floors", label: "Số tầng", type: "number" },
    { key: "business_type", label: "Loại hình kinh doanh phù hợp", type: "text" },
    { key: "legal_book", label: "Loại giấy tờ", type: "select", options: LEGAL_BOOK_OPTIONS },
  ],

  // ── Xe cộ ──
  "o-to": [
    { key: "brand", label: "Hãng / Model", type: "text", required: true, placeholder: "VD: Toyota Camry" },
    { key: "year", label: "Năm sản xuất", type: "number" },
    { key: "odo", label: "Số km đã đi", type: "number", unit: "km" },
    {
      key: "transmission",
      label: "Hộp số",
      type: "select",
      options: [
        { value: "so-san", label: "Số sàn" },
        { value: "so-tu-dong", label: "Số tự động" },
      ],
    },
    { key: "color", label: "Màu xe", type: "text" },
  ],
  "xe-tai": [
    { key: "brand", label: "Hãng / Model", type: "text", required: true },
    { key: "tonnage", label: "Tải trọng", type: "number", unit: "tấn", required: true },
    {
      key: "box_type",
      label: "Loại thùng",
      type: "select",
      options: [
        { value: "thung-kin", label: "Thùng kín" },
        { value: "thung-bat", label: "Thùng bạt" },
        { value: "thung-lung", label: "Thùng lửng" },
        { value: "thung-dong-lanh", label: "Thùng đông lạnh" },
        { value: "ben", label: "Ben" },
      ],
    },
    { key: "year", label: "Năm sản xuất", type: "number" },
    { key: "axles", label: "Số trục", type: "number" },
  ],
  "xe-may": [
    { key: "brand", label: "Hãng / Model", type: "text", required: true },
    { key: "year", label: "Năm sản xuất", type: "number" },
    { key: "odo", label: "Số km đã đi", type: "number", unit: "km" },
    { key: "engine_cc", label: "Dung tích xi-lanh", type: "number", unit: "cc" },
  ],

  // ── Máy móc ──
  "may-cong-trinh": [
    { key: "machine_type", label: "Loại máy", type: "text", required: true, placeholder: "VD: Máy xúc, máy ủi" },
    { key: "brand", label: "Hãng", type: "text" },
    { key: "year", label: "Năm sản xuất", type: "number" },
    { key: "op_hours", label: "Giờ vận hành", type: "number", unit: "giờ" },
    { key: "condition", label: "Tình trạng", type: "select", options: CONDITION_OPTIONS },
  ],
  "may-nong-nghiep": [
    { key: "machine_type", label: "Loại máy", type: "text", required: true, placeholder: "VD: Máy gặt, máy cày" },
    { key: "brand", label: "Hãng", type: "text" },
    { key: "year", label: "Năm sản xuất", type: "number" },
    { key: "condition", label: "Tình trạng", type: "select", options: CONDITION_OPTIONS },
  ],
  "day-chuyen": [
    { key: "line_type", label: "Loại dây chuyền", type: "text", required: true },
    { key: "capacity", label: "Công suất", type: "text", placeholder: "VD: 500 sản phẩm/giờ" },
    { key: "year", label: "Năm sản xuất", type: "number" },
    { key: "dismantle_condition", label: "Điều kiện tháo dỡ", type: "textarea" },
    { key: "install_condition", label: "Điều kiện vận chuyển / lắp đặt", type: "textarea" },
  ],

  // ── Hàng hóa ──
  "gach-vat-lieu": [
    { key: "material_type", label: "Loại vật liệu", type: "text", required: true, placeholder: "VD: Gạch ống, cát, đá" },
    { key: "unit", label: "Đơn vị", type: "select", options: QUANTITY_UNIT_OPTIONS, required: true },
    { key: "quantity", label: "Số lượng / khối lượng", type: "number", required: true },
  ],
  "sat-thep": [
    { key: "steel_grade", label: "Mác thép", type: "text", required: true, placeholder: "VD: CB300, SS400" },
    { key: "weight_tons", label: "Khối lượng", type: "number", unit: "tấn", required: true },
    {
      key: "form",
      label: "Dạng",
      type: "select",
      options: [
        { value: "cuon", label: "Cuộn" },
        { value: "thanh", label: "Thanh / cây" },
        { value: "tam", label: "Tấm" },
        { value: "ong", label: "Ống" },
      ],
    },
  ],
  "hang-ton-kho": [
    { key: "goods_type", label: "Loại hàng", type: "text", required: true },
    { key: "unit", label: "Đơn vị", type: "select", options: QUANTITY_UNIT_OPTIONS, required: true },
    { key: "quantity", label: "Số lượng / khối lượng", type: "number", required: true },
    { key: "condition", label: "Tình trạng", type: "select", options: CONDITION_OPTIONS },
  ],

  // ── Đồ dùng ──
  "noi-that": [
    { key: "item_type", label: "Loại nội thất", type: "text", required: true, placeholder: "VD: Bàn ghế, tủ, giường" },
    { key: "material", label: "Chất liệu", type: "text" },
    { key: "quantity", label: "Số lượng", type: "number", unit: "món" },
    { key: "condition", label: "Tình trạng", type: "select", options: CONDITION_OPTIONS },
  ],
  "thiet-bi": [
    { key: "device_type", label: "Loại thiết bị", type: "text", required: true },
    { key: "brand", label: "Hãng", type: "text" },
    { key: "quantity", label: "Số lượng", type: "number", unit: "cái" },
    { key: "condition", label: "Tình trạng", type: "select", options: CONDITION_OPTIONS },
  ],
  "cong-cu": [
    { key: "tool_type", label: "Loại công cụ", type: "text", required: true },
    { key: "brand", label: "Hãng", type: "text" },
    { key: "quantity", label: "Số lượng", type: "number", unit: "cái" },
    { key: "condition", label: "Tình trạng", type: "select", options: CONDITION_OPTIONS },
  ],
};

export const getDeltaFields = (childSlug: string): DeltaFieldDescriptor[] =>
  ASSET_DELTA_FIELDS[childSlug] ?? [];

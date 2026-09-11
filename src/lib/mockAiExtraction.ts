// Kho dữ liệu giả cho engine trích xuất AI (src/lib/aiMediaExtraction.ts).
//
// Tách riêng khỏi engine để khi có API thị giác máy tính thật thì XOÁ NGUYÊN FILE
// NÀY, engine giữ nguyên chữ ký hàm. Ở đây chỉ có vốn từ và mẫu câu — không có
// logic nào cả.

import type { DeltaFieldType } from "@/constants/asset-delta-fields";

/** Khoảng giá trị hợp lý cho delta field kiểu number, tra theo key rồi tới unit. */
export const NUMBER_RANGES: Record<string, [number, number]> = {
  area: [45, 320],
  land_area: [60, 480],
  floor_area: [80, 560],
  built_area: [200, 2400],
  frontage: [4, 18],
  road_width: [3, 14],
  floors: [1, 5],
  bedrooms: [1, 5],
  floor: [2, 24],
  remaining_term: [18, 46],
  year: [2012, 2022],
  odo: [12000, 145000],
  engine_cc: [110, 175],
  tonnage: [1, 15],
  axles: [2, 4],
  op_hours: [800, 9500],
  quantity: [40, 2600],
  weight_tons: [5, 140],
};

/** Fallback theo đơn vị khi key không có trong NUMBER_RANGES. */
export const UNIT_RANGES: Record<string, [number, number]> = {
  "m²": [50, 300],
  m: [4, 20],
  km: [10000, 150000],
  năm: [10, 45],
  giờ: [500, 9000],
  tấn: [2, 120],
  cc: [110, 175],
  món: [3, 40],
  cái: [5, 120],
};

/** Vốn từ cho delta field kiểu text, tra theo key. */
export const TEXT_POOLS: Record<string, string[]> = {
  brand: [
    "Toyota Camry 2.5Q",
    "Mazda CX-5 2.0 Premium",
    "Hyundai Accent 1.4 AT",
    "Ford Ranger XLS 4x2",
    "Honda City RS",
    "Kia Seltos Luxury",
  ],
  machine_type: ["Máy xúc đào bánh xích", "Máy ủi", "Máy san gạt", "Xe lu rung", "Máy khoan cọc nhồi"],
  line_type: ["Dây chuyền đóng gói tự động", "Dây chuyền sơn tĩnh điện", "Dây chuyền chế biến gỗ"],
  material_type: ["Gạch ống 8x8x18", "Cát xây dựng", "Đá 1x2", "Xi măng PCB40"],
  steel_grade: ["CB300-V", "CB400-V", "SS400", "Q345B"],
  goods_type: ["Hàng may mặc tồn kho", "Linh kiện điện tử", "Đồ gia dụng", "Vật tư ngành nước"],
  item_type: ["Bàn ghế văn phòng", "Tủ hồ sơ", "Giường ngủ gỗ tự nhiên", "Sofa phòng khách"],
  device_type: ["Máy tính để bàn", "Máy in công nghiệp", "Máy lạnh treo tường", "Máy phát điện"],
  tool_type: ["Máy khoan cầm tay", "Máy hàn điện tử", "Bộ dụng cụ cơ khí", "Máy cắt gạch"],
  material: ["Gỗ công nghiệp MDF", "Gỗ tự nhiên", "Thép sơn tĩnh điện", "Nhựa cao cấp"],
  color: ["Trắng ngọc trai", "Đen", "Bạc", "Xám titan", "Đỏ"],
  block: ["Block A", "Block B", "Tòa S2", "Tòa Park 3"],
  capacity: ["500 sản phẩm/giờ", "1.200 sản phẩm/ca", "80 tấn/ngày"],
  power_capacity: ["250 KVA", "400 KVA", "630 KVA"],
  business_type: ["Cửa hàng tiện lợi", "Nhà hàng - cà phê", "Showroom trưng bày"],
};

/** Fallback khi key text không có trong TEXT_POOLS. */
export const TEXT_FALLBACK = ["Đang chờ xác nhận"];

/**
 * Câu "bằng chứng" gắn với mỗi trường — thứ làm bản demo có sức thuyết phục.
 * Tra theo `DeltaFieldType`; trường cố định có bộ riêng ở ẢNH/khung hình.
 */
export const EVIDENCE_BY_TYPE: Record<DeltaFieldType, string[]> = {
  number: ["Đo từ khung hình toàn cảnh", "Đọc từ bảng thông số trong ảnh", "Ước lượng theo vật mốc trong ảnh"],
  text: ["Nhận diện logo & tem nhãn", "Đọc chữ trên thân tài sản", "Khớp với thư viện mẫu"],
  select: ["Phân loại theo đặc điểm hình ảnh", "Nhận diện chi tiết đặc trưng"],
  boolean: ["Suy từ đặc điểm quan sát được"],
  textarea: ["Tổng hợp từ nhiều khung hình"],
};

export const EVIDENCE_TITLE = "Tổng hợp từ ảnh bìa & loại tài sản đã chọn";
export const EVIDENCE_DESCRIPTION = "Mô tả sinh từ toàn bộ ảnh và video";
export const EVIDENCE_LOCATION = "Đối chiếu khung cảnh xung quanh & biển hiệu trong ảnh";
export const EVIDENCE_VIDEO = "Trích từ video tài sản";

/** Mẫu câu mô tả theo nhóm cấp 1. `{name}` thay bằng tên loại, `{where}` bằng khu vực. */
export const DESCRIPTION_TEMPLATES: Record<string, string[]> = {
  "bat-dong-san": [
    "{name} tại {where}, hiện trạng bàn giao nguyên trạng. Ảnh cho thấy kết cấu còn tốt, đường vào thuận tiện cho xe ô tô.",
    "{name} ở {where}, vị trí thoáng, tiếp giáp khu dân cư hiện hữu. Quan sát từ ảnh: mặt bằng bằng phẳng, không có công trình tạm.",
  ],
  "xe-co": [
    "{name}, xe còn nguyên bản, nước sơn đồng màu. Nội thất sạch, không phát hiện dấu hiệu va chạm lớn qua ảnh.",
    "{name} đang lưu giữ tại {where}. Ảnh ngoại thất cho thấy lốp còn gai, đèn và gương nguyên vẹn.",
  ],
  "may-moc": [
    "{name} đặt tại {where}, còn nguyên khối, chưa tháo dỡ. Ảnh cho thấy thân máy còn tem nhãn nhà sản xuất.",
    "{name}, tình trạng vận hành theo quan sát bên ngoài là bình thường; cần kiểm tra kỹ thuật trước khi đấu giá.",
  ],
  "hang-hoa": [
    "{name} lưu kho tại {where}, đóng kiện gọn gàng trên pallet. Ảnh cho thấy bao bì còn nguyên, không có dấu hiệu ẩm mốc.",
    "{name}, hàng xếp theo lô, thuận tiện kiểm đếm và bốc xếp bằng xe nâng.",
  ],
  "do-dung": [
    "{name} tại {where}, còn sử dụng tốt. Ảnh cho thấy bề mặt ít trầy xước, phụ kiện đi kèm đầy đủ.",
    "{name}, số lượng xếp thành bộ, phù hợp bán trọn lô.",
  ],
};

export const DESCRIPTION_FALLBACK =
  "{name} tại {where}. Thông tin mô tả được tổng hợp tự động từ ảnh và video tài sản, vui lòng kiểm tra lại trước khi gửi.";

export const MODEL_LABEL = "Thị giác máy tính · bản demo";

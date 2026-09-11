import { ASSET_CATEGORIES } from "@/constants/category.constants";

// Luật nộp hồ sơ của wizard "Số hoá tài sản", tách khỏi code wizard theo đúng
// khuôn registry-keyed-by-slug của asset-delta-fields.ts.
//
// Hai luật ở đây:
//   1. Ảnh là BẮT BUỘC với mọi nhóm (tối thiểu MIN_IMAGES). Video tuỳ chọn.
//   2. Chỉ bất động sản và xe cộ mới có giấy tờ đăng ký sở hữu (sổ đỏ / cà-vẹt).
//      Các nhóm còn lại thay bằng bản cam kết có chữ ký điện tử.

export type ProofMode = "documents" | "declaration";

type AssetParentSlug = (typeof ASSET_CATEGORIES)[number]["slug"];

// Khai đủ CẢ 8 nhóm cấp 1. Thêm nhóm mới vào category.constants.ts sẽ làm
// typecheck đỏ ngay tại đây cho tới khi có người quyết định proof mode của nó —
// cố ý, vì đây là quyết định pháp lý chứ không phải mặc định hợp lý nào cả.
const PROOF_MODE: Record<AssetParentSlug, ProofMode> = {
  "bat-dong-san": "documents",
  "xe-co": "documents",
  "may-moc": "declaration",
  "hang-hoa": "declaration",
  "do-dung": "declaration",
  // Thủ công mỹ nghệ & cổ vật không có giấy tờ đăng ký sở hữu tương đương sổ đỏ /
  // cà-vẹt, nên dùng bản cam kết. Riêng cổ vật: Luật Di sản văn hóa cấm mua bán
  // bảo vật quốc gia và siết giao dịch cổ vật — nguồn gốc khai trong delta field
  // `provenance`, thẩm định thật vẫn thuộc khâu duyệt hồ sơ ở /admin/tai-san.
  "thu-cong-my-nghe": "declaration",
  "co-vat-suu-tam": "declaration",
  // Bị Step1AssetType lọc khỏi wizard (children rỗng); khai cho đủ kiểu.
  khac: "documents",
};

/**
 * Nhóm này chứng minh sở hữu bằng giấy tờ hay bằng bản cam kết?
 *
 * Fallback là "documents" chứ KHÔNG phải "declaration" (và cố ý lệch với
 * `getDeltaFields(slug) ?? []`): đoán sai theo hướng chặt thì thành lỗi người
 * dùng báo lại ngay, đoán sai theo hướng lỏng thì âm thầm giảm mức tuân thủ.
 * Thiếu delta field chỉ là mỹ quan — thiếu proof mode thì không.
 */
export const getProofMode = (parentSlug: string): ProofMode =>
  PROOF_MODE[parentSlug as AssetParentSlug] ?? "documents";

// ─── Ngưỡng media ────────────────────────────────────────────────────────────
export const MIN_IMAGES = 1;
export const MAX_VIDEOS = 1;

// 10MB cho cả ảnh lẫn video: file_size_limit là chốt chặn CỨNG duy nhất và áp
// theo bucket, nên nâng trần cho video đồng nghĩa với mất trần của ảnh.
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 10 * 1024 * 1024;

export const IMAGE_MIME = "image/jpeg,image/png,image/webp";

// Không nhận video/quicktime: .mov từ iPhone thường là HEVC, Chrome/Firefox
// không giải mã được ⇒ upload "thành công" nhưng khung hình đen.
export const VIDEO_MIME = "video/mp4,video/webm";

// ─── Yêu cầu báo giá (RFQ) ───────────────────────────────────────────────────
// Chủ tài sản gửi hồ sơ tới NHIỀU tổ chức một lần rồi so sánh báo giá. Trần 5
// tổ chức là quyết định sản phẩm, không phải giới hạn kỹ thuật: bảng so sánh
// báo giá còn đọc được, và một tài sản rải khắp sàn thì tổ chức bắt đầu bỏ qua
// mọi yêu cầu. Trần áp cho MỖI LẦN gửi cũng như tổng số tổ chức đang chờ.
export const MAX_RFQ_ORGS = 5;

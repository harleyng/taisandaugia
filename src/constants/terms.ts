// Phiên bản Điều khoản sử dụng / Chính sách bảo mật hiện hành.
// Khớp mốc "Cập nhật lần cuối" ở trang /dieu-khoan-su-dung.
// Khi cập nhật nội dung điều khoản, đổi giá trị này để consent mới ghi đúng phiên bản.
export const TERMS_VERSION = "2026-05-17";

// ─── Bản cam kết quyền sở hữu (wizard Số hoá tài sản) ────────────────────────
// Dùng cho nhóm tài sản KHÔNG có giấy tờ đăng ký sở hữu (máy móc / hàng hoá /
// đồ dùng) — xem getProofMode() trong src/constants/asset-posting-rules.ts.
//
// Nội dung cam kết để NGAY CẠNH số phiên bản một cách cố ý: version được lưu
// vào asset_postings.ownership_declaration, nên nếu câu chữ nằm rải rác trong
// component thì version đã lưu chẳng trỏ tới văn bản nào, và sửa câu chữ sẽ
// quên bump. Đổi bất kỳ dòng nào bên dưới ⇒ đổi ASSET_DECLARATION_VERSION.
export const ASSET_DECLARATION_VERSION = "2026-09-06";

export const ASSET_DECLARATION_CLAUSES = [
  "Tôi là chủ sở hữu hợp pháp của tài sản nêu trên, hoặc được chủ sở hữu uỷ quyền hợp lệ để định đoạt tài sản.",
  "Tài sản có nguồn gốc hợp pháp, không phải tang vật, không đang tranh chấp, thế chấp, cầm cố hoặc bị kê biên để bảo đảm thi hành án.",
  "Tôi chịu trách nhiệm trước pháp luật về tính trung thực của thông tin, hình ảnh và tài liệu đã cung cấp, và bồi thường thiệt hại phát sinh nếu cam kết này không đúng sự thật.",
] as const;

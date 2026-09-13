// Câu chữ cố định của biên bản đấu giá.
//
// ⚠️ CHƯA ĐƯỢC RÀ SOÁT PHÁP LÝ. Đây là mẫu dựng theo bố cục thông dụng, đủ để
// chạy thử nghiệm — KHÔNG phải bản đã thẩm định. Sửa câu chữ ở đây phải qua
// người có chuyên môn pháp lý, VÀ tăng MINUTES_TEMPLATE_VERSION để biết biên bản
// đã phát hành dùng mẫu nào (biên bản là bất biến, không sửa lại được).
//
// File riêng, KHÔNG dùng chung với src/lib/consignment/contract-pdf/clauses.ts:
// hợp đồng dịch vụ và biên bản đấu giá là hai loại văn bản khác nhau, gộp vào là
// một lần sửa hợp đồng vô tình đổi luôn biên bản đã phát hành lần sau.

export const MINUTES_TEMPLATE_VERSION = "BBDG-MAU-2026-09";

export const LEGAL_BASES = [
  "Căn cứ Luật Đấu giá tài sản số 01/2016/QH14, được sửa đổi, bổ sung năm 2024;",
  "Căn cứ Nghị định số 172/2024/NĐ-CP quy định chi tiết một số điều của Luật Đấu giá tài sản;",
  "Căn cứ Quy chế cuộc đấu giá đã được tổ chức đấu giá tài sản ban hành và công bố;",
  "Căn cứ diễn biến cuộc đấu giá trực tuyến được ghi nhận trên hệ thống.",
];

export const PAYMENT_DUTY =
  "Người trúng đấu giá có trách nhiệm thanh toán đầy đủ số tiền trúng đấu giá theo đúng thời hạn nêu trên. " +
  "Quá thời hạn mà không thanh toán đủ thì được coi là từ chối kết quả trúng đấu giá và xử lý theo quy chế cuộc đấu giá.";

export const DEPOSIT_CLAUSE =
  "Tiền đặt trước của người trúng đấu giá được chuyển thành một phần tiền mua tài sản. " +
  "Tiền đặt trước của người không trúng đấu giá được hoàn trả theo quy chế cuộc đấu giá. " +
  "Các trường hợp không được hoàn trả tiền đặt trước thực hiện theo Điều 39 Luật Đấu giá tài sản.";

export const ONLINE_RECORD_NOTICE =
  "Mọi lượt trả giá trong cuộc đấu giá này được hệ thống ghi nhận tự động theo giờ máy chủ, " +
  "lưu trữ dưới dạng chỉ ghi thêm và không sửa được sau khi ghi.";

export const COMPLAINT_HEADING = "Ý kiến, khiếu nại tại cuộc đấu giá (nếu có)";

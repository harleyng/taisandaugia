// Điều khoản mẫu của dự thảo HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ.
//
// ⚠️ CHƯA ĐƯỢC RÀ SOÁT PHÁP LÝ — giống HDDV-MAU và BBDG-MAU. Đây là khung
// tham khảo để tổ chức đấu giá khỏi soạn từ trang trắng; bản in luôn mang dấu
// "DỰ THẢO" và lời nhắc các bên rà soát trước khi ký. Sửa câu chữ ở đây phải
// qua người có chuyên môn pháp lý — và TĂNG HDMB_TEMPLATE_VERSION để biết bản
// đã chia sẻ dùng mẫu nào.

export const HDMB_TEMPLATE_VERSION = "HDMB-MAU-2026-09";

export const LEGAL_BASES = [
  "Căn cứ Bộ luật Dân sự số 91/2015/QH13;",
  "Căn cứ Luật Đấu giá tài sản số 01/2016/QH14, được sửa đổi, bổ sung năm 2024, và các văn bản hướng dẫn thi hành;",
  "Căn cứ Biên bản đấu giá tài sản và kết quả cuộc đấu giá đã được công bố;",
  "Căn cứ sự thoả thuận của các bên.",
];

/** Điều về tiền đặt trước — Điều 39 Luật ĐGTS: đặt trước chuyển thành đặt cọc. */
export const DEPOSIT_CLAUSE =
  "Tiền đặt trước mà Bên mua đã nộp để tham gia cuộc đấu giá được chuyển thành tiền đặt cọc để bảo đảm thực hiện hợp đồng và được trừ vào giá mua tài sản.";

export const BUYER_DUTIES = [
  "Thanh toán đủ và đúng hạn số tiền mua tài sản theo Điều 4 của hợp đồng này.",
  "Nhận bàn giao tài sản theo thời gian, địa điểm hai bên thống nhất; ký biên bản bàn giao tài sản.",
  "Tự chịu chi phí và thực hiện thủ tục đăng ký quyền sở hữu, quyền sử dụng tài sản, trừ trường hợp các bên có thoả thuận khác.",
  "Được yêu cầu Bên bán giao tài sản đúng hiện trạng và giao đầy đủ giấy tờ liên quan đến tài sản.",
];

export const SELLER_DUTIES = [
  "Giao tài sản đúng hiện trạng đã công bố tại cuộc đấu giá và giao đầy đủ giấy tờ liên quan đến tài sản.",
  "Bảo đảm tài sản thuộc quyền định đoạt hợp pháp của mình và không có tranh chấp tại thời điểm ký hợp đồng, trừ những nội dung đã công bố công khai.",
  "Phối hợp với Bên mua thực hiện thủ tục đăng ký sang tên theo quy định của pháp luật.",
  "Được nhận đủ tiền mua tài sản theo Điều 4 của hợp đồng này.",
];

export const HANDOVER_TERMS =
  "Tài sản được bàn giao trên thực địa theo hiện trạng tại thời điểm đấu giá, sau khi Bên mua đã thanh toán đủ tiền mua tài sản. Việc bàn giao được lập thành biên bản có chữ ký của hai bên.";

export const TITLE_TRANSFER_TERMS =
  "Hai bên phối hợp thực hiện thủ tục đăng ký chuyển quyền sở hữu, quyền sử dụng tài sản tại cơ quan nhà nước có thẩm quyền theo quy định của pháp luật. Thời điểm chuyển quyền sở hữu được xác định theo quy định của pháp luật chuyên ngành.";

export const BREACH_TERMS = [
  "Bên mua không thanh toán đủ tiền mua tài sản đúng hạn thì bị coi là từ chối mua tài sản; tiền đặt cọc thuộc về Bên bán, trừ trường hợp các bên có thoả thuận khác hoặc pháp luật có quy định khác.",
  "Bên bán từ chối giao tài sản thì phải hoàn trả cho Bên mua số tiền đã nhận và bồi thường thiệt hại theo quy định của pháp luật.",
  "Hợp đồng chấm dứt khi các bên hoàn thành nghĩa vụ, khi hai bên thoả thuận chấm dứt, hoặc trong các trường hợp pháp luật quy định.",
  "Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng; không thương lượng được thì mỗi bên có quyền yêu cầu Toà án có thẩm quyền giải quyết.",
];

export const EFFECT = [
  "Hợp đồng có hiệu lực kể từ ngày các bên ký.",
  "Hợp đồng được lập thành 04 bản có giá trị pháp lý như nhau, mỗi bên giữ 02 bản.",
];

export const NOTARIZATION_NOTE =
  "Hợp đồng này được công chứng, chứng thực theo quy định của pháp luật trước khi thực hiện thủ tục đăng ký quyền sở hữu.";

export const DRAFT_NOTICE =
  "Dự thảo tạo tự động từ kết quả cuộc đấu giá trên sàn. Điều khoản là mẫu tham khảo — các bên rà soát, chỉnh sửa trước khi ký.";

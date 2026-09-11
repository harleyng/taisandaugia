import type { CaseTopic } from "@/types/case-qa";

/**
 * 20 câu người mua hỏi đi hỏi lại — mỗi chủ đề một câu. Dùng cho FAQ công khai
 * của từng phiên và thẻ "độ phủ" ở portal.
 */
export interface StandardQuestion {
  topic: CaseTopic;
  question: string;
}

export const STANDARD_QUESTIONS: readonly StandardQuestion[] = [
  { topic: "deposit", question: "Tiền đặt trước là bao nhiêu?" },
  { topic: "deposit_deadline", question: "Hạn nộp tiền đặt trước là khi nào?" },
  { topic: "deposit_method", question: "Nộp tiền đặt trước vào tài khoản nào?" },
  { topic: "deposit_refund", question: "Không trúng đấu giá thì tiền đặt trước được hoàn trả khi nào?" },
  { topic: "deposit_forfeit", question: "Trường hợp nào bị mất tiền đặt trước?" },
  { topic: "registration_deadline", question: "Hạn chót nộp hồ sơ đăng ký là ngày nào?" },
  { topic: "document_sale", question: "Mua hồ sơ tham gia đấu giá ở đâu?" },
  { topic: "document_fee", question: "Tiền mua hồ sơ là bao nhiêu?" },
  { topic: "documents_required", question: "Hồ sơ đăng ký tham gia gồm những giấy tờ gì?" },
  { topic: "eligibility", question: "Ai được tham gia đấu giá?" },
  { topic: "proxy", question: "Tôi có thể uỷ quyền cho người khác đi đấu giá thay không?" },
  { topic: "viewing", question: "Khi nào được đi xem tài sản?" },
  { topic: "starting_price", question: "Giá khởi điểm là bao nhiêu?" },
  { topic: "bid_step", question: "Bước giá là bao nhiêu?" },
  { topic: "schedule", question: "Cuộc đấu giá diễn ra vào ngày giờ nào?" },
  { topic: "venue", question: "Cuộc đấu giá tổ chức ở đâu?" },
  { topic: "format", question: "Đấu giá theo hình thức nào?" },
  { topic: "payment", question: "Trúng đấu giá thì thanh toán trong bao lâu?" },
  { topic: "auction_failed", question: "Trường hợp nào đấu giá không thành?" },
  { topic: "withdrawal", question: "Rút lại giá đã trả hoặc từ chối kết quả thì sao?" },
];

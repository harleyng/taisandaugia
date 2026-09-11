import type {
  AuthorKind,
  CaseDocType,
  ChatChannel,
  ChatMode,
  EscalationReason,
  EscalationStatus,
  MyQuestionState,
  QaState,
  UploadableDocType,
} from "@/types/case-qa";

// Nhãn UI dùng "Tài liệu phiên", KHÔNG dùng "hồ sơ" — trên sàn "hồ sơ" đã là hồ sơ
// tham gia đấu giá của người mua (auction_bidding_contracts).

export const DOC_TYPE_LABELS: Record<CaseDocType, string> = {
  notice: "Thông báo đấu giá",
  rules: "Quy chế cuộc đấu giá",
  deposit_terms: "Điều kiện tiền đặt trước & thời hạn",
  viewing_schedule: "Lịch xem tài sản",
  clarification: "Giải đáp bổ sung của tổ chức",
};

export const DOC_TYPE_HINTS: Record<CaseDocType, string> = {
  notice: "Thông báo công khai việc đấu giá: tài sản, giá khởi điểm, thời gian bán hồ sơ, thời gian và địa điểm tổ chức.",
  rules: "Quy chế cuộc đấu giá: đối tượng, hồ sơ đăng ký, bước giá, các trường hợp đấu giá không thành, thanh toán.",
  deposit_terms: "Khoản tiền đặt trước, thời hạn và cách nộp, hoàn trả và các trường hợp không được nhận lại.",
  viewing_schedule: "Thời gian, địa điểm và cách đăng ký xem tài sản.",
  clarification: "Nội dung tổ chức bổ sung khi người mua hỏi điều tài liệu gốc chưa nêu.",
};

export const UPLOADABLE_DOC_TYPES: readonly UploadableDocType[] = ["notice", "rules", "deposit_terms", "viewing_schedule"];

export const ESCALATION_REASON_LABELS: Record<EscalationReason, string> = {
  no_documents: "Phiên chưa có tài liệu đã xác nhận",
  no_match: "Tài liệu phiên không nêu nội dung này",
  out_of_scope: "Ngoài phạm vi tài liệu phiên (tư vấn, dự đoán, phiên khác…)",
  low_confidence: "Độ tin cậy thấp",
  ambiguous: "Chưa rõ hỏi lô tài sản nào",
  conflict: "Các tài liệu nêu số liệu khác nhau",
  partial_match: "Chỉ trả lời được một phần câu hỏi",
  citation_invalid: "Trích dẫn không khớp điều khoản đã xác nhận",
  no_case: "Chưa xác định phiên đấu giá",
  staff_flagged: "Chuyên viên chuyển tiếp",
};

export const CHANNEL_LABELS: Record<ChatChannel, string> = {
  marketplace: "Sàn",
  zalo: "Zalo",
};

export const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  auto_send: "Tự động gửi câu trả lời có trích dẫn",
  draft: "Soạn nháp — chuyên viên duyệt trước khi gửi",
};

export const QA_STATE_LABELS: Record<QaState, string> = {
  pending: "Đang xử lý",
  auto_answered: "Đã trả lời",
  draft_ready: "Chờ duyệt nháp",
  escalated: "Cần chuyên viên",
  staff_answered: "Chuyên viên đã trả lời",
};

export const ESCALATION_STATUS_LABELS: Record<EscalationStatus, string> = {
  open: "Chưa xử lý",
  added_to_case: "Đã bổ sung vào tài liệu phiên",
  dismissed: "Không cần bổ sung",
};

export const MY_QUESTION_STATE_LABELS: Record<MyQuestionState, string> = {
  answered: "Đã trả lời",
  outdated: "Tài liệu phiên đã thay đổi",
  escalated: "Đã chuyển chuyên viên",
  pending_review: "Đang chờ chuyên viên xác nhận",
};

export const AUTHOR_KIND_LABELS: Record<AuthorKind, string> = {
  bidder: "Người hỏi",
  ai: "AI · trích từ tài liệu phiên",
  staff: "Chuyên viên trả lời",
  system: "Tin nhắn tự động",
};

export function confidenceTier(c: number | null | undefined): { label: string; tone: "high" | "mid" | "low" } {
  const v = c ?? 0;
  if (v >= 0.85) return { label: "Tin cậy cao", tone: "high" };
  if (v >= 0.6) return { label: "Tin cậy vừa", tone: "mid" };
  return { label: "Cần kiểm tra", tone: "low" };
}

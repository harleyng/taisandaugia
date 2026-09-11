// Hỏi đáp theo tài liệu phiên + hộp thư đa kênh (omnichat) của tổ chức đấu giá.
// Bảng + RPC: supabase/migrations/20260912000002_case_documents.sql và
// 20260912000003_case_chat.sql. Engine mock: src/lib/caseQa/.

export type CaseDocType = "notice" | "rules" | "deposit_terms" | "viewing_schedule" | "clarification";
/** Loại tài liệu tải tệp lên được. "clarification" sinh từ câu hỏi chuyển tiếp, không có tệp. */
export type UploadableDocType = Exclude<CaseDocType, "clarification">;

export type ReviewStatus = "draft" | "confirmed";
export type ClauseSource = "extracted" | "manual";
export type ExtractionStatus = "none" | "extracted" | "failed";

export type CaseTopic =
  | "deposit"
  | "deposit_deadline"
  | "deposit_method"
  | "deposit_refund"
  | "deposit_forfeit"
  | "registration_deadline"
  | "document_sale"
  | "document_fee"
  | "documents_required"
  | "eligibility"
  | "proxy"
  | "viewing"
  | "starting_price"
  | "bid_step"
  | "schedule"
  | "venue"
  | "format"
  | "payment"
  | "auction_failed"
  | "withdrawal";

export type EscalationReason =
  | "no_documents"
  | "no_match"
  | "out_of_scope"
  | "low_confidence"
  | "ambiguous"
  | "conflict"
  | "partial_match"
  | "citation_invalid"
  | "no_case"
  | "staff_flagged";

/** Lý do engine được phép tự nêu. Ba lý do còn lại chỉ server gán. */
export type EngineEscalationReason = Exclude<EscalationReason, "citation_invalid" | "no_case" | "staff_flagged">;

/** Một điều khoản đưa vào engine. `citable` = đã xác nhận VÀ tài liệu cha đã xác nhận. */
export interface EngineClause {
  clause_id: string;
  document_id: string;
  doc_type: CaseDocType;
  doc_title: string;
  clause_ref: string;
  heading: string | null;
  body: string;
  topics: string[];
  sort_order: number;
  citable: boolean;
}

export interface ProposedCitation {
  clause_id: string;
  /** Đoạn trích NGUYÊN VĂN — server kiểm là chuỗi con của thân điều khoản. */
  quote: string;
}

/**
 * Đề xuất của engine gửi lên RPC. KHÔNG mang văn bản câu trả lời: server tự dựng
 * câu trả lời từ các đoạn trích đã kiểm, nên client không chèn được chữ bịa.
 */
export interface CaseQaProposal {
  outcome: "answer" | "escalate";
  reason?: EngineEscalationReason;
  topics: CaseTopic[];
  confidence: number;
  citations: ProposedCitation[];
  engine: string;
}

/** Bản chụp trích dẫn server lưu trên chat_messages.citations. quote NULL = chuyên viên gắn cả điều khoản. */
export interface CitationSnapshot {
  clause_id: string;
  document_id: string;
  doc_type: CaseDocType;
  doc_title: string;
  clause_ref: string;
  heading: string | null;
  quote: string | null;
}

export type ChatChannel = "marketplace" | "zalo";
export type ChatMode = "auto_send" | "draft";
export type QaState = "pending" | "auto_answered" | "draft_ready" | "escalated" | "staff_answered";
export type DeliveryStatus = "draft" | "sent" | "discarded";
export type AuthorKind = "bidder" | "ai" | "staff" | "system";
export type ConversationStatus = "open" | "resolved";
export type EscalationStatus = "open" | "added_to_case" | "dismissed";
export type MyQuestionState = "answered" | "outdated" | "escalated" | "pending_review";

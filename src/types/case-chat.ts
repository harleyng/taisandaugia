// Kiểu dữ liệu DB của tài liệu phiên + hộp thư. Kiểu thuần engine: ./case-qa.ts.

import type { Database, Tables } from "@/integrations/supabase/types";
import type {
  AuthorKind,
  CaseDocType,
  ChatChannel,
  ChatMode,
  CitationSnapshot,
  ClauseSource,
  ConversationStatus,
  DeliveryStatus,
  EscalationReason,
  EscalationStatus,
  ExtractionStatus,
  MyQuestionState,
  QaState,
  ReviewStatus,
} from "./case-qa";

export type CaseDocument = Omit<Tables<"case_documents">, "doc_type" | "review_status" | "extraction_status"> & {
  doc_type: CaseDocType;
  review_status: ReviewStatus;
  extraction_status: ExtractionStatus;
};

export type CaseClause = Omit<Tables<"case_document_clauses">, "status" | "source"> & {
  status: ReviewStatus;
  source: ClauseSource;
};

export interface CaseDocumentWithClauses extends CaseDocument {
  case_document_clauses: CaseClause[];
}

export type ChatConversation = Omit<Tables<"chat_conversations">, "channel" | "status"> & {
  channel: ChatChannel;
  status: ConversationStatus;
};

export type ChatMessage = Omit<
  Tables<"chat_messages">,
  "direction" | "author_kind" | "qa_state" | "delivery_status" | "citations"
> & {
  direction: "inbound" | "outbound";
  author_kind: AuthorKind;
  qa_state: QaState | null;
  delivery_status: DeliveryStatus | null;
  citations: CitationSnapshot[];
};

type EscalationBrief = { reason: EscalationReason; status: EscalationStatus };

export interface ChatThreadMessage extends ChatMessage {
  auction_sessions: { code: string | null; title: string } | null;
  /** message_id là UNIQUE nên PostgREST nhúng một-một; đọc qua escalationOf() để đỡ cả dạng mảng. */
  case_question_escalations: EscalationBrief | EscalationBrief[] | null;
}

export const escalationOf = (m: Pick<ChatThreadMessage, "case_question_escalations">): EscalationBrief | null =>
  Array.isArray(m.case_question_escalations) ? (m.case_question_escalations[0] ?? null) : m.case_question_escalations;

export interface ChatThread {
  conversation: ChatConversation;
  messages: ChatThreadMessage[];
}

type InboxRpcRow = Database["public"]["Functions"]["org_chat_inbox"]["Returns"][number];
export type InboxRow = Omit<InboxRpcRow, "channel" | "status"> & { channel: ChatChannel; status: ConversationStatus };

export type CaseEscalation = Omit<Tables<"case_question_escalations">, "reason" | "status" | "channel"> & {
  reason: EscalationReason;
  status: EscalationStatus;
  channel: ChatChannel;
  auction_sessions: { code: string | null; title: string } | null;
  chat_conversations: { contact_name: string; is_simulated: boolean } | null;
};

export interface ChatSettingsInput {
  marketplace_mode: ChatMode;
  zalo_mode: ChatMode;
  min_confidence: number;
  escalation_reply: string;
}

export interface OrgChatSettings extends ChatSettingsInput {
  /** Tổ chức chưa lưu cấu hình lần nào ⇒ đang dùng mặc định an toàn (soạn nháp). */
  isDefault: boolean;
  updated_at: string | null;
}

export interface MyCaseQuestion {
  message_id: string;
  question: string;
  asked_at: string;
  state: MyQuestionState;
  answer_body: string | null;
  answer_citations: CitationSnapshot[];
  answered_at: string | null;
  answered_by: "ai" | "staff" | null;
}

export interface ChatAttentionCounts {
  awaitingReply: number;
  drafts: number;
  openEscalations: number;
}

/** Kết quả chung của ask_case_question / org_simulate_zalo_message / org_retry_case_answer. */
export interface QaRpcResult {
  state: "auto_answered" | "draft_ready" | "escalated";
  reason?: EscalationReason;
  message_id: string;
  conversation_id?: string;
  answer?: { body: string; citations: CitationSnapshot[] } | null;
}

import type { CaseQaProposal, CitationSnapshot, EngineClause } from "@/types/case-qa";
import { answerCaseQuestion } from "./answerEngine";
import { composeAnswerText, snapshotCitations } from "./compose";
import { STANDARD_QUESTIONS, type StandardQuestion } from "./standardQuestions";

export interface FaqEntry extends StandardQuestion {
  proposal: CaseQaProposal;
  citations: CitationSnapshot[];
  /** Văn bản xem trước; null khi tài liệu chưa trả lời được câu này. */
  answerText: string | null;
}

/**
 * Chạy 20 câu chuẩn trên bộ điều khoản — FAQ công khai và thẻ độ phủ ở portal.
 * Đầu vào phải là điều khoản citable (RPC case_citable_clauses); engine tự lọc lần nữa.
 */
export function buildCaseFaq(clauses: readonly EngineClause[], sessionCode: string): FaqEntry[] {
  return STANDARD_QUESTIONS.map((sq) => {
    const proposal = answerCaseQuestion({ question: sq.question, sessionCode, clauses });
    const citations = proposal.outcome === "answer" ? snapshotCitations(proposal.citations, clauses) : [];
    return {
      ...sq,
      proposal,
      citations,
      answerText: citations.length ? composeAnswerText(sessionCode, citations) : null,
    };
  });
}

export function faqCoverage(entries: readonly FaqEntry[]) {
  const answered = entries.filter((e) => e.proposal.outcome === "answer").length;
  return { answered, total: entries.length };
}

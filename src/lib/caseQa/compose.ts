import type { CitationSnapshot, EngineClause, ProposedCitation } from "@/types/case-qa";

/**
 * Dựng câu trả lời văn bản thuần (dán thẳng vào Zalo được, không markdown).
 *
 * ⚠️ BẢN SONG SINH của public.case_qa_compose_answer (20260912000003). Tin nhắn
 * thật gửi cho người mua do SQL dựng; bản TS này chỉ để xem trước (FAQ công khai,
 * trang xem trước ở portal). Sửa định dạng thì sửa CẢ HAI.
 */
export function composeAnswerText(sessionCode: string, citations: readonly CitationSnapshot[]): string {
  const blocks = citations.map((c) => {
    const basis = `Căn cứ: ${c.clause_ref}${c.heading ? ` – ${c.heading}` : ""}, ${c.doc_title}`;
    return c.quote ? `“${c.quote}”\n${basis}` : basis;
  });
  return [`Theo tài liệu phiên ${sessionCode}:`, ...blocks].join("\n\n");
}

/** Gắn metadata điều khoản vào trích dẫn đề xuất — bỏ trích dẫn không tìm thấy điều khoản. */
export function snapshotCitations(
  citations: readonly ProposedCitation[],
  clauses: readonly EngineClause[],
): CitationSnapshot[] {
  const byId = new Map(clauses.map((c) => [c.clause_id, c]));
  return citations.flatMap((cit) => {
    const c = byId.get(cit.clause_id);
    if (!c) return [];
    return [
      {
        clause_id: c.clause_id,
        document_id: c.document_id,
        doc_type: c.doc_type,
        doc_title: c.doc_title,
        clause_ref: c.clause_ref,
        heading: c.heading,
        quote: cit.quote,
      },
    ];
  });
}

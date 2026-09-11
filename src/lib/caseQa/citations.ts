import type { CitationSnapshot } from "@/types/case-qa";

/** Neo HTML của một điều khoản trên trang hỏi đáp — chip trích dẫn trỏ về đây. */
export const clauseAnchorId = (clauseId: string) => `dieu-khoan-${clauseId}`;

/** "Khoản 1 – Khoản tiền đặt trước, Điều kiện tiền đặt trước" — khớp dòng "Căn cứ" của SQL. */
export function citationBasis(c: Pick<CitationSnapshot, "clause_ref" | "heading" | "doc_title">): string {
  return `${c.clause_ref}${c.heading ? ` – ${c.heading}` : ""}, ${c.doc_title}`;
}

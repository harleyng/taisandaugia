import { BookOpen } from "lucide-react";
import { citationBasis, clauseAnchorId } from "@/lib/caseQa/citations";
import { cn } from "@/lib/utils";
import type { CitationSnapshot } from "@/types/case-qa";

interface Props {
  citation: CitationSnapshot;
  /** Trên trang hỏi đáp: dòng "Căn cứ" nhảy tới điều khoản trong danh mục bên dưới. */
  linkToClause?: boolean;
  className?: string;
}

/** Một trích dẫn: đoạn nguyên văn + dòng "Căn cứ". Không bao giờ hiện câu trả lời mà thiếu phần này. */
export function CitationQuote({ citation, linkToClause, className }: Props) {
  const basis = citationBasis(citation);
  return (
    <figure className={cn("rounded-xl border border-border bg-muted/40 p-3", className)}>
      {citation.quote && (
        <blockquote className="whitespace-pre-line border-l-2 border-primary pl-3 text-sm text-foreground">
          “{citation.quote}”
        </blockquote>
      )}
      <figcaption className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", citation.quote && "mt-2")}>
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Căn cứ:{" "}
          {linkToClause ? (
            <a
              href={`#${clauseAnchorId(citation.clause_id)}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {basis}
            </a>
          ) : (
            <span className="font-medium text-foreground">{basis}</span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

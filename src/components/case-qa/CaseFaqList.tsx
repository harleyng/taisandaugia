import { useMemo } from "react";
import { CheckCircle2, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { buildCaseFaq, faqCoverage } from "@/lib/caseQa/coverage";
import type { EngineClause } from "@/types/case-qa";
import { CitationQuote } from "./CitationQuote";

interface Props {
  clauses: EngineClause[];
  sessionCode: string;
  /** Câu tài liệu chưa nêu → mời gửi câu hỏi (điền sẵn nội dung). */
  onAsk?: (question: string) => void;
}

/** 20 câu hỏi thường gặp, trả lời NGAY trên trình duyệt từ điều khoản đã xác nhận. */
export function CaseFaqList({ clauses, sessionCode, onAsk }: Props) {
  const entries = useMemo(() => buildCaseFaq(clauses, sessionCode), [clauses, sessionCode]);
  const { answered, total } = faqCoverage(entries);
  const ordered = [...entries.filter((e) => e.citations.length), ...entries.filter((e) => !e.citations.length)];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">Câu hỏi thường gặp</h2>
        <p className="text-xs text-muted-foreground">
          Tài liệu phiên trả lời được {answered}/{total} câu
        </p>
      </div>
      <Accordion type="multiple" className="rounded-2xl border border-border bg-card">
        {ordered.map((entry) => {
          const hasAnswer = entry.citations.length > 0;
          return (
            <AccordionItem key={entry.topic} value={entry.topic} className="px-4 last:border-b-0">
              <AccordionTrigger className="gap-3 text-left text-sm hover:no-underline">
                <span className="flex items-start gap-2">
                  {hasAnswer ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={hasAnswer ? "text-foreground" : "text-muted-foreground"}>{entry.question}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {hasAnswer ? (
                  entry.citations.map((c) => <CitationQuote key={c.clause_id} citation={c} linkToClause />)
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                    <span>Tài liệu phiên chưa nêu nội dung này.</span>
                    {onAsk && (
                      <Button variant="outline" size="sm" onClick={() => onAsk(entry.question)}>
                        Gửi câu hỏi cho tổ chức
                      </Button>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}

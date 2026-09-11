import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useCitableClauses } from "@/hooks/useCitableClauses";
import { buildCaseFaq, faqCoverage } from "@/lib/caseQa/coverage";
import { CASE_TOPIC_LABELS } from "@/lib/caseQa/topics";

/** Bao nhiêu trong 20 câu hỏi thường gặp đã trả lời được bằng điều khoản ĐÃ XÁC NHẬN. */
export function QaCoverageCard({ sessionId, sessionCode }: { sessionId: string; sessionCode: string }) {
  const { data: clauses = [] } = useCitableClauses(sessionId);
  const entries = useMemo(() => buildCaseFaq(clauses, sessionCode), [clauses, sessionCode]);
  const { answered, total } = faqCoverage(entries);
  const missing = entries.filter((e) => e.proposal.outcome !== "answer");

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Độ phủ 20 câu hỏi thường gặp</p>
        <span className="text-sm font-bold text-primary">
          {answered}/{total}
        </span>
      </div>
      <Progress value={Math.round((answered / total) * 100)} className="mt-2 h-2" />
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Chưa trả lời được: {missing.map((m) => CASE_TOPIC_LABELS[m.topic]).join(" · ")}
        </p>
      )}
    </div>
  );
}

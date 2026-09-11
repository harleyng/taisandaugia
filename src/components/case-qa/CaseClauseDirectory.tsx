import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { clauseAnchorId } from "@/lib/caseQa/citations";
import { DOC_TYPE_LABELS } from "@/lib/caseQa/labels";
import type { EngineClause } from "@/types/case-qa";

/** Toàn văn các điều khoản đã xác nhận, nhóm theo tài liệu — đích của mọi chip trích dẫn. */
export function CaseClauseDirectory({ clauses }: { clauses: EngineClause[] }) {
  const groups: { documentId: string; title: string; label: string; items: EngineClause[] }[] = [];
  for (const c of clauses) {
    let g = groups.find((x) => x.documentId === c.document_id);
    if (!g) {
      g = { documentId: c.document_id, title: c.doc_title, label: DOC_TYPE_LABELS[c.doc_type], items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Điều khoản trong tài liệu phiên</h2>
      {groups.map((g) => (
        <Card key={g.documentId} className="space-y-3 rounded-2xl p-5">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-foreground">{g.title}</p>
              <p className="text-xs text-muted-foreground">{g.label}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {g.items.map((c) => (
              <div key={c.clause_id} id={clauseAnchorId(c.clause_id)} className="scroll-mt-24 py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-foreground">
                  {c.clause_ref}
                  {c.heading && <span className="text-muted-foreground"> – {c.heading}</span>}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </section>
  );
}

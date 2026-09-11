import { useState } from "react";
import { CheckCheck, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteCaseClause, useSetClauseStatus } from "@/hooks/useCaseDocuments";
import { hasPlaceholder } from "@/lib/caseQa/placeholders";
import { CASE_TOPIC_LABELS, isCaseTopic } from "@/lib/caseQa/topics";
import type { CaseClause, CaseDocumentWithClauses } from "@/types/case-chat";
import { ClauseEditorDialog } from "./ClauseEditorDialog";

function ClauseBody({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-line text-sm text-foreground">
      {body.split(/(\[\[[^\]]*\]\])/g).map((part, i) =>
        part.startsWith("[[") ? (
          <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

interface Props {
  doc: CaseDocumentWithClauses;
  readOnly: boolean;
}

/** Duyệt từng điều khoản: điền chỗ trống, gắn chủ đề, xác nhận. */
export function ClauseReviewTable({ doc, readOnly }: Props) {
  const [editing, setEditing] = useState<CaseClause | "new" | null>(null);
  const setStatus = useSetClauseStatus();
  const remove = useDeleteCaseClause();
  const clauses = doc.case_document_clauses;
  const confirmable = clauses.filter((c) => c.status === "draft" && !hasPlaceholder(c.body));
  const nextSortOrder = (clauses.at(-1)?.sort_order ?? 0) + 10;

  return (
    <div className="space-y-3 px-4 pb-4">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            Thêm điều khoản
          </Button>
          {confirmable.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate({ sessionId: doc.session_id, ids: confirmable.map((c) => c.id), status: "confirmed" })
              }
            >
              <CheckCheck className="h-4 w-4" />
              Xác nhận {confirmable.length} điều khoản đã điền đủ
            </Button>
          )}
        </div>
      )}

      {clauses.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Chưa có điều khoản. Trích xuất từ tệp hoặc thêm thủ công.
        </p>
      ) : (
        <ul className="space-y-2">
          {clauses.map((c) => {
            const placeholder = hasPlaceholder(c.body);
            return (
              <li key={c.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{c.clause_ref}</span>
                    {c.heading && <span className="text-sm font-medium text-foreground">{c.heading}</span>}
                    {c.status === "confirmed" ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[11px] text-primary">
                        Đã xác nhận
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                        Nháp
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[11px]">
                      {c.source === "extracted" ? "Trích xuất giả lập" : "Nhập tay"}
                    </Badge>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)} aria-label="Sửa điều khoản">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {c.status === "draft" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          disabled={placeholder || setStatus.isPending}
                          title={placeholder ? "Còn chỗ [[CẦN NHẬP]]" : undefined}
                          onClick={() => setStatus.mutate({ sessionId: doc.session_id, ids: [c.id], status: "confirmed" })}
                        >
                          Xác nhận
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Mở lại điều khoản"
                          onClick={() => setStatus.mutate({ sessionId: doc.session_id, ids: [c.id], status: "draft" })}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Xoá điều khoản"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ sessionId: doc.session_id, id: c.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <ClauseBody body={c.body} />
                <div className="flex flex-wrap gap-1">
                  {c.topics.length === 0 ? (
                    <span className="text-[11px] text-amber-700">Chưa gắn chủ đề — AI sẽ không dùng điều khoản này</span>
                  ) : (
                    c.topics.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[11px] font-normal">
                        {isCaseTopic(t) ? CASE_TOPIC_LABELS[t] : t}
                      </Badge>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ClauseEditorDialog
          doc={doc}
          clause={editing === "new" ? null : editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

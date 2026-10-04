import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AUDIT_ACTOR_KIND_LABELS,
  auditChangeRows,
  auditEntityHref,
  auditEntityTypeLabel,
  auditModuleLabel,
  auditSessionRows,
  auditSummary,
  formatAuditDateTime,
  type AuditEntry,
} from "@/lib/ownerAudit";
import { AuditActionBadge } from "./AuditActionBadge";

interface Props {
  entry: AuditEntry | null;
  onOpenChange: (open: boolean) => void;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Chi tiết một dòng nhật ký: ai / lúc nào / ở đâu + bảng trước → sau. */
export function AuditEntryDialog({ entry, onOpenChange }: Props) {
  const navigate = useNavigate();
  if (!entry) return null;

  const rows = auditChangeRows(entry);
  const sessionRows = auditSessionRows(entry);
  const href = auditEntityHref(entry);
  const isCreate = entry.action === "create";
  const isDelete = entry.action === "delete";
  const edits = typeof entry.meta?.edits === "number" ? entry.meta.edits : null;

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-base">
            <AuditActionBadge action={entry.action} />
            <span className="min-w-0">{auditSummary(entry)}</span>
          </DialogTitle>
          <DialogDescription>{entry.entity_label ?? auditModuleLabel(entry.module)}</DialogDescription>
        </DialogHeader>

        <dl className="divide-y rounded-xl border px-3">
          <InfoRow label="Thời gian">
            {formatAuditDateTime(entry.created_at)}
            {edits && edits > 1 && (
              <span className="text-muted-foreground">
                {" "}
                — gộp {edits} lần sửa, lần cuối {formatAuditDateTime(entry.last_at)}
              </span>
            )}
          </InfoRow>
          <InfoRow label="Người thực hiện">
            {entry.actor_label}
            {entry.actor_kind !== "member" && (
              <span className="text-muted-foreground"> · {AUDIT_ACTOR_KIND_LABELS[entry.actor_kind]}</span>
            )}
          </InfoRow>
          <InfoRow label="Module">{auditModuleLabel(entry.module)}</InfoRow>
          {entry.entity_type && <InfoRow label="Loại dữ liệu">{auditEntityTypeLabel(entry.entity_type)}</InfoRow>}
          {entry.branch_name && <InfoRow label="Chi nhánh">{entry.branch_name}</InfoRow>}
          {entry.path && <InfoRow label="Trang">{entry.path}</InfoRow>}
          {sessionRows.map((r) => (
            <InfoRow key={r.label} label={r.label}>
              {r.value}
            </InfoRow>
          ))}
        </dl>

        {rows.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {isCreate ? "Giá trị khi tạo" : isDelete ? "Giá trị trước khi xoá" : "Thay đổi"}
            </h3>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Trường</th>
                    {!isCreate && <th className="px-3 py-2 text-left font-medium">Trước</th>}
                    {!isDelete && <th className="px-3 py-2 text-left font-medium">{isCreate ? "Giá trị" : "Sau"}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.key} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{r.label}</td>
                      {!isCreate && <td className="break-words px-3 py-2 text-muted-foreground line-through decoration-muted-foreground/40">{r.before}</td>}
                      {!isDelete && <td className="break-words px-3 py-2 text-foreground">{r.after}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {href && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(href);
              }}
            >
              {entry.action === "view" || entry.action === "login" || entry.action === "logout" ? "Mở trang" : "Mở bản ghi"}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { ChevronRight, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUDIT_ACTOR_KIND_LABELS,
  auditChangedFields,
  auditEntityTypeLabel,
  auditModuleLabel,
  auditSessionRows,
  auditSummary,
  type AuditEntry,
} from "@/lib/ownerAudit";
import { AuditActionBadge } from "./AuditActionBadge";

interface Props {
  rows: AuditEntry[];
  onOpen: (entry: AuditEntry) => void;
}

const GRID =
  "md:grid md:grid-cols-[4rem_minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1.6fr)_1rem] md:items-center md:gap-4";

const pad = (n: number) => String(n).padStart(2, "0");

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Hôm nay";
  if (key === yesterday) return "Hôm qua";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nhật ký nhóm theo ngày; dưới md mỗi dòng xếp chồng. Bấm dòng mở chi tiết thay đổi. */
export function AuditLogTable({ rows, onOpen }: Props) {
  const groups: { key: string; rows: AuditEntry[] }[] = [];
  for (const r of rows) {
    const key = dayKey(r.created_at);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(r);
    else groups.push({ key, rows: [r] });
  }

  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Giờ</span>
        <span>Người thực hiện</span>
        <span>Thao tác</span>
        <span>Đối tượng</span>
        <span className="sr-only">Mở</span>
      </div>
      {groups.map((g) => (
        <section key={g.key} aria-label={dayLabel(g.key)}>
          <h3 className="border-b bg-muted/40 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {dayLabel(g.key)}
          </h3>
          <ul className="divide-y">
            {g.rows.map((r) => {
              const fields = auditChangedFields(r);
              const session = auditSessionRows(r)
                .map((x) => x.value)
                .join(" · ");
              const edits = typeof r.meta?.edits === "number" ? r.meta.edits : null;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(r)}
                    className={cn(
                      "flex w-full flex-wrap items-start gap-x-3 gap-y-1 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/40",
                      GRID,
                    )}
                  >
                    <span className="w-12 shrink-0 tabular-nums text-muted-foreground md:w-auto">
                      {timeOf(r.created_at)}
                    </span>
                    <span className="min-w-0 flex-1 md:flex-none">
                      <span className="block truncate font-medium text-foreground">{r.actor_label}</span>
                      {r.actor_kind !== "member" && (
                        <span className="block text-xs text-muted-foreground">{AUDIT_ACTOR_KIND_LABELS[r.actor_kind]}</span>
                      )}
                    </span>
                    <span className="min-w-0 basis-full md:basis-auto">
                      <span className="flex min-w-0 items-center gap-2">
                        <AuditActionBadge action={r.action} />
                        <span className="truncate text-foreground">{auditSummary(r)}</span>
                      </span>
                      {(fields || session || (edits && edits > 1)) && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {fields || session}
                          {edits && edits > 1 && ` · gộp ${edits} lần sửa`}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 basis-full md:basis-auto">
                      {r.entity_label ? (
                        <span className="block truncate text-foreground">{r.entity_label}</span>
                      ) : (
                        <span className="block text-muted-foreground">{auditModuleLabel(r.module)}</span>
                      )}
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">
                          {r.entity_label ? auditEntityTypeLabel(r.entity_type) || auditModuleLabel(r.module) : ""}
                        </span>
                        {r.branch_name && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <GitBranch className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden />
                            <span className="truncate">{r.branch_name}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronRight
                      className="mt-0.5 hidden h-4 w-4 text-muted-foreground md:block"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

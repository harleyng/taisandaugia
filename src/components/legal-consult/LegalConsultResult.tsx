import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, Loader2, XCircle } from "lucide-react";
import { useLegalConsultItems } from "@/hooks/useLegalConsultations";
import { countByStatus, sortItemsForSeller } from "@/lib/legalConsult/checklist";
import { itemStatusLabel } from "@/lib/legalConsult/status";
import type { ChecklistItemStatus, LegalConsultation } from "@/types/legalConsult";
import { LegalDocChips } from "./LegalDocChips";

const when = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—");

const TONE: Record<ChecklistItemStatus, { cls: string; icon: typeof CheckCircle2 }> = {
  sufficient: { cls: "bg-success/10 text-success", icon: CheckCircle2 },
  missing: { cls: "bg-destructive/10 text-destructive", icon: XCircle },
  needs_clarification: { cls: "bg-warning/15 text-warning", icon: HelpCircle },
};

export function ItemStatusBadge({ status }: { status: string | null }) {
  const tone = status ? TONE[status as ChecklistItemStatus] : null;
  const Icon = tone?.icon ?? HelpCircle;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone?.cls ?? "bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" /> {itemStatusLabel(status)}
    </span>
  );
}

/**
 * Kết quả một phiên bản tư vấn: nhận định chung + checklist, mục Thiếu / Cần làm rõ lên
 * đầu kèm việc cần làm. BR-CNS-01: chỉ mang tính tư vấn — không đổi trạng thái hồ sơ.
 */
export function LegalConsultResult({ row, compact }: { row: LegalConsultation; compact?: boolean }) {
  const { data: items = [], isLoading } = useLegalConsultItems(row.id);
  const sorted = sortItemsForSeller(items);
  const counts = countByStatus(items);
  const pending = counts.missing + counts.needs_clarification;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Kết quả tư vấn · phiên bản {row.version}
            {row.status === "superseded" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(đã thay thế)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.code} · hoàn tất {when(row.completed_at)} · chuyên gia {row.expert_name} ({row.partner_name})
          </p>
        </div>
        {items.length > 0 && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              pending > 0 ? "bg-warning/15 text-warning" : "bg-success/10 text-success"
            }`}
          >
            {pending > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {pending > 0 ? `${pending} mục cần bổ sung / làm rõ` : "Đủ hồ sơ theo checklist"}
          </span>
        )}
      </div>

      {row.summary && <p className="whitespace-pre-line rounded-lg bg-muted/40 p-2.5 text-sm text-foreground">{row.summary}</p>}

      {!compact && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Kết quả mang tính tư vấn, không thay thế việc sàn duyệt hồ sơ và không tự xác nhận tài sản đủ điều kiện đấu giá.
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải checklist…
        </div>
      ) : (
        <ul className="divide-y divide-dashed divide-border">
          {sorted.map((it) => (
            <li key={it.id} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{it.label}</span>
                <ItemStatusBadge status={it.status} />
              </div>
              {it.status !== "sufficient" && it.required_action && (
                <p className="rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-sm text-foreground">
                  <span className="font-semibold">Cần làm: </span>
                  {it.required_action}
                </p>
              )}
              {it.expert_note && <p className="text-xs text-muted-foreground">{it.expert_note}</p>}
              {it.doc_paths.length > 0 && <LegalDocChips paths={it.doc_paths} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

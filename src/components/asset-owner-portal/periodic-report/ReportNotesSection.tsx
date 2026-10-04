import { MessageSquareText } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { formatReportDay, type ReportPayload } from "@/lib/ownerPeriodicReport";

/** Phần 6 — ghi chú của cán bộ + chữ ký (người lập / người chốt). */
export function ReportNotesSection({ payload, status }: { payload: ReportPayload; status: "draft" | "final" }) {
  const { notes, people, finalizedAt } = payload;
  return (
    <SectionCard title="7. Ghi chú của cán bộ" icon={MessageSquareText} className="break-inside-avoid">
      <div className="space-y-4">
        {notes.officer ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{notes.officer}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Không có ghi chú.</p>
        )}
        {status === "final" && (
          <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Người lập</dt>
              <dd className="text-foreground">{people.preparedBy ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Người chốt</dt>
              <dd className="text-foreground">{people.finalizedBy ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ngày chốt</dt>
              <dd className="tabular-nums text-foreground">{formatReportDay(finalizedAt)}</dd>
            </div>
          </dl>
        )}
      </div>
    </SectionCard>
  );
}

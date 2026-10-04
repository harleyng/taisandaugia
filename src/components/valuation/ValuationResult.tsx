import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openValuationCert } from "@/hooks/useValuationOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { APPRAISAL_EXPIRY_LABEL, appraisalExpiryOf } from "@/lib/dossier/expiry";
import { methodLabel, purposeLabel } from "@/lib/valuation/status";
import type { ValuationOrder } from "@/types/valuation";

const day = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy", { locale: vi }) : "—");

/** Kết quả một đơn thẩm định giá: giá trị, ngày, hiệu lực, phương pháp, chứng thư. */
export function ValuationResult({ row, compact }: { row: ValuationOrder; compact?: boolean }) {
  const expiry = row.status === "completed" ? appraisalExpiryOf(row.valid_until) : null;
  const facts: { k: string; v: string }[] = [
    { k: "Ngày thẩm định", v: day(row.valuation_date) },
    { k: "Hiệu lực đến", v: day(row.valid_until) },
    { k: "Mục đích", v: purposeLabel(row.purpose) },
    { k: "Phương pháp", v: methodLabel(row.method) },
    { k: "Đơn vị", v: row.partner_name ?? "—" },
    { k: "Thẩm định viên", v: row.expert_name ?? "—" },
    ...(row.certificate_no ? [{ k: "Số chứng thư", v: row.certificate_no }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Giá trị thẩm định</p>
          <p className="text-2xl font-bold text-foreground">{formatVnd(row.appraised_value)}</p>
        </div>
        {row.certificate_path && (
          <Button type="button" size="sm" variant="outline" onClick={() => openValuationCert(row.certificate_path!)}>
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Xem chứng thư
          </Button>
        )}
      </div>
      {expiry && expiry !== "valid" && (
        <p
          className={`flex items-center gap-1.5 text-xs font-medium ${expiry === "expired" ? "text-destructive" : "text-warning"}`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {APPRAISAL_EXPIRY_LABEL[expiry]}
        </p>
      )}
      {!compact && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.k} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
              <dt className="text-muted-foreground">{f.k}</dt>
              <dd className="text-right font-medium text-foreground">{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {row.summary && !compact && (
        <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm text-foreground">{row.summary}</p>
      )}
    </div>
  );
}

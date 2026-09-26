import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import type { ClassifiedImport, ImportIssue } from "@/lib/ownerOutcomeImport";

const formatDay = (iso: string) => iso.split("-").reverse().join("/");

function CountBox({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums text-foreground",
          tone === "destructive" && value > 0 && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ImportIssueList({ issues, title }: { issues: ImportIssue[]; title: string }) {
  if (!issues.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border text-sm">
        {[...issues]
          .sort((a, b) => a.row - b.row)
          .map((i) => (
            <li key={`${i.row}-${i.reason}`} className="flex gap-3 px-3 py-2">
              <span className="w-14 shrink-0 tabular-nums text-muted-foreground">Dòng {i.row}</span>
              <span className="min-w-0">
                <span className="block truncate text-foreground">{i.title || "—"}</span>
                <span className="block text-xs text-destructive">{i.reason}</span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Xem trước file: số dòng sẽ ghi / bỏ trống / lỗi, lý do từng dòng lỗi và các dòng hợp lệ. */
export function OutcomeImportPreview({ result }: { result: ClassifiedImport }) {
  const warned = result.valid.filter((v) => v.warnings.length);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <CountBox label="Sẽ ghi" value={result.valid.length} />
        <CountBox label="Chưa có kết quả" value={result.skipped.length} />
        <CountBox label="Lỗi" value={result.invalid.length} tone="destructive" />
      </div>

      <ImportIssueList issues={result.invalid} title="Dòng lỗi — sẽ không ghi" />

      {warned.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Lưu ý</p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {warned.map((v) => (
              <li key={v.row}>
                Dòng {v.row}: {v.warnings.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.valid.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Dòng sẽ ghi</p>
          <ul className="max-h-56 divide-y overflow-y-auto rounded-xl border text-sm">
            {result.valid.map((v) => (
              <li key={v.row} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{v.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {v.listingId ? (v.matchedBy === "code" ? "Trên sàn · khớp theo mã" : "Trên sàn · khớp theo tên") : "Ngoài sàn"}
                    {" · "}Lượt {v.payload.round_no} · {formatDay(v.payload.auction_date)}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums text-foreground">
                  {v.payload.outcome === "sold" && v.payload.winning_price !== null
                    ? formatMoneyFull(v.payload.winning_price)
                    : OUTCOME_KIND_LABEL[v.payload.outcome]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { formatMoneyShort } from "@/utils/money";
import { monthLabel } from "@/lib/auctionPlan/totals";
import type { ClassifiedPlanItems, PlanItemIssue } from "@/lib/auctionPlan/itemsImport";

function CountBox({ label, value, tone }: { label: string; value: number; tone?: "destructive" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "destructive" && value > 0
            ? "text-2xl font-semibold tabular-nums text-destructive"
            : "text-2xl font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function PlanItemIssueList({ issues, title }: { issues: readonly PlanItemIssue[]; title: string }) {
  if (!issues.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border text-sm">
        {[...issues]
          .sort((a, b) => a.row - b.row)
          .map((i) => (
            <li key={`${i.row}-${i.reason}`} className="flex gap-3 px-3 py-2">
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground">Dòng {i.row}</span>
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

/** Xem trước file: số dòng sẽ ghi / lỗi, lý do từng dòng lỗi, và các dòng sẽ ghi. */
export function PlanItemsImportPreview({ result }: { result: ClassifiedPlanItems }) {
  const warned = result.valid.filter((v) => v.warnings.length);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <CountBox label="Sẽ ghi" value={result.valid.length} />
        <CountBox label="Lỗi — không ghi" value={result.invalid.length} tone="destructive" />
      </div>

      <PlanItemIssueList issues={result.invalid} title="Dòng lỗi — sẽ không ghi" />

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
                    {v.payload.area_m2 ? `${v.payload.area_m2} m² · ` : ""}
                    {monthLabel(v.payload.planned_month)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {v.payload.expected_start_value ? formatMoneyShort(v.payload.expected_start_value) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

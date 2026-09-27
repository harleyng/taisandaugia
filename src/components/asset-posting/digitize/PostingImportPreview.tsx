import { cn } from "@/lib/utils";
import { CHILD_NAME } from "@/constants/category.constants";
import { formatMoneyFull } from "@/utils/money";
import type { ClassifiedPostingImport, PostingImportIssue } from "@/lib/asset-posting/postingImport";

function CountBox({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums text-foreground",
          tone === "destructive" && value > 0 && "text-destructive",
          tone === "warning" && value > 0 && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

const where = (i: { sheet: string; row: number }) => `${i.sheet} · dòng ${i.row}`;

export function PostingIssueList({ issues, title }: { issues: PostingImportIssue[]; title: string }) {
  if (!issues.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border text-sm">
        {[...issues]
          .sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row)
          .map((i) => (
            <li key={`${i.sheet}-${i.row}-${i.reason}`} className="px-3 py-2">
              <span className="block text-xs text-muted-foreground">{where(i)}</span>
              <span className="block truncate text-foreground">{i.title || "—"}</span>
              <span className="block text-xs text-destructive">{i.reason}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Xem trước file: số hồ sơ sẽ tạo / có lưu ý / lỗi, lý do từng dòng lỗi và các dòng hợp lệ. */
export function PostingImportPreview({ result }: { result: ClassifiedPostingImport }) {
  const warned = result.valid.filter((v) => v.warnings.length).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <CountBox label="Sẽ tạo nháp" value={result.valid.length} />
        <CountBox label="Có lưu ý" value={warned} tone="warning" />
        <CountBox label="Lỗi" value={result.invalid.length} tone="destructive" />
      </div>

      <PostingIssueList issues={result.invalid} title="Dòng lỗi — sẽ không nhập" />

      {result.valid.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Hồ sơ sẽ tạo</p>
          <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border text-sm">
            {result.valid.map((v) => (
              <li key={`${v.sheet}-${v.row}`} className="px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{v.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {CHILD_NAME[v.payload.child_slug]} · {v.payload.province} · {where(v)}
                    </span>
                  </span>
                  {v.payload.starting_price !== null && (
                    <span className="shrink-0 text-right tabular-nums text-foreground">
                      {formatMoneyFull(v.payload.starting_price)}
                    </span>
                  )}
                </div>
                {v.warnings.length > 0 && <p className="mt-1 text-xs text-warning">{v.warnings.join("; ")}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

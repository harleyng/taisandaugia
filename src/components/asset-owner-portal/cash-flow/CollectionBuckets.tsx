import { cn } from "@/lib/utils";
import type { CollectionBucket, CollectionBucketKey } from "@/lib/ownerCashFlow";
import { moneyShortParts } from "@/utils/money";

// Màu chỉ ở chấm, viền khi chọn và số tiền quá hạn (chữ ≥ 24px ⇒ đủ tương phản 3:1).
const TONE: Record<CollectionBucketKey, { dot: string; ring: string }> = {
  overdue: { dot: "bg-destructive", ring: "ring-destructive" },
  soon: { dot: "bg-warning", ring: "ring-warning" },
  later: { dot: "bg-primary", ring: "ring-primary" },
};

interface CollectionBucketsProps {
  buckets: CollectionBucket[];
  active: CollectionBucketKey | null;
  /** Bấm lại nhóm đang chọn ⇒ bỏ lọc. */
  onToggle: (key: CollectionBucketKey) => void;
}

/** Ba ô "Quá hạn / Đến hạn trong 7 ngày / Còn hạn" — vừa là số tổng, vừa là bộ lọc bảng bên dưới. */
export function CollectionBuckets({ buckets, active, onToggle }: CollectionBucketsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Lọc khoản còn phải thu theo hạn">
      {buckets.map((b) => {
        const on = active === b.key;
        const money = moneyShortParts(b.amount);
        return (
          <button
            key={b.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(b.key)}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 rounded-2xl bg-card px-4 py-3.5 text-left shadow-card transition-shadow",
              "hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on && cn("ring-2 hover:ring-2", TONE[b.key].ring),
            )}
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", TONE[b.key].dot)} />
              <span className="truncate">
                {b.label} · <span className="tabular-nums">{b.count}</span>
              </span>
            </span>
            <span className="flex min-w-0 items-baseline gap-1">
              <span
                className={cn(
                  "truncate text-2xl font-semibold tabular-nums",
                  b.key === "overdue" && b.amount > 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {b.amount > 0 ? money.value : "0"}
              </span>
              {b.amount > 0 && <span className="shrink-0 text-sm text-muted-foreground">{money.unit}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

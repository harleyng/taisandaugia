import { useMemo, useState } from "react";
import { Loader2, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface PickRow {
  key: string;
  title: string;
  subtitle: string | null;
  meta: string;
  imageUrl: string | null;
  /** Có giá trị ⇒ không chọn được (vd đã có trong phiên). */
  disabledReason: string | null;
}

interface Props {
  rows: PickRow[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  loading: boolean;
  error: boolean;
  emptyText: string;
}

/** Danh sách chọn nhiều tài sản nguồn, có ô tìm khi danh sách dài. */
export function SourcePickList({ rows, selected, onToggle, loading, error, emptyText }: Props) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? rows.filter((r) => r.title.toLowerCase().includes(term)) : rows;
  }, [rows, q]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải…
      </div>
    );
  }
  if (error) {
    return <p className="py-10 text-center text-sm text-destructive">Không tải được danh sách. Vui lòng thử lại.</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <Package className="mx-auto mb-2 h-8 w-8" />
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {rows.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên tài sản…" className="pl-9" />
        </div>
      )}
      <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
        {visible.map((r) => {
          const disabled = !!r.disabledReason;
          const checked = selected.has(r.key);
          return (
            <label
              key={r.key}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 transition",
                checked && "border-primary bg-primary/5",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(r.key)} />
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Package className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">{[r.subtitle, r.meta].filter(Boolean).join(" · ")}</p>
              </div>
              {r.disabledReason && <span className="shrink-0 text-xs text-muted-foreground">{r.disabledReason}</span>}
            </label>
          );
        })}
        {visible.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Không có tài sản khớp “{q}”.</p>
        )}
      </div>
    </div>
  );
}

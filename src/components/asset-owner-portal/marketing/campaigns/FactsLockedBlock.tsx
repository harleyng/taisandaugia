import { Info, Lock } from "lucide-react";
import { factLines, NOT_ANNOUNCED_NOTE } from "@/lib/ownerMarketing/composer";
import type { AssetFacts } from "@/lib/ownerMarketing/campaigns";
import { cn } from "@/lib/utils";

interface FactsLockedBlockProps {
  asset: AssetFacts;
  className?: string;
}

/**
 * Dữ kiện của một tài sản, KHOÁ: đọc từ phiên / thông báo đấu giá (server dựng snapshot).
 * Không có ô nào để sửa — muốn đổi giá / hạn thì tổ chức đấu giá phải đổi thông báo.
 */
export function FactsLockedBlock({ asset, className }: FactsLockedBlockProps) {
  const lines = factLines(asset);
  return (
    <div className={cn("rounded-xl bg-muted/40 px-3.5 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={asset.title}>
          {asset.title}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
          <Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          Lấy từ thông báo đấu giá
        </span>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
        {lines.map((l) => (
          <div key={l.label} className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-muted-foreground">{l.label}:</dt>
            <dd className="min-w-0 font-medium tabular-nums text-foreground">{l.value}</dd>
          </div>
        ))}
      </dl>
      {!asset.announced && (
        <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          {NOT_ANNOUNCED_NOTE}
        </p>
      )}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, CheckCheck, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";
import { formatMoneyShort } from "@/utils/money";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";

interface StuckAssetsBlockProps {
  items: ListingRow[];
  loading: boolean;
}

export function StuckAssetsBlock({ items, loading }: StuckAssetsBlockProps) {
  const navigate = useNavigate();

  const visible = items.slice(0, 5);

  return (
    <SectionCard
      title="Tài sản tồn đọng"
      icon={AlertTriangle}
      tone="warning"
      count={items.length}
      viewAllHref="/chu-tai-san/tai-san"
    >
      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState compact icon={CheckCheck} tone="success" title="Không có tài sản tồn đọng" />
      ) : (
        <div className="space-y-1.5">
          {visible.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/listings/${item.id}`)}
            >
              {/* Thumbnail */}
              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-muted">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {formatMoneyShort(item.price)}
                </p>
              </div>

              {/* Round count badge */}
              <div className="flex items-center gap-1 shrink-0 text-[10px] font-semibold tabular-nums bg-warning/15 text-foreground px-1.5 py-0.5 rounded-full">
                <RefreshCw className="w-2.5 h-2.5" strokeWidth={1.5} />
                {item.roundCount} vòng
              </div>
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

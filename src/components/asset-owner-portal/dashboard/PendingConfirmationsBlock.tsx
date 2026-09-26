import { useNavigate } from "react-router-dom";
import { AlertCircle, Building2, CheckCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";
import { formatMoneyShort } from "@/utils/money";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";

interface PendingConfirmationsBlockProps {
  items: ListingRow[];
  totalCount: number;
  loading: boolean;
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  // Chữ giữ màu foreground trên nền nhạt của token warning để đủ tương phản.
  const cls = pct >= 80
    ? "bg-warning/15 text-foreground"
    : "bg-destructive/10 text-destructive";
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums", cls)}>
      {pct}% khớp
    </span>
  );
}

export function PendingConfirmationsBlock({ items, totalCount, loading }: PendingConfirmationsBlockProps) {
  const navigate = useNavigate();

  return (
    <SectionCard
      title="Tài sản chờ xác nhận"
      icon={AlertCircle}
      tone="warning"
      count={totalCount}
      viewAllHref="/chu-tai-san/tai-san"
    >
      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState compact icon={CheckCheck} tone="success" title="Không có tài sản nào chờ xác nhận" />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
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
                  {item.matchedName && (
                    <span className="ml-1.5">· {item.matchedName}</span>
                  )}
                </p>
              </div>

              {/* Confidence */}
              <ConfidenceBadge score={item.confidenceScore} />
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";
import { formatPrice } from "@/utils/formatters";

interface PendingConfirmationsBlockProps {
  items: ListingRow[];
  totalCount: number;
  loading: boolean;
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const cls = pct >= 80
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-600";
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", cls)}>
      {pct}% khớp
    </span>
  );
}

export function PendingConfirmationsBlock({ items, totalCount, loading }: PendingConfirmationsBlockProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">
            Tài sản chờ xác nhận
          </span>
          {totalCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 h-7 px-2 gap-1"
          onClick={() => navigate("/chu-tai-san/tai-san")}
        >
          Xem tất cả
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-amber-700/70 py-3 text-center">
          Không có tài sản nào chờ xác nhận
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-left hover:bg-amber-50 transition-colors"
              onClick={() => navigate(`/listings/${item.id}`)}
            >
              {/* Thumbnail */}
              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-muted">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatPrice(item.price, "TOTAL")}
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
    </div>
  );
}

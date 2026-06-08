import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";
import { formatPrice } from "@/utils/formatters";

interface StuckAssetsBlockProps {
  items: ListingRow[];
  loading: boolean;
}

export function StuckAssetsBlock({ items, loading }: StuckAssetsBlockProps) {
  const navigate = useNavigate();

  const visible = items.slice(0, 5);

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-orange-800">
            Tài sản tồn đọng
          </span>
          {items.length > 0 && (
            <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-100 h-7 px-2 gap-1"
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
      ) : visible.length === 0 ? (
        <p className="text-sm text-orange-700/60 py-3 text-center">
          Không có tài sản tồn đọng
        </p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-left hover:bg-orange-50 transition-colors"
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
                </p>
              </div>

              {/* Round count badge */}
              <div className="flex items-center gap-1 shrink-0 text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                <RefreshCw className="w-2.5 h-2.5" />
                {item.roundCount} vòng
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

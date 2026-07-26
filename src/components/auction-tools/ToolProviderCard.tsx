import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { OwnershipBadge } from "@/components/admin/auction-tools/ProviderStatusBadge";
import type { AuctionToolProvider } from "@/types/auctionTools";

export function ToolProviderCard({ provider }: { provider: AuctionToolProvider }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/cong-cu-dau-gia/${provider.slug}`)}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-3">
        {provider.logo_url ? (
          <img src={provider.logo_url} alt={provider.name} className="h-12 w-12 rounded-lg object-contain" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
            {provider.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{provider.name}</p>
          <OwnershipBadge isOwn={provider.is_own} />
        </div>
      </div>

      {provider.tagline && (
        <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">{provider.tagline}</p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {provider.price_label ?? "Xem chi tiết"}
        </span>
        <span className="inline-flex items-center text-sm font-medium text-primary">
          Chi tiết
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

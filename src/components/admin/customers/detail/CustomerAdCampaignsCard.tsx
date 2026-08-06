import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdStatusBadge } from "@/components/admin/advertising/AdStatusBadge";
import { useCustomerAdvertisements } from "@/hooks/useAdvertisements";

/** Chiến dịch quảng cáo banner — gắn trực tiếp qua advertisements.customer_id. */
export function CustomerAdCampaignsCard({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const { data: ads, isLoading } = useCustomerAdvertisements(customerId);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-muted-foreground" />
        Quảng cáo ({ads?.length ?? 0})
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : !ads || ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có chiến dịch quảng cáo nào gắn với khách hàng này.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {ads.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/admin/marketing/quang-cao/${a.id}`)}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
            >
              <span className="font-mono text-xs text-primary w-24 shrink-0">{a.code ?? "—"}</span>
              <span className="flex-1 text-sm text-foreground truncate">{a.name}</span>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {a.position?.name ?? ""}
              </span>
              <AdStatusBadge status={a.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

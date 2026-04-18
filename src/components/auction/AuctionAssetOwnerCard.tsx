import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, MapPin, Gavel, ChevronRight } from "lucide-react";

interface AuctionAssetOwnerCardProps {
  ownerId: string;
  fromListing?: { id: string; title: string };
}

export const AuctionAssetOwnerCard = ({ ownerId, fromListing }: AuctionAssetOwnerCardProps) => {
  const navigate = useNavigate();
  const goToOwner = () =>
    navigate(`/asset-owner/${ownerId}`, { state: fromListing ? { fromListing } : undefined });

  const { data, isLoading } = useQuery({
    queryKey: ["asset-owner-card", ownerId],
    queryFn: async () => {
      const [{ data: owner }, { count }] = await Promise.all([
        supabase.from("asset_owners").select("id, name, address").eq("id", ownerId).single(),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("asset_owner_id", ownerId)
          .in("status", ["ACTIVE", "SOLD_RENTED"]),
      ]);
      return { owner, total: count || 0 };
    },
    enabled: !!ownerId,
  });

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }

  if (!data?.owner) return null;
  const { owner, total } = data;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/asset-owner/${owner.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/asset-owner/${owner.id}`);
        }
      }}
      className="p-5 cursor-pointer transition-all hover:shadow-md hover:border-primary/40 group"
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Chủ tài sản</p>
            <span className="text-xs text-primary font-medium inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Xem tất cả tài sản
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <h3 className="text-base md:text-lg font-bold text-foreground mb-2 line-clamp-2">
            {owner.name}
          </h3>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            {owner.address && (
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{owner.address}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Gavel className="h-3.5 w-3.5 shrink-0" />
              <span>
                Tổng <span className="font-semibold text-foreground">{total}</span> tài sản đấu giá
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

import { useAssetActions } from "@/hooks/useAssetActions";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatAddress } from "@/utils/formatters";

export const SavedAssetsTab = () => {
  const { savedIds, toggleSave } = useAssetActions();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = Array.from(savedIds);
    if (ids.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }

    const fetchListings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, price_unit, area, address, property_type_slug, image_url, custom_attributes")
        .in("id", ids);
      setListings(data || []);
      setLoading(false);
    };
    fetchListings();
  }, [savedIds]);

  return (
    <div>
      <Card className="p-5 md:p-6 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tài sản đang theo dõi</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bạn sẽ nhận thông báo khi có cập nhật về các tài sản này.
            </p>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {savedIds.size} tài sản
          </span>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card className="p-10 md:p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <Heart className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground">Chưa theo dõi tài sản nào</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Bấm "Nhận thông báo khi có cập nhật" trên tài sản bạn quan tâm để được
            cập nhật khi có thay đổi.
          </p>
          <Button asChild className="mt-5">
            <Link to="/listings">Khám phá tài sản</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const addr = formatAddress(listing.address || {});
            return (
              <Card key={listing.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/auctions/${listing.id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                  >
                    {listing.title}
                  </Link>
                  {addr && <p className="text-xs text-muted-foreground mt-0.5 truncate">{addr}</p>}
                  <p className="text-sm font-bold text-primary mt-1">
                    {formatPrice(listing.price, listing.price_unit)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => toggleSave(listing.id)}
                  aria-label="Ngừng theo dõi"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

import { useAssetActions } from "@/hooks/useAssetActions";
import { NotificationPromptDialog } from "@/components/NotificationPromptDialog";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Trash2, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatAddress } from "@/utils/formatters";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const SavedAssetsTab = () => {
  const { savedIds, toggleSave, showNotificationPrompt, dismissNotificationPrompt } = useAssetActions();
  const { notificationsEnabled, toggleNotifications } = useNotificationSettings();
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
      <NotificationPromptDialog open={showNotificationPrompt} onClose={dismissNotificationPrompt} />

      <Card className="p-5 md:p-6 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tài sản quan tâm</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Danh sách các tài sản bạn đã lưu để theo dõi
            </p>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">{savedIds.size} tài sản</span>
        </div>
      </Card>

      {!notificationsEnabled && savedIds.size > 0 && (
        <Alert className="mb-5">
          <Bell className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Bật thông báo để nhận cập nhật về tài sản bạn quan tâm</span>
            <Button size="sm" variant="outline" onClick={() => toggleNotifications(true)}>
              Bật thông báo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card className="p-12 text-center">
          <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Chưa có tài sản quan tâm</p>
          <Button asChild variant="outline" className="mt-4">
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
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => toggleSave(listing.id)}
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

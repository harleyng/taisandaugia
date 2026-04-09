import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAssetActions } from "@/hooks/useAssetActions";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { AuctionCard } from "@/components/AuctionCard";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { formatAddress } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Heart, Bell, Loader2 } from "lucide-react";

const BrokerSavedAssets = () => {
  const { savedIds, toggleSave, session } = useAssetActions();
  const { notificationsEnabled, toggleNotifications } = useNotificationSettings();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || savedIds.size === 0) {
      setListings([]);
      setLoading(false);
      return;
    }
    const fetchListings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("listings")
        .select("*")
        .in("id", Array.from(savedIds));
      setListings(data || []);
      setLoading(false);
    };
    fetchListings();
  }, [session, savedIds.size]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tài sản quan tâm</h1>
        <p className="text-muted-foreground mt-1">Quản lý tài sản đã lưu</p>
      </div>

      {/* Notification banner */}
      {!notificationsEnabled && savedIds.size > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 md:p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Nhận thông báo cập nhật</h3>
              <p className="text-sm text-muted-foreground">Bật thông báo để nhận tin mới nhất về lịch đấu giá, giá khởi điểm và trạng thái phiên của tài sản bạn quan tâm.</p>
            </div>
          </div>
          <Button onClick={() => toggleNotifications(true)} className="shrink-0">
            <Bell className="mr-2 h-4 w-4" />
            Bật thông báo
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Chưa có tài sản nào</h3>
          <p className="text-muted-foreground">Bấm biểu tượng tim trên trang danh sách để lưu tài sản</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => {
            const ca = listing.custom_attributes || {};
            return (
              <AuctionCard
                key={listing.id}
                id={listing.id}
                imageUrl={listing.image_url}
                title={listing.title}
                address={formatAddress(listing.address) || "Chưa cập nhật"}
                startingPrice={listing.price}
                stepPrice={ca.bid_step ?? ca.step_price}
                depositAmount={ca.deposit_amount}
                auctionDate={ca.auction_date ?? ca.auction_time}
                registrationDeadline={ca.registration_deadline ?? ca.document_sale_end}
                sessionStatus={getSessionStatus(listing)}
                categorySlug={listing.property_type_slug}
                viewMode="grid"
                winPrice={ca.win_price ?? ca.winning_price}
                orgName={ca.org_name}
                isSaved={savedIds.has(listing.id)}
                onToggleSave={() => toggleSave(listing.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BrokerSavedAssets;

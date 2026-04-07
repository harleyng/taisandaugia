import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAssetActions } from "@/hooks/useAssetActions";
import { AuctionCard } from "@/components/AuctionCard";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { formatAddress } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bell, Loader2 } from "lucide-react";

type FilterTab = "all" | "saved" | "following" | "both";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "saved", label: "Chỉ Quan tâm" },
  { value: "following", label: "Đang nhận thông tin" },
  { value: "both", label: "Cả hai" },
];

const BrokerSavedAssets = () => {
  const { savedIds, followingIds, toggleSave, toggleFollow, session } = useAssetActions();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");

  const allIds = new Set([...savedIds, ...followingIds]);

  useEffect(() => {
    if (!session || allIds.size === 0) {
      setListings([]);
      setLoading(false);
      return;
    }
    const fetchListings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("listings")
        .select("*")
        .in("id", Array.from(allIds));
      setListings(data || []);
      setLoading(false);
    };
    fetchListings();
  }, [session, savedIds.size, followingIds.size]);

  const filtered = listings.filter((l) => {
    const isSaved = savedIds.has(l.id);
    const isFollowing = followingIds.has(l.id);
    if (tab === "saved") return isSaved && !isFollowing;
    if (tab === "following") return isFollowing && !isSaved;
    if (tab === "both") return isSaved && isFollowing;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tài sản quan tâm</h1>
        <p className="text-muted-foreground mt-1">Quản lý tài sản đã lưu và đang theo dõi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Chưa có tài sản nào</h3>
          <p className="text-muted-foreground">Bấm biểu tượng tim trên trang danh sách để lưu tài sản</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing) => {
            const ca = listing.custom_attributes || {};
            const isSaved = savedIds.has(listing.id);
            const isFollowing = followingIds.has(listing.id);
            return (
              <div key={listing.id} className="relative">
                {/* Status badges */}
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  {isSaved && (
                    <Badge
                      className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/80"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(listing.id); }}
                    >
                      <Heart className="h-3 w-3 mr-1 fill-current" />
                      Quan tâm
                    </Badge>
                  )}
                  {isFollowing && (
                    <Badge
                      className="bg-amber-500 text-white cursor-pointer hover:bg-amber-600"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(listing.id); }}
                    >
                      <Bell className="h-3 w-3 mr-1 fill-current" />
                      Nhận TT
                    </Badge>
                  )}
                </div>
                <AuctionCard
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
                  isSaved={isSaved}
                  onToggleSave={() => toggleSave(listing.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BrokerSavedAssets;

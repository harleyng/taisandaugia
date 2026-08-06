import { useAssetActions } from "@/hooks/useAssetActions";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAddress } from "@/utils/formatters";
import { AuctionCard } from "@/components/AuctionCard";
import { getSessionStatus, type AuctionListing } from "@/hooks/useAuctionListings";
import { caNumber, caString } from "@/types/listing";
import { useAuctionOrgNames } from "@/hooks/useAuctionOrgNames";

interface SavedAssetsTabProps {
  fromNotifications?: boolean;
}

export const SavedAssetsTab = ({ fromNotifications = false }: SavedAssetsTabProps) => {
  const { savedIds, toggleSave } = useAssetActions();
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const orgNameById = useAuctionOrgNames(
    listings.map((l) => l.auction_org_id).filter(Boolean) as string[],
  );

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
        .select("*")
        .in("id", ids);
      setListings((data as AuctionListing[]) || []);
      setLoading(false);
    };
    fetchListings();
  }, [savedIds]);

  return (
    <div className="space-y-5">
      {fromNotifications && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            to="/profile?tab=notifications"
            className="hover:text-foreground transition-colors"
          >
            Thông báo
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Tài sản đang theo dõi</span>
        </nav>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tài sản đang theo dõi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bạn sẽ nhận thông báo khi có cập nhật về các tài sản này.
          </p>
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap mt-1">
          {savedIds.size} tài sản
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => {
            const ca = listing.custom_attributes || {};
            const fallbackOrgName = listing.auction_org_id ? orgNameById.get(listing.auction_org_id) : "";
            const orgName = caString(ca.org_name) || fallbackOrgName || "";
            return (
              <AuctionCard
                key={listing.id}
                id={listing.id}
                imageUrl={listing.image_url}
                title={listing.title}
                address={formatAddress(listing.address) || "Chưa cập nhật"}
                startingPrice={listing.price}
                stepPrice={caNumber(ca.bid_step ?? ca.step_price)}
                depositAmount={caNumber(ca.deposit_amount)}
                auctionDate={caString(ca.auction_date ?? ca.auction_time)}
                registrationDeadline={caString(ca.registration_deadline ?? ca.document_sale_end)}
                sessionStatus={getSessionStatus(listing)}
                categorySlug={listing.property_type_slug}
                viewMode="grid"
                winPrice={caNumber(ca.win_price ?? ca.winning_price)}
                orgName={orgName}
                orgId={listing.auction_org_id || undefined}
                isSaved
                onToggleSave={(id) => {
                  toggleSave(id);
                  setListings((prev) => prev.filter((l) => l.id !== id));
                }}
                viewsCount={listing.views_count || 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

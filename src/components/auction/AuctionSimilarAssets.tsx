import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuctionCard } from "@/components/AuctionCard";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { formatAddress } from "@/utils/formatters";

interface AuctionSimilarAssetsProps {
  listing: any;
}

export const AuctionSimilarAssets = ({ listing }: AuctionSimilarAssetsProps) => {
  const [similar, setSimilar] = useState<any[]>([]);

  useEffect(() => {
    const fetchSimilar = async () => {
      // Try same property type first
      const { data: byType } = await supabase
        .from("listings")
        .select("id, title, price, price_unit, image_url, address, area, property_type_slug, custom_attributes, created_at")
        .eq("status", "ACTIVE")
        .eq("property_type_slug", listing.property_type_slug)
        .neq("id", listing.id)
        .limit(4);

      if (byType && byType.length >= 2) {
        setSimilar(byType.slice(0, 4));
        return;
      }

      // Fallback: any active listings
      const { data: fallback } = await supabase
        .from("listings")
        .select("id, title, price, price_unit, image_url, address, area, property_type_slug, custom_attributes, created_at")
        .eq("status", "ACTIVE")
        .neq("id", listing.id)
        .limit(4);

      setSimilar([...(byType || []), ...(fallback || [])].filter(
        (item, idx, arr) => arr.findIndex(a => a.id === item.id) === idx
      ).slice(0, 4));
    };
    fetchSimilar();
  }, [listing.id, listing.property_type_slug]);

  if (similar.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">Tài sản tương tự</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {similar.map((item) => {
          const ca = item.custom_attributes || {};
          const sessionStatus = getSessionStatus(item);
          return (
            <AuctionCard
              key={item.id}
              id={item.id}
              imageUrl={item.image_url}
              title={item.title}
              address={formatAddress(item.address) || "Chưa cập nhật"}
              startingPrice={item.price}
              priceUnit={item.price_unit}
              stepPrice={ca.bid_step ?? ca.step_price}
              depositAmount={ca.deposit_amount}
              auctionDate={ca.auction_date ?? ca.auction_time}
              registrationDeadline={ca.registration_deadline ?? ca.document_sale_end}
              sessionStatus={sessionStatus}
              categorySlug={item.property_type_slug}
              viewMode="grid"
              winPrice={ca.win_price ?? ca.winning_price}
              orgName={ca.org_name}
            />
          );
        })}
      </div>
    </div>
  );
};

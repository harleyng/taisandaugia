import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionCard } from "@/components/AuctionCard";

const getShortLocation = (address: any): string => {
  if (!address) return "";
  return address.province || address.district || "";
};

export const CompletedAuctions = () => {
  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ["completed-auctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "SOLD_RENTED")
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  if (!isLoading && auctions.length === 0) return null;

  return (
    <section className="container py-6 md:py-8 px-4">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h2 className="text-lg md:text-2xl font-medium text-foreground mb-1">
            Phiên đã kết thúc
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Kết quả trúng đấu giá mới nhất
          </p>
        </div>
        <Link to="/listings">
          <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground text-sm">
            Xem tất cả
            <ArrowRight className="ml-1 h-4 w-4" strokeWidth={1.5} />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {auctions.map((item) => {
            const customAttrs = (item.custom_attributes || {}) as Record<string, any>;
            const location = getShortLocation(item.address);
            const orgName = customAttrs.org_name || "";
            const winPrice = customAttrs.win_price as number | undefined;

            return (
              <AuctionCard
                key={item.id}
                id={item.id}
                imageUrl={item.image_url}
                title={item.title}
                address={location}
                startingPrice={item.price}
                priceUnit={item.price_unit}
                sessionStatus="ended"
                categorySlug={item.property_type_slug}
                orgName={orgName}
                winPrice={winPrice}
              />
            );
          })}
        </div>
      )}

      <div className="flex justify-center mt-6 sm:hidden">
        <Link to="/listings">
          <Button variant="outline" size="sm">
            Xem tất cả
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
          </Button>
        </Link>
      </div>
    </section>
  );
};

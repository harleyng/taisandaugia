import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuctionCard } from "@/components/AuctionCard";
import { useAssetActions } from "@/hooks/useAssetActions";
import { NotificationPromptDialog } from "@/components/NotificationPromptDialog";
import auctionBg from "@/assets/auction-bg.png";

const getCountdown = (auctionTime: string): string | null => {
  const diff = new Date(auctionTime).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d${hours}h`;
};

const getShortLocation = (address: any): string => {
  if (!address) return "";
  return address.province || address.district || "";
};

export const AuctionSection = () => {
  const { savedIds, toggleSave, showNotificationPrompt, dismissNotificationPrompt } = useAssetActions();
  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ["upcoming-auctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
  });

  if (!isLoading && auctions.length === 0) return null;

  return (
    <>
    <NotificationPromptDialog open={showNotificationPrompt} onClose={dismissNotificationPrompt} />
    <section className="container px-4 py-6 md:py-8">
      <div
        className="rounded-2xl p-6 md:p-10 pb-10 md:pb-14"
        style={{
          backgroundImage: `url(${auctionBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-3xl font-medium text-white mb-1">
              Phiên sắp diễn ra
            </h2>
            <p className="text-xs md:text-sm text-white/70">
              Các bất động sản đang mở đăng ký với giá tốt nhất
            </p>
          </div>
          <Link to="/listings?purpose=auction" className="hidden sm:block">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 text-sm">
              Xem tất cả
              <ArrowRight className="ml-1 h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[360px] rounded-xl bg-white/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {auctions.map((item) => {
              const customAttrs = (item.custom_attributes || {}) as Record<string, any>;
              const countdown = customAttrs.auction_time ? getCountdown(customAttrs.auction_time) : null;
              const location = getShortLocation(item.address);
              const orgName = customAttrs.org_name || "";

              return (
                <AuctionCard
                  key={item.id}
                  id={item.id}
                  imageUrl={item.image_url}
                  title={item.title}
                  address={location}
                  startingPrice={item.price}
                  priceUnit={item.price_unit}
                  stepPrice={customAttrs.bid_step ?? customAttrs.step_price}
                  depositAmount={customAttrs.deposit_amount}
                  auctionDate={customAttrs.auction_date ?? customAttrs.auction_time}
                  registrationDeadline={customAttrs.registration_deadline ?? customAttrs.document_sale_end}
                  sessionStatus="registration_open"
                  categorySlug={item.property_type_slug}
                  variant="featured"
                  countdown={countdown}
                  orgName={orgName}
                  isSaved={savedIds.has(item.id)}
                  onToggleSave={() => toggleSave(item.id)}
                />
              );
            })}
          </div>
        )}

        <div className="flex justify-center mt-6 sm:hidden">
          <Link to="/listings?purpose=auction">
            <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10 bg-transparent">
              Xem tất cả
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
      </div>
    </section>
    </>
  );
};

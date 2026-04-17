import { Card } from "@/components/ui/card";
import { Building2, ChevronRight, BarChart3, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGuardedNavigate } from "@/hooks/useAuthGuardedNavigate";
import logoAuctionOrg from "@/assets/logo-auction-org.png";

interface AuctionOrganizerInfoProps {
  listing: any;
  isUnlocked?: boolean;
  onLockedClick?: () => void;
}

export const AuctionOrganizerInfo = ({ listing, isUnlocked = true, onLockedClick }: AuctionOrganizerInfoProps) => {
  const guardedNavigate = useAuthGuardedNavigate();
  const ca = listing.custom_attributes || {};
  const auctionOrgId = listing.auction_org_id;

  const { data: orgData } = useQuery({
    queryKey: ["auction-org", auctionOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("*")
        .eq("id", auctionOrgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!auctionOrgId,
  });

  const { data: stats } = useQuery({
    queryKey: ["auction-org-stats", auctionOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("status")
        .eq("auction_org_id", auctionOrgId)
        .in("status", ["ACTIVE", "SOLD_RENTED"]);
      if (error) throw error;
      const total = data?.length || 0;
      const success = data?.filter((l) => l.status === "SOLD_RENTED").length || 0;
      const rate = total > 0 ? Math.round((success / total) * 100) : 0;
      return { total, success, rate };
    },
    enabled: !!auctionOrgId,
  });

  const orgName = orgData?.name || ca.org_name;
  const orgAddress = orgData?.address || ca.org_address;
  const orgPhone = orgData?.phone || ca.org_phone;
  const orgEmail = orgData?.email || ca.org_email;
  const orgLogo = orgData?.logo_url || logoAuctionOrg;
  const auctionLocation = ca.auction_location;

  const hasOrgInfo = orgName || orgAddress || orgPhone || orgEmail || auctionLocation;

  if (!hasOrgInfo) return null;

  const isClickable = !!auctionOrgId;

  const handleClick = isClickable
    ? guardedNavigate(`/auction-org/${auctionOrgId}`, {
        state: { fromListing: { id: listing.id, title: listing.title } },
      })
    : undefined;

  const contactLine = [orgPhone, orgEmail].filter(Boolean).join("  -  ");
  const locationText = auctionLocation || orgAddress;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Đơn vị tổ chức đấu giá</h3>
      </div>

      {/* Highlighted org sub-card (clickable) */}
      {orgName && (
        <div
          onClick={handleClick}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={(e) => {
            if (isClickable && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              handleClick?.(e as any);
            }
          }}
          className={`rounded-lg border border-secondary/40 bg-secondary/30 p-4 ${
            isClickable
              ? "cursor-pointer transition-all hover:border-primary/50 hover:bg-secondary/50 hover:shadow-md"
              : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <img
              src={orgLogo}
              alt={orgName}
              loading="lazy"
              width={56}
              height={56}
              className="w-14 h-14 rounded-lg object-contain bg-background border border-border shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground leading-snug">{orgName}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                {auctionOrgId && stats && stats.total > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{stats.total}</span> phiên đấu giá
                  </span>
                )}
                {auctionOrgId && stats && stats.total > 0 && orgAddress && (
                  <span aria-hidden="true">•</span>
                )}
                {orgAddress && (
                  <span className="inline-flex items-center gap-1 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="line-clamp-1">{orgAddress}</span>
                  </span>
                )}
              </div>
            </div>
            {isClickable && (
              <div className="hidden sm:flex items-center gap-1 text-sm font-medium text-primary group shrink-0 self-center">
                <span className="group-hover:underline whitespace-nowrap">Xem lịch sử đấu giá</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>

          {isClickable && (
            <div className="sm:hidden mt-3 flex items-center gap-1 text-sm font-medium text-primary group">
              <span className="group-hover:underline">Xem lịch sử đấu giá</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </div>
      )}

      {/* Contact info & auction location — key/value layout */}
      {(contactLine || locationText) && (
        <div className="space-y-3 text-sm">
          {contactLine && (
            <div className="flex gap-3">
              <span className="text-muted-foreground shrink-0 w-28">Thông tin liên hệ:</span>
              {isUnlocked ? (
                <span className="text-foreground">{contactLine}</span>
              ) : (
                <button
                  type="button"
                  onClick={onLockedClick}
                  className="text-foreground inline-flex items-center gap-1.5 group"
                >
                  <span className="blur-sm select-none">{contactLine}</span>
                  <span className="text-xs text-primary font-medium group-hover:underline">🔒 Mở khóa</span>
                </button>
              )}
            </div>
          )}
          {locationText && (
            <div className="flex gap-3">
              <span className="text-muted-foreground shrink-0 w-28">Địa điểm đấu giá:</span>
              {isUnlocked ? (
                <span className="text-foreground">{locationText}</span>
              ) : (
                <button
                  type="button"
                  onClick={onLockedClick}
                  className="text-foreground inline-flex items-center gap-1.5 group text-left"
                >
                  <span className="blur-sm select-none line-clamp-1">{locationText}</span>
                  <span className="text-xs text-primary font-medium group-hover:underline shrink-0">🔒</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

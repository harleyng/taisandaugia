import { Card } from "@/components/ui/card";
import { Building2, ChevronRight, BarChart3, Phone, Mail, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAuctionOrg from "@/assets/logo-auction-org.png";

interface AuctionOrganizerInfoProps {
  listing: any;
}

export const AuctionOrganizerInfo = ({ listing }: AuctionOrganizerInfoProps) => {
  const navigate = useNavigate();
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
  // Mock "operating since" — fallback to a sensible default
  const operatingSince = ca.org_operating_since || "2015";

  const hasOrgInfo = orgName || orgAddress || orgPhone || orgEmail || auctionLocation;

  if (!hasOrgInfo) return null;

  const isClickable = !!auctionOrgId;

  const handleClick = () => {
    if (isClickable) navigate(`/auction-org/${auctionOrgId}`);
  };

  return (
    <Card
      onClick={handleClick}
      className={`p-5 space-y-4 ${
        isClickable
          ? "cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
          : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Đơn vị tổ chức đấu giá</h3>
      </div>

      {/* Logo + Name + Description + Stats */}
      {orgName && (
        <div className="flex items-start gap-3">
          <img
            src={orgLogo}
            alt={orgName}
            loading="lazy"
            width={56}
            height={56}
            className="w-14 h-14 rounded-lg object-contain bg-muted/30 border border-border shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground leading-snug">{orgName}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
              <span>Hoạt động từ {operatingSince}</span>
              {auctionOrgId && stats && stats.total > 0 && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{stats.total}</span> phiên đấu giá
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact + location */}
      <div className="space-y-2">
        {(orgPhone || orgEmail) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-foreground">
            {orgPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{orgPhone}</span>
              </div>
            )}
            {orgPhone && orgEmail && (
              <span aria-hidden="true" className="text-muted-foreground">•</span>
            )}
            {orgEmail && (
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{orgEmail}</span>
              </div>
            )}
          </div>
        )}
        {(auctionLocation || orgAddress) && (
          <div className="flex items-start gap-2 text-sm text-foreground">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span>{auctionLocation || orgAddress}</span>
          </div>
        )}
      </div>

      {/* CTA as text link */}
      {isClickable && (
        <div className="pt-1 flex items-center gap-1 text-sm font-medium text-primary group">
          <span className="group-hover:underline">Xem lịch sử đấu giá</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </Card>
  );
};

import { Card } from "@/components/ui/card";
import { Building2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuctionOrganizerInfoProps {
  listing: any;
}

export const AuctionOrganizerInfo = ({ listing }: AuctionOrganizerInfoProps) => {
  const ca = listing.custom_attributes || {};
  const auctionOrgId = listing.auction_org_id;

  // Fetch org info from auction_organizations table when available
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

  // Merge: prefer DB data, fallback to custom_attributes
  const orgName = orgData?.name || ca.org_name;
  const orgAddress = orgData?.address || ca.org_address;
  const orgPhone = orgData?.phone || ca.org_phone;
  const orgEmail = orgData?.email || ca.org_email;
  const auctionLocation = ca.auction_location;

  const hasOrgInfo = orgName || orgAddress || orgPhone || orgEmail || auctionLocation;

  if (!hasOrgInfo) return null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Đơn vị tổ chức đấu giá</h3>
      </div>

      <div className="space-y-3">
        {orgName && (
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground shrink-0 w-[100px]">Đơn vị đấu giá:</span>
            <span className="text-sm text-foreground">
              {orgName}
              {orgAddress && ` - ${orgAddress}`}
            </span>
          </div>
        )}

        {(orgPhone || orgEmail) && (
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground shrink-0 w-[100px]">Thông tin liên hệ:</span>
            <div className="text-sm text-foreground flex flex-wrap gap-x-2">
              {orgPhone && <span>{orgPhone}</span>}
              {orgPhone && orgEmail && <span>-</span>}
              {orgEmail && <span>{orgEmail}</span>}
            </div>
          </div>
        )}

        {(auctionLocation || orgAddress) && (
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground shrink-0 w-[100px]">Địa điểm đấu giá:</span>
            <span className="text-sm text-foreground">{auctionLocation || orgAddress}</span>
          </div>
        )}
      </div>

      {/* CTA */}
      {auctionOrgId && (
        <Link
          to={`/auction-org/${auctionOrgId}`}
          className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 transition-all group"
        >
          <span className="text-sm font-semibold">
            Khám phá tài sản từ đơn vị này
          </span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </Card>
  );
};

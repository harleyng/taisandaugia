import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ChevronRight, BarChart3 } from "lucide-react";
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

  // Fetch auction stats for this org
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

      {orgName && (
        <p className="text-sm text-foreground font-medium">
          {orgName}
          {orgAddress && <span className="text-muted-foreground font-normal"> - {orgAddress}</span>}
        </p>
      )}

      {/* Stats + CTA row */}
      {auctionOrgId && stats && stats.total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-primary shrink-0" />
            <span className="text-foreground">
              <span className="font-semibold">{stats.total}</span> phiên đấu giá
              <span className="text-muted-foreground"> • </span>
              <span className="font-semibold">{stats.success}</span> thành công
              <span className="text-primary font-semibold"> ({stats.rate}%)</span>
            </span>
          </div>
          <Link to={`/auction-org/${auctionOrgId}`} className="shrink-0">
            <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary hover:shadow-md transition-all group">
              <span>Xem lịch sử đấu giá</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      )}

      <div className="space-y-3">
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
    </Card>
  );
};

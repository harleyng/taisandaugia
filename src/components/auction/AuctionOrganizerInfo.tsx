import { Card } from "@/components/ui/card";
import { Building2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface AuctionOrganizerInfoProps {
  listing: any;
}

export const AuctionOrganizerInfo = ({ listing }: AuctionOrganizerInfoProps) => {
  const ca = listing.custom_attributes || {};
  const auctionOrgId = listing.auction_org_id;
  
  const hasOrgInfo = ca.org_name || ca.org_address || ca.org_phone || ca.org_email || ca.auction_location;
  
  if (!hasOrgInfo) return null;

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Đơn vị tổ chức đấu giá</h3>
      </div>

      <div className="space-y-3">
        {ca.org_name && (
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground shrink-0 w-[100px]">Đơn vị đấu giá:</span>
            <span className="text-sm text-foreground">
              {ca.org_name}
              {ca.org_address && ` - ${ca.org_address}`}
            </span>
          </div>
        )}

        {(ca.org_phone || ca.org_email) && (
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground shrink-0 w-[100px]">Thông tin liên hệ:</span>
            <div className="text-sm text-foreground flex flex-wrap gap-x-2">
              {ca.org_phone && <span>{ca.org_phone}</span>}
              {ca.org_phone && ca.org_email && <span>-</span>}
              {ca.org_email && <span>{ca.org_email}</span>}
            </div>
          </div>
        )}

        {(ca.auction_location || ca.org_address) && (
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground shrink-0 w-[100px]">Địa điểm đấu giá:</span>
            <span className="text-sm text-foreground">{ca.auction_location || ca.org_address}</span>
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

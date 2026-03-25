import { Badge } from "@/components/ui/badge";
import { ListingStatus } from "@/types/listing.types";
import { LISTING_STATUSES } from "@/constants/listing.constants";

interface StatusBadgeProps {
  status: ListingStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const variantMap: Record<ListingStatus, "default" | "secondary" | "destructive" | "outline"> = {
    DRAFT: "outline",
    PENDING_APPROVAL: "secondary",
    ACTIVE: "default",
    REJECTED: "destructive",
    SOLD: "outline",
    RENTED: "outline",
  };

  return (
    <Badge variant={variantMap[status]}>
      {LISTING_STATUSES[status]}
    </Badge>
  );
};

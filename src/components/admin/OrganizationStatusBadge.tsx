import { Badge } from "@/components/ui/badge";
import { OrganizationKycStatus } from "@/types/organization.types";
import { ORG_KYC_STATUSES } from "@/constants/organization.constants";

interface OrganizationStatusBadgeProps {
  status: OrganizationKycStatus;
}

export const OrganizationStatusBadge = ({ status }: OrganizationStatusBadgeProps) => {
  const getVariant = () => {
    switch (status) {
      case "APPROVED":
        return "default";
      case "PENDING_KYC":
        return "secondary";
      case "REJECTED":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Badge variant={getVariant()}>
      {ORG_KYC_STATUSES[status]}
    </Badge>
  );
};

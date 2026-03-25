import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/types/user.types";
import { USER_ROLES } from "@/constants/kyc.constants";

interface UserRoleBadgeProps {
  role: UserRole;
}

export const UserRoleBadge = ({ role }: UserRoleBadgeProps) => {
  const variantMap: Record<UserRole, "default" | "secondary" | "outline"> = {
    USER: "outline",
    BROKER: "secondary",
    ADMIN: "default",
  };

  return (
    <Badge variant={variantMap[role]}>
      {USER_ROLES[role]}
    </Badge>
  );
};

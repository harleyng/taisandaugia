import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DEPOSIT_STATUS_LABELS, type DepositStatus } from "@/types/bidding-contract";

const VARIANT: Record<DepositStatus, BadgeProps["variant"]> = {
  pending: "outline",
  received: "default",
  refunded: "secondary",
  forfeited: "destructive",
};

export function DepositStatusBadge({ status, className }: { status: DepositStatus; className?: string }) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {DEPOSIT_STATUS_LABELS[status]}
    </Badge>
  );
}

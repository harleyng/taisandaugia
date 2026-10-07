import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REVIEW_STATUS_LABELS, type ReviewStatus } from "@/types/bidding-contract";

const VARIANT: Record<ReviewStatus, BadgeProps["variant"]> = {
  pending: "outline",
  needs_info: "outline",
  approved: "default",
  rejected: "destructive",
};

/** Kết quả tổ chức duyệt hồ sơ — dùng chung cho người mua và tổ chức. */
export function ReviewStatusBadge({ status, className }: { status: ReviewStatus; className?: string }) {
  return (
    <Badge
      variant={VARIANT[status]}
      className={cn(status === "needs_info" && "border-warning text-warning", className)}
    >
      {REVIEW_STATUS_LABELS[status]}
    </Badge>
  );
}

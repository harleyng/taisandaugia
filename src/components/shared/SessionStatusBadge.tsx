import { Badge } from "@/components/ui/badge";
import type { AuctionSessionStatus } from "@/components/AuctionCard";

const STATUS_CONFIG: Record<AuctionSessionStatus, { label: string; className: string }> = {
  registration_open: {
    label: "Mở đăng ký",
    className: "bg-[hsl(142,60%,40%)] text-white hover:bg-[hsl(142,60%,40%)]",
  },
  upcoming: {
    label: "Sắp diễn ra",
    className: "bg-[hsl(25,95%,53%)] text-white hover:bg-[hsl(25,95%,53%)]",
  },
  ongoing: {
    label: "Đang diễn ra",
    className: "bg-[hsl(205,65%,45%)] text-white hover:bg-[hsl(205,65%,45%)] animate-pulse",
  },
  ended: {
    label: "Đã kết thúc",
    className: "bg-muted-foreground text-white hover:bg-muted-foreground",
  },
};

interface SessionStatusBadgeProps {
  status: AuctionSessionStatus;
  className?: string;
}

export function SessionStatusBadge({ status, className }: SessionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge className={`${config.className}${className ? ` ${className}` : ""}`}>
      {config.label}
    </Badge>
  );
}

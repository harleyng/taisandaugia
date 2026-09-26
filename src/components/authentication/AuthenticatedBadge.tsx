import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Huy hiệu "Đã giám định" cho lô / hồ sơ có chứng thư "xác thực" hiện hành. */
export function AuthenticatedBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={`gap-1 bg-success/10 text-success hover:bg-success/10 ${className ?? ""}`}
      title="Có chứng thư giám định xác thực"
    >
      <BadgeCheck className="h-3 w-3" />
      Đã giám định
    </Badge>
  );
}

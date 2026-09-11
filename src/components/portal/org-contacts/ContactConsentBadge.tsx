import { Badge } from "@/components/ui/badge";
import type { OrgContactStatus } from "@/types/org-contacts";

/** Trạng thái nhận tin — quyết định khách có là người nhận hợp lệ khi tiếp thị phiên. */
export function ContactConsentBadge({ enabled, status }: { enabled: boolean; status: OrgContactStatus }) {
  if (status === "inactive") {
    return (
      <Badge variant="outline" className="whitespace-nowrap text-muted-foreground">
        Ngừng theo dõi
      </Badge>
    );
  }
  return enabled ? (
    <Badge variant="outline" className="whitespace-nowrap border-success/30 bg-success/10 text-success">
      Đồng ý nhận tin
    </Badge>
  ) : (
    <Badge variant="outline" className="whitespace-nowrap border-warning/40 bg-warning/10 text-warning">
      Chưa đồng ý
    </Badge>
  );
}

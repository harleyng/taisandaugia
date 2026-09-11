import { Building2, MapPin, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SERVICE_REQUEST_STATUS_LABELS } from "@/types/asset-posting";
import type { RequestOrg, RequestWithOrg } from "@/hooks/useAssetPosting";

/** Logo + tên + tỉnh + điện thoại của tổ chức đấu giá. */
export function OrgIdentity({ org }: { org: RequestOrg }) {
  return (
    <div className="flex items-center gap-3">
      {org.logo_url ? (
        <img src={org.logo_url} alt={org.name} className="h-11 w-11 rounded-lg object-cover" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-background">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{org.name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {org.province && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {org.province}
            </span>
          )}
          {org.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {org.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tổ chức đã chốt khi CHƯA có hợp đồng trên sàn (yêu cầu cũ 'accepted' / tổ
 * chức chưa có tài khoản). Có hợp đồng thì OwnerContractPanel thay chỗ này.
 */
export function ChosenOrgCard({ org, request }: { org: RequestOrg; request: RequestWithOrg | null }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-3 pt-5">
        <OrgIdentity org={org} />
        {request && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge variant="secondary" className="font-normal">
                {SERVICE_REQUEST_STATUS_LABELS[request.status]}
              </Badge>
            </div>
            {request.message && (
              <p className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                “{request.message}”
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

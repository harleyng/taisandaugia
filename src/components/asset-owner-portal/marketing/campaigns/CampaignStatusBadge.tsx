import { CAMPAIGN_STATUS_META, type CampaignStatus } from "@/lib/ownerMarketing/campaigns";
import type { OwnerTone } from "@/components/asset-owner-portal/ui/IconTile";
import { cn } from "@/lib/utils";

const TONE: Record<OwnerTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-foreground",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

/** Viên trạng thái chiến dịch — màu chỉ nằm ở viên (§A8.4). */
export function CampaignStatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  const meta = CAMPAIGN_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

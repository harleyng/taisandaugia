import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { CampaignActions } from "./CampaignActions";
import type { Campaign } from "@/types/marketing";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--/--/----";

interface Props {
  campaign: Campaign;
  onView: () => void;
}

export function CampaignRow({ campaign, onView }: Props) {
  const displayTime =
    campaign.status === "sent"
      ? campaign.sent_at
      : campaign.schedule_type === "scheduled"
        ? campaign.scheduled_at
        : null;

  return (
    <tr
      onClick={onView}
      className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-xs text-primary group-hover:underline">
          #{campaign.id.slice(0, 8).toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3 min-w-0 max-w-xs">
        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:underline">
          {campaign.name}
        </p>
        {campaign.subject && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{campaign.subject}</p>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
        {fmt(displayTime)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
        {campaign.recipient_count > 0 ? campaign.recipient_count.toLocaleString("vi-VN") : "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <CampaignStatusBadge status={campaign.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <CampaignActions campaign={campaign} layout="menu" />
      </td>
    </tr>
  );
}

import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABELS } from "@/lib/caseQa/labels";
import type { ChatChannel } from "@/types/case-qa";

export function ChannelBadge({ channel, simulated }: { channel: ChatChannel; simulated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {channel === "zalo" ? (
        <Badge variant="secondary" className="text-[11px]">
          {CHANNEL_LABELS.zalo}
        </Badge>
      ) : (
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[11px] text-primary">
          {CHANNEL_LABELS.marketplace}
        </Badge>
      )}
      {simulated && (
        <Badge variant="outline" className="text-[11px] text-muted-foreground">
          Giả lập
        </Badge>
      )}
    </span>
  );
}

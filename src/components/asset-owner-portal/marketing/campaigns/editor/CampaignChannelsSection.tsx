import { Checkbox } from "@/components/ui/checkbox";
import { CAMPAIGN_CHANNELS, CAMPAIGN_CHANNEL_META, type CampaignChannel } from "@/lib/ownerMarketing/campaigns";
import { cn } from "@/lib/utils";

interface CampaignChannelsSectionProps {
  selected: CampaignChannel[];
  onChange: (channels: CampaignChannel[]) => void;
  disabled?: boolean;
}

/** Kênh RIÊNG của đơn vị — sàn không gửi gì, chỉ dựng nội dung + link Hồ sơ online. */
export function CampaignChannelsSection({ selected, onChange, disabled }: CampaignChannelsSectionProps) {
  const toggle = (c: CampaignChannel, on: boolean) =>
    onChange(CAMPAIGN_CHANNELS.filter((x) => (x === c ? on : selected.includes(x))));

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {CAMPAIGN_CHANNELS.map((c) => {
          const meta = CAMPAIGN_CHANNEL_META[c];
          const Icon = meta.icon;
          const on = selected.includes(c);
          return (
            <label
              key={c}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox className="mt-0.5" checked={on} disabled={disabled} onCheckedChange={(v) => toggle(c, v === true)} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                  {meta.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Đơn vị tự gửi qua kênh của mình — danh sách khách của đơn vị không rời khỏi đơn vị. Sàn chỉ đếm lượt mở link.
      </p>
    </div>
  );
}

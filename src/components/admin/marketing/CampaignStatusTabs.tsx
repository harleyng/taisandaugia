import { cn } from "@/lib/utils";
import { STATUS_TABS } from "@/lib/marketing/campaignStatus";
import type { CampaignStatus } from "@/types/marketing";

interface Props {
  active: CampaignStatus | "all";
  counts: Record<string, number>;
  onChange: (key: CampaignStatus | "all") => void;
}

export function CampaignStatusTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = counts[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex min-w-5 justify-center rounded px-1 text-xs font-semibold",
                isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/10",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

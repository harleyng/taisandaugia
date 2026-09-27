import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { PHASE_FILL, type AssetTab, type AssetTabDef } from "./assetsUi";

interface AssetTabsProps {
  tabs: AssetTabDef[];
  value: AssetTab;
  counts: Record<AssetTab, number>;
  onChange: (tab: AssetTab) => void;
}

export function AssetTabs({ tabs, value, counts, onChange }: AssetTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Nhóm tài sản"
      className="-mx-5 flex flex-wrap gap-1 border-b border-border px-5"
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <Fragment key={t.id}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-2 text-[13.5px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                active && (t.highlight ? "border-warning" : "border-foreground"),
                t.highlight && !active && "rounded-t-lg bg-warning/10 text-foreground",
              )}
            >
              {t.phase && <i className={cn("h-2 w-2 rounded-full", PHASE_FILL[t.phase])} aria-hidden="true" />}
              {t.label}
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  t.highlight ? "rounded-full bg-warning px-1.5 text-foreground" : "text-muted-foreground",
                )}
              >
                {counts[t.id]}
              </span>
            </button>
            {t.divider && <span className="my-2 mx-1 w-px bg-border" aria-hidden="true" />}
          </Fragment>
        );
      })}
    </div>
  );
}

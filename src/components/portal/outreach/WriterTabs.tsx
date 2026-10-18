import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { CHANNEL_META, type OutreachChannel } from "@/lib/outreach/channels";
import { cn } from "@/lib/utils";
import { Mono } from "./ui";

export type BadgeKind = "none" | "shared" | "ok" | "own" | "busy";

const BADGE: Record<BadgeKind, string> = {
  none: "bg-muted text-muted-foreground",
  shared: "bg-muted text-muted-foreground",
  ok: "bg-primary/10 text-primary",
  own: "bg-primary/10 text-primary",
  busy: "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]",
};

function Badge({ kind, on, children }: { kind: BadgeKind; on: boolean; children: ReactNode }) {
  return (
    <em
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full px-2 py-0.5 text-[11.5px] font-semibold not-italic",
        BADGE[kind],
        on && (kind === "none" || kind === "shared") && "bg-card",
      )}
    >
      {kind === "busy" && <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </em>
  );
}

function Tab({ on, onClick, mono, label, badge }: { on: boolean; onClick: () => void; mono: ReactNode; label: string; badge: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[38px] shrink-0 items-center gap-2 whitespace-nowrap rounded-[9px] pl-2 pr-3.5 text-sm font-semibold",
        on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {mono}
      {label}
      {badge}
    </button>
  );
}

const SMALL_MONO = "[&>span]:h-6 [&>span]:w-6 [&>span]:rounded-[7px] [&>span]:text-[10px]";

/** Hàng "Viết cho" (design pdg-mvp3.js `.m3-sw` / `.m3-tabs`). */
export function WriterTabs({
  channels,
  sel,
  onSelect,
  sharedBadge,
  channelBadge,
}: {
  channels: OutreachChannel[];
  sel: string;
  onSelect: (key: string) => void;
  sharedBadge: [BadgeKind, string];
  channelBadge: (c: OutreachChannel) => [BadgeKind, string];
}) {
  return (
    <div className="-mb-1 flex flex-wrap items-center gap-3">
      <b className="text-[13px] font-semibold text-muted-foreground">Viết cho</b>
      <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-card p-1 shadow-card">
        <Tab
          on={sel === "chung"}
          onClick={() => onSelect("chung")}
          mono={
            <span className={SMALL_MONO}>
              <Mono tone="pri" size="sm">
                <FileText />
              </Mono>
            </span>
          }
          label="Bài chung"
          badge={
            <Badge kind={sharedBadge[0]} on={sel === "chung"}>
              {sharedBadge[1]}
            </Badge>
          }
        />
        {channels.map((c) => {
          const meta = CHANNEL_META[c.kind];
          const [kind, text] = channelBadge(c);
          return (
            <Tab
              key={c.id}
              on={sel === c.id}
              onClick={() => onSelect(c.id)}
              mono={
                <span className={SMALL_MONO}>
                  <Mono tone={meta.tone} size="sm">
                    {meta.mono}
                  </Mono>
                </span>
              }
              label={c.name}
              badge={
                <Badge kind={kind} on={sel === c.id}>
                  {text}
                </Badge>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

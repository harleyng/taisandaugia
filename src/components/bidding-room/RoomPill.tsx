import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LotPhase } from "@/lib/bidding/lotPhase";

/** Nhãn tròn của phòng đấu giá (design `.pill`). */

export type RoomPillTone = "live" | "pause" | "mute" | "red" | "ext" | "onair";

const TONE: Record<RoomPillTone, string> = {
  live: "bg-success/10 text-success",
  pause: "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-strong))]",
  mute: "bg-muted text-muted-foreground",
  red: "bg-destructive/10 text-destructive",
  ext: "bg-accent/20 text-[hsl(var(--tier-warn-fg))]",
  onair: "bg-destructive/10 text-destructive",
};

export function RoomPill({
  tone,
  children,
  className,
}: {
  tone: RoomPillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold",
        TONE[tone],
        className,
      )}
    >
      {tone === "live" && <span className="h-1.5 w-1.5 shrink-0 animate-room-blink rounded-full bg-current" />}
      {tone === "onair" && <span className="h-[7px] w-[7px] shrink-0 animate-room-onair rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Nhãn giai đoạn lô + "Gia hạn ×N". `withExtension=false` ở cột tài sản (design bỏ nhãn gia hạn ở đó). */
export function LotPhasePills({
  phase,
  extensionCount = 0,
  withExtension = true,
  className,
}: {
  phase: LotPhase;
  extensionCount?: number;
  withExtension?: boolean;
  className?: string;
}) {
  const main =
    phase === "open" || phase === "extended" ? (
      <RoomPill tone="live" className={className}>
        Đang trả giá
      </RoomPill>
    ) : phase === "paused" ? (
      <RoomPill tone="pause" className={className}>
        Tạm dừng
      </RoomPill>
    ) : phase === "tied" ? (
      <RoomPill tone="pause" className={className}>
        Bằng giá
      </RoomPill>
    ) : phase === "withdrawn" ? (
      <RoomPill tone="red" className={className}>
        Đã rút
      </RoomPill>
    ) : (
      <RoomPill tone="mute" className={className}>
        {phase === "pending" ? "Chưa mở" : "Đã đóng"}
      </RoomPill>
    );

  return (
    <>
      {main}
      {withExtension && extensionCount > 0 && (
        <RoomPill tone="ext" className={className}>
          Gia hạn ×{extensionCount}
        </RoomPill>
      )}
    </>
  );
}

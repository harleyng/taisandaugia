import { Clock, DoorClosed, DoorOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useServerNow } from "@/hooks/useServerClock";
import { formatCountdown } from "@/lib/bidding/countdown";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import {
  CHECKIN_CHANNEL_LABELS,
  checkinChannelOf,
  checkinWindowOf,
  checkinWindowPhase,
} from "@/lib/biddingContracts/checkinWindow";
import { cn } from "@/lib/utils";
import type { AuctionSession } from "@/types/auction-session";
import type { CheckinSummary } from "@/types/bidding-contract";

interface Props {
  session: AuctionSession;
  summary: CheckinSummary | null | undefined;
}

/**
 * Giờ mở / đóng điểm danh + đếm ngược theo GIỜ MÁY CHỦ (cửa sổ do server xét,
 * máy nhân viên lệch giờ thì đếm ngược lệch theo). Số đếm nằm ở RosterSummaryCard;
 * summary ở đây chỉ để biết mốc chốt mới nhất (cron chốt mà session chưa tải lại).
 */
export function CheckinWindowBanner({ session, summary }: Props) {
  const now = useServerNow(1000);
  const { opensAt, closesAt } = checkinWindowOf(session);
  const closedAt = summary?.roster_closed_at ?? session.roster_closed_at;
  const closed = !!closedAt;
  const phase = closed ? "closed" : checkinWindowPhase(session, now);
  const channel = checkinChannelOf(session.auction_format);

  const countdown =
    phase === "before"
      ? formatCountdown(opensAt.getTime() - now.getTime())
      : phase === "open"
        ? formatCountdown(closesAt.getTime() - now.getTime())
        : null;

  const Icon = phase === "open" ? DoorOpen : phase === "before" ? Clock : DoorClosed;

  return (
    <Card
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5",
        phase === "open" && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            phase === "open" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">
              {closed
                ? "Đã chốt danh sách điểm danh"
                : phase === "open"
                  ? "Đang mở điểm danh"
                  : phase === "before"
                    ? "Chưa mở điểm danh"
                    : "Đã hết giờ điểm danh"}
            </p>
            {countdown && (
              <Badge variant={phase === "open" ? "default" : "outline"} className="font-mono">
                {phase === "open" ? "Đóng sau " : "Mở sau "}
                {countdown.text.replace(/^còn /, "")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {closed
              ? `Chốt lúc ${formatDateTime(closedAt)}.`
              : `Mở ${formatDateTime(opensAt.toISOString())} — đóng ${formatDateTime(closesAt.toISOString())}.`}
          </p>
          {channel && <p className="text-xs text-muted-foreground">{CHECKIN_CHANNEL_LABELS[channel]}</p>}
        </div>
      </div>
    </Card>
  );
}

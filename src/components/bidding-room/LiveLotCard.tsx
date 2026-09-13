import { Gavel, PauseCircle, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { formatCountdown, type CountdownUrgency } from "@/lib/bidding/countdown";
import { lotPhaseOf, remainingMs } from "@/lib/bidding/lotPhase";
import { LOT_RESULT_LABELS, type LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import { LotPhaseBadge } from "./LotPhaseBadge";

/** Lô đang xem: giá hiện tại, người dẫn đầu, đồng hồ. */

const URGENCY_CLASS: Record<CountdownUrgency, string> = {
  normal: "text-foreground",
  soon: "text-warning",
  urgent: "text-destructive",
};

interface Props {
  lot: AuctionSessionItem;
  state: LotState | null;
  now: Date;
  clockReady: boolean;
  myBidderNo: number;
}

export function LiveLotCard({ lot, state, now, clockReady, myBidderNo }: Props) {
  const phase = lotPhaseOf(state, now);
  const paused = phase === "paused";
  const leadingIsMe = state?.leading_bidder_no != null && state.leading_bidder_no === myBidderNo;

  // Khi tạm dừng, org_resume_lot sẽ cộng bù khoảng dừng vào ends_at, nên ends_at
  // hiện tại đã CŨ — chạy đồng hồ lúc này là nói dối người trả giá.
  const countdown = paused || !clockReady ? null : formatCountdown(remainingMs(state, now));

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Lô {lot.lot_no}</p>
          <h1 className="text-lg font-bold text-foreground">{lot.title}</h1>
        </div>
        <LotPhaseBadge phase={phase} extensionCount={state?.extension_count ?? 0} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">
            {state?.current_price == null ? "Giá khởi điểm" : "Giá cao nhất hiện tại"}
          </p>
          <p className="text-2xl font-bold text-primary">{formatVnd(state?.current_price ?? lot.starting_price)}</p>
          {state?.leading_bidder_no != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Số báo danh {formatBidderNo(state.leading_bidder_no)}
              {leadingIsMe && <span className="ml-1 font-semibold text-success">(Bạn)</span>}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-muted p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            {paused ? "Thời gian" : "Thời gian còn lại"}
          </p>
          {paused ? (
            <p className="text-sm font-semibold text-warning">Đang tạm dừng — thời gian được giữ nguyên</p>
          ) : countdown ? (
            <>
              <p className={cn("text-2xl font-bold tabular-nums", URGENCY_CLASS[countdown.urgency])}>
                {countdown.text}
              </p>
              {countdown.showAbsolute && state?.ends_at && (
                <p className="mt-1 text-xs text-muted-foreground">Đóng lúc {formatDateTime(state.ends_at)}</p>
              )}
            </>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          Bước giá: <strong className="text-foreground">{formatVnd(lot.bid_step)}</strong>
        </span>
        <span>
          Tiền đặt trước: <strong className="text-foreground">{formatVnd(lot.deposit_amount)}</strong>
        </span>
        <span>
          Số lượt trả giá: <strong className="text-foreground">{state?.bid_count ?? 0}</strong>
        </span>
      </div>

      {paused && state?.pause_reason && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-foreground">
            <strong>Đấu giá viên tạm dừng lô này.</strong> {state.pause_reason}
          </p>
        </div>
      )}

      {phase === "withdrawn" && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-foreground">
          <strong>Lô đã bị rút khỏi phiên.</strong>
          {state?.withdraw_reason ? ` ${state.withdraw_reason}` : ""}
        </div>
      )}

      {phase === "closed" && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-sm">
          <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-foreground">
            <strong>Lô đã đóng.</strong>{" "}
            {state?.result
              ? state.result === "sold"
                ? `${LOT_RESULT_LABELS.sold} — giá trúng ${formatVnd(state.winning_amount)}, số báo danh ${formatBidderNo(state.leading_bidder_no)}.`
                : `${LOT_RESULT_LABELS.unsold} — không có lượt trả giá hợp lệ.`
              : "Đang chờ hệ thống chốt kết quả."}
          </p>
        </div>
      )}
    </Card>
  );
}

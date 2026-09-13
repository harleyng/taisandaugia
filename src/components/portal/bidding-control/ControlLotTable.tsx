import { Pause, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { formatCountdown, type CountdownUrgency } from "@/lib/bidding/countdown";
import { lotActionsFor, type LotActions, type OperateWindow } from "@/lib/bidding/controlAccess";
import { lotPhaseOf, remainingMs } from "@/lib/bidding/lotPhase";
import { LotPhaseBadge } from "@/components/bidding-room/LotPhaseBadge";
import { LOT_RESULT_LABELS, type LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Bảng lô của màn điều hành. Thuần trình bày: mọi quyết định bật/tắt nút đến từ
 * lotActionsFor(), mọi hộp thoại do component cha giữ.
 *
 * Cột thao tác KHÔNG render khi thiếu quyền `operate` — cùng nếp với readOnly
 * của SessionItemsCard, thay vì bày một hàng nút xám.
 */

const URGENCY_CLASS: Record<CountdownUrgency, string> = {
  normal: "text-foreground",
  soon: "text-warning",
  urgent: "text-destructive",
};

interface Props {
  lots: AuctionSessionItem[];
  stateByLot: Map<string, LotState>;
  now: Date;
  clockReady: boolean;
  canOperate: boolean;
  window: OperateWindow;
  selectedLotId: string | null;
  /** Lô đang có mutation chạy dở — tắt nút của đúng hàng đó. */
  pendingLotId: string | null;
  onSelect: (lot: AuctionSessionItem) => void;
  onOpen: (lot: AuctionSessionItem) => void;
  onPause: (lot: AuctionSessionItem) => void;
  onResume: (lot: AuctionSessionItem) => void;
  onWithdraw: (lot: AuctionSessionItem) => void;
}

function LotClock({ state, now, clockReady }: { state: LotState | null; now: Date; clockReady: boolean }) {
  // Khi tạm dừng, ends_at chưa được cộng bù nên đang CŨ — chạy đồng hồ lúc này
  // là hiện một con số sai. Giống hệt cách LiveLotCard xử lý ở phòng người mua.
  if (state?.status === "paused") {
    return <span className="text-xs font-medium text-warning">Giữ nguyên khi tạm dừng</span>;
  }
  const countdown = clockReady ? formatCountdown(remainingMs(state, now)) : null;
  if (!countdown) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="space-y-0.5">
      <span className={cn("block font-semibold tabular-nums", URGENCY_CLASS[countdown.urgency])}>
        {countdown.text}
      </span>
      {countdown.showAbsolute && state?.ends_at && (
        <span className="block text-xs text-muted-foreground">Đóng lúc {formatDateTime(state.ends_at)}</span>
      )}
    </span>
  );
}

function ActionButtons({
  actions,
  busy,
  onOpen,
  onPause,
  onResume,
  onWithdraw,
}: {
  actions: LotActions;
  busy: boolean;
  onOpen: () => void;
  onPause: () => void;
  onResume: () => void;
  onWithdraw: () => void;
}) {
  const items = [
    { key: "open", action: actions.open, label: "Mở lô", icon: Play, onClick: onOpen, variant: "default" as const },
    { key: "pause", action: actions.pause, label: "Tạm dừng", icon: Pause, onClick: onPause, variant: "outline" as const },
    { key: "resume", action: actions.resume, label: "Tiếp tục", icon: Play, onClick: onResume, variant: "default" as const },
    { key: "withdraw", action: actions.withdraw, label: "Rút", icon: XCircle, onClick: onWithdraw, variant: "outline" as const },
  ].filter((i) => i.action.enabled);

  if (!items.length) {
    return <span className="text-xs text-muted-foreground">{actions.pause.disabledReason ?? "—"}</span>;
  }

  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map(({ key, label, icon: Icon, onClick, variant }) => (
        <Button
          key={key}
          size="sm"
          variant={variant}
          className={cn("gap-1.5", key === "withdraw" && "text-destructive")}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </span>
  );
}

export function ControlLotTable({
  lots,
  stateByLot,
  now,
  clockReady,
  canOperate,
  window,
  selectedLotId,
  pendingLotId,
  onSelect,
  onOpen,
  onPause,
  onResume,
  onWithdraw,
}: Props) {
  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-foreground">Lô tài sản ({lots.length})</h2>
        <p className="text-xs text-muted-foreground">
          Chọn một lô để xem diễn biến trả giá. Mở lô rồi người tham gia mới trả giá được.
        </p>
      </div>

      {!lots.length ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Phiên chưa có lô tài sản nào.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Lô</TableHead>
                <TableHead>Tài sản</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Giá hiện tại</TableHead>
                <TableHead>Còn lại</TableHead>
                {canOperate && <TableHead className="text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => {
                const state = stateByLot.get(lot.id) ?? null;
                const phase = lotPhaseOf(state, now);
                const actions = lotActionsFor(state, now, { canOperate, window });
                const hasBid = state?.current_price != null;

                return (
                  <TableRow
                    key={lot.id}
                    onClick={() => onSelect(lot)}
                    className={cn(
                      "cursor-pointer",
                      selectedLotId === lot.id && "bg-primary/5 hover:bg-primary/5",
                    )}
                  >
                    <TableCell className="font-semibold tabular-nums">{lot.lot_no}</TableCell>
                    <TableCell className="max-w-[18rem]">
                      <p className="truncate font-medium text-foreground">{lot.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Khởi điểm {formatVnd(lot.starting_price)} · bước {formatVnd(lot.bid_step)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <LotPhaseBadge phase={phase} extensionCount={state?.extension_count ?? 0} />
                      {phase === "closed" && state?.result && (
                        <p className="mt-1 text-xs text-muted-foreground">{LOT_RESULT_LABELS[state.result]}</p>
                      )}
                      {phase === "paused" && state?.pause_reason && (
                        <p className="mt-1 max-w-[14rem] truncate text-xs text-warning" title={state.pause_reason}>
                          {state.pause_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className={cn("font-semibold tabular-nums", hasBid ? "text-primary" : "text-muted-foreground")}>
                        {formatVnd(state?.current_price ?? lot.starting_price)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {state?.bid_count
                          ? `${state.bid_count} lượt · SBD ${formatBidderNo(state.leading_bidder_no)}`
                          : "Chưa có lượt trả giá"}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <LotClock state={state} now={now} clockReady={clockReady} />
                    </TableCell>
                    {canOperate && (
                      <TableCell className="text-right">
                        <ActionButtons
                          actions={actions}
                          busy={pendingLotId === lot.id}
                          onOpen={() => onOpen(lot)}
                          onPause={() => onPause(lot)}
                          onResume={() => onResume(lot)}
                          onWithdraw={() => onWithdraw(lot)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

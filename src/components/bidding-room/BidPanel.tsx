import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Gavel, Info, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/queryKeys";
import { formatVnd, groupNumber, parseNumber } from "@/lib/advertising/slug";
import { NO_BID_MESSAGES, type NoBidReason } from "@/lib/bidding/roomAccess";
import { BiddingRpcError, biddingReasonMessage } from "@/lib/bidding/errors";
import { maxBid, nextMinBid, quickSteps, validateBid, type BidRejectReason, type BidSession } from "@/lib/bidding/rules";
import { newBidNonce, usePlaceBid } from "@/hooks/usePlaceBid";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Ô trả giá.
 *
 * Hai điều dễ làm sai:
 *  1. Câu báo lỗi phải TRÙNG câu server trả — nên phải truyền min/max vào
 *     biddingReasonMessage, nếu không sẽ ra câu chung chung trong khi server
 *     nói rõ số tiền.
 *  2. Nonce đóng băng CÙNG số tiền lúc mở hộp thoại. Dùng lại nonce sau khi đã
 *     đổi số tiền sẽ được server trả về đúng lượt CŨ (idempotent) — người dùng
 *     tưởng đã trả giá mới.
 */

/** Các mã nói về trạng thái lô/phiên — thay cả ô nhập chứ không chỉ báo đỏ. */
const STATE_REASONS = new Set<BidRejectReason>([
  "lot_not_found",
  "lot_not_configured",
  "session_not_live",
  "lot_not_open",
  "lot_paused",
  "lot_closed",
]);

interface Props {
  sessionId: string;
  bidSession: BidSession;
  lot: AuctionSessionItem;
  state: LotState | null;
  now: Date;
  clockReady: boolean;
  userId: string;
  bidderNo: number;
  /** false = đã mất tiền đặt trước: xem được, không trả giá được. */
  /** `null` = trả giá được. Khác null thì ô nhập bị khoá kèm lý do. */
  noBid: NoBidReason | null;
}

export function BidPanel({ sessionId, bidSession, lot, state, now, clockReady, userId, bidderNo, noBid }: Props) {
  const queryClient = useQueryClient();
  const place = usePlaceBid(sessionId);

  const [raw, setRaw] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState<{ amount: number; nonce: string } | null>(null);

  const min = nextMinBid(state, lot);
  const max = maxBid(state, lot, bidSession.max_bid_steps);
  const steps = quickSteps(state, lot, bidSession.max_bid_steps);
  const amount = raw ? parseNumber(raw) : null;

  // Điền sẵn mức tối thiểu, nhưng KHÔNG đè lên số người dùng đang gõ.
  const prevMin = useRef<number | null>(null);
  useEffect(() => {
    if (min !== prevMin.current) {
      prevMin.current = min;
      if (!touched) setRaw(min == null ? "" : groupNumber(min));
    }
  }, [min, touched]);

  const reason = validateBid({
    amount,
    lot,
    state,
    session: bidSession,
    bidderNo,
    eligible: noBid === null,
    userId,
    now,
  });

  const setAmount = (value: number) => {
    setRaw(groupNumber(value));
    setTouched(true);
  };

  const reset = () => {
    setConfirming(null);
    setRaw("");
    setTouched(false);
  };

  const submit = () => {
    if (!confirming) return;
    place.mutate(
      { lotId: lot.id, amount: confirming.amount, nonce: confirming.nonce },
      {
        // `duplicate` (gửi lại đúng nonce cũ) cũng vào đây — vẫn phải đóng hộp
        // thoại, nếu không người dùng ngồi nhìn nút quay mãi.
        onSuccess: reset,
        onError: (err) => {
          if (err instanceof BiddingRpcError) {
            // Server đã QUYẾT ĐỊNH từ chối: nonce cũ vô nghĩa, đóng hộp thoại.
            setConfirming(null);
            if (err.reason === "session_not_live") {
              queryClient.invalidateQueries({ queryKey: qk.auctionSessions.publicById(sessionId) });
            }
          }
          // Lỗi đường truyền: giữ nguyên hộp thoại VÀ nonce để bấm lại là idempotent.
        },
      },
    );
  };

  // Câu chữ theo LÝ DO: tịch thu, phiên đã chốt và đã hoàn trả là ba hoàn cảnh
  // khác nhau, ghi cứng một câu là nói sai với hai hoàn cảnh còn lại.
  if (noBid) {
    return (
      <Card className="flex items-start gap-2 rounded-2xl border-warning/30 bg-warning/10 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-foreground">{NO_BID_MESSAGES[noBid]}</p>
      </Card>
    );
  }

  if (reason && STATE_REASONS.has(reason)) {
    return (
      <Card className="flex items-start gap-2 rounded-2xl p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-foreground">
          {reason === "lot_not_open"
            ? "Đấu giá viên chưa mở lô này. Màn hình sẽ tự cập nhật khi lô được mở."
            : biddingReasonMessage(reason, { min_amount: min, max_amount: max })}
        </p>
      </Card>
    );
  }

  const leading = reason === "already_leading";
  const amountError = touched && reason && !leading ? biddingReasonMessage(reason, { min_amount: min, max_amount: max }) : null;
  const blocked = !clockReady || reason !== null || place.isPending;

  return (
    <>
      <Card
        className={cn(
          "space-y-3 rounded-2xl p-4",
          "max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:border-t max-lg:bg-background/95 max-lg:backdrop-blur",
        )}
      >
        {leading ? (
          <div className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm">
            <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p className="text-foreground">
              <strong>Bạn đang trả giá cao nhất.</strong> Chờ người khác trả giá cao hơn rồi mới trả tiếp được.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="bid-amount">Giá bạn trả (VNĐ)</Label>
              <Input
                id="bid-amount"
                inputMode="numeric"
                autoComplete="off"
                value={raw}
                onChange={(e) => {
                  setRaw(groupNumber(parseNumber(e.target.value)));
                  setTouched(true);
                }}
                placeholder={min == null ? "0" : groupNumber(min)}
                className={cn("text-lg font-semibold tabular-nums", amountError && "border-destructive")}
              />
              <p className="text-xs text-muted-foreground">
                {min != null && `Tối thiểu ${formatVnd(min)}`}
                {min != null && max != null && ` · tối đa ${formatVnd(max)}`}
              </p>
              {amountError && <p className="text-xs font-medium text-destructive">{amountError}</p>}
            </div>

            {steps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {steps.map((s) => (
                  <Button
                    key={s.steps}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(s.amount)}
                    className="gap-1"
                  >
                    +{s.steps} bước
                    <span className="text-muted-foreground">{formatVnd(s.amount)}</span>
                  </Button>
                ))}
              </div>
            )}

            <Button
              className="h-11 w-full text-base font-semibold"
              disabled={blocked}
              onClick={() => amount != null && setConfirming({ amount, nonce: newBidNonce() })}
            >
              {place.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Trả giá
            </Button>
            {!clockReady && <p className="text-center text-xs text-muted-foreground">Đang đồng bộ giờ máy chủ…</p>}
          </>
        )}
      </Card>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !place.isPending && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận trả giá {formatVnd(confirming?.amount)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Lô {lot.lot_no} · {lot.title}. Lượt trả giá đã ghi nhận thì <strong>không rút lại được miễn phí</strong>:
              rút lại giá đang dẫn đầu sẽ bị tịch thu toàn bộ tiền đặt trước của phiên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={place.isPending}>Huỷ</AlertDialogCancel>
            <Button onClick={submit} disabled={place.isPending} className="gap-1.5">
              {place.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận trả giá
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

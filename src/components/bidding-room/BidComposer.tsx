import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { qk } from "@/lib/queryKeys";
import { formatMoneyFull } from "@/utils/money";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { BiddingRpcError, biddingReasonMessage } from "@/lib/bidding/errors";
import { millions } from "@/lib/bidding/roomView";
import { maxBid, nextMinBid, quickSteps, validateBid, type BidSession } from "@/lib/bidding/rules";
import { newBidNonce, usePlaceBid } from "@/hooks/usePlaceBid";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Khung "Đặt giá của bạn" (design `.comp`). Chỉ mount khi lô đang nhận giá và
 * mình chưa dẫn đầu — BiddingRoom quyết; component được key theo lô nên đổi
 * lô là xoá sạch số đang gõ.
 *
 * Hai điều dễ làm sai (giữ từ BidPanel cũ):
 *  1. Câu báo lỗi phải TRÙNG câu server trả — truyền min/max vào biddingReasonMessage.
 *  2. Nonce đóng băng CÙNG số tiền lúc mở hộp thoại. Dùng lại nonce sau khi đã
 *     đổi số tiền sẽ được server trả về đúng lượt CŨ (idempotent).
 */

interface Props {
  sessionId: string;
  bidSession: BidSession;
  lot: AuctionSessionItem;
  state: LotState | null;
  now: Date;
  clockReady: boolean;
  userId: string;
  bidderNo: number;
}

const CHIP =
  "flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-[5px] text-[12.5px] font-semibold hover:border-primary hover:text-primary";
const CHIP_ON = "border-primary bg-primary/10 text-primary";

export function BidComposer({ sessionId, bidSession, lot, state, now, clockReady, userId, bidderNo }: Props) {
  const queryClient = useQueryClient();
  const place = usePlaceBid(sessionId);

  const [amount, setAmountState] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [nSteps, setNSteps] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ amount: number; nonce: string } | null>(null);

  const min = nextMinBid(state, lot);
  const max = maxBid(state, lot, bidSession.max_bid_steps);
  const step = lot.bid_step ?? 0;
  const first = state?.current_price == null;
  const chips = first ? [] : quickSteps(state, lot, bidSession.max_bid_steps, [1, 2, 3]);

  // Điền sẵn mức tối thiểu, nhưng KHÔNG đè lên số người dùng đang gõ.
  const prevMin = useRef<number | null>(null);
  useEffect(() => {
    if (min !== prevMin.current) {
      prevMin.current = min;
      if (!touched) setAmountState(min);
    }
  }, [min, touched]);

  const check = (value: number | null) =>
    validateBid({ amount: value, lot, state, session: bidSession, bidderNo, eligible: true, userId, now });
  const reason = check(amount);
  const error = touched && reason ? biddingReasonMessage(reason, { min_amount: min, max_amount: max }) : null;

  const setAmount = (value: number | null, steps: number | null = null) => {
    setAmountState(value);
    setNSteps(steps);
    setTouched(true);
  };

  const onCustomSteps = (raw: string) => {
    const n = raw === "" ? null : Math.max(1, Math.min(bidSession.max_bid_steps, Math.round(Number(raw)) || 1));
    if (n == null || min == null) {
      setNSteps(null);
      return;
    }
    setAmount(min + (n - 1) * step, n);
  };

  const submit = () => {
    if (!confirming) return;
    // Giá có thể đã nhảy trong lúc hộp thoại mở — đừng gửi một lượt chắc chắn bị từ chối.
    if (check(confirming.amount)) {
      setConfirming(null);
      setTouched(false);
      toast.error("Giá đã thay đổi trước khi bạn xác nhận — vui lòng trả lại.");
      return;
    }
    place.mutate(
      { lotId: lot.id, amount: confirming.amount, nonce: confirming.nonce },
      {
        // `duplicate` (gửi lại đúng nonce cũ) cũng vào đây — vẫn phải đóng hộp thoại.
        onSuccess: () => {
          setConfirming(null);
          setTouched(false);
          setNSteps(null);
        },
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

  const stepsOver = confirming && !first && state?.current_price != null && step ? (confirming.amount - state.current_price) / step : 0;
  const blocked = !clockReady || reason !== null || place.isPending;

  return (
    <>
      <div className="m-3 my-4 grid items-start gap-3 rounded-xl border border-border bg-muted/50 px-5 pb-5 pt-[18px] sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="col-span-full text-[13px] font-bold text-foreground">Đặt giá của bạn</div>

        {chips.length > 0 && (
          <div className="col-span-full mb-0.5 flex flex-wrap items-center gap-2 border-b border-dashed border-border pb-3.5">
            <span className="mr-1 text-xs text-muted-foreground">Trả nhanh</span>
            {chips.map((c) => (
              <button
                key={c.steps}
                type="button"
                onClick={() => setAmount(c.amount)}
                className={cn(CHIP, nSteps == null && amount === c.amount && CHIP_ON)}
              >
                +{c.steps} bước <span className="font-medium tabular-nums text-muted-foreground">{millions(c.amount)}</span>
              </button>
            ))}
            <label className={cn(CHIP, "cursor-text px-2.5 py-[3px]", nSteps != null && CHIP_ON)}>
              <b>+</b>
              <input
                type="number"
                min={1}
                max={bidSession.max_bid_steps}
                placeholder="n"
                aria-label="Số bước giá"
                value={nSteps ?? ""}
                onChange={(e) => onCustomSteps(e.target.value)}
                className="w-[34px] border-0 border-b-[1.5px] border-border bg-transparent py-0.5 text-center font-bold outline-none [appearance:textfield] focus:border-primary [&::-webkit-inner-spin-button]:appearance-none"
              />
              <b>bước</b>
              {nSteps != null && amount != null && (
                <span className="font-medium tabular-nums text-muted-foreground">{millions(amount)}</span>
              )}
            </label>
          </div>
        )}

        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-[10px] border-[1.5px] border-border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
            error && "border-destructive focus-within:border-destructive",
          )}
        >
          <button
            type="button"
            aria-label="Giảm 1 bước"
            disabled={first || amount == null || min == null || amount <= min}
            onClick={() => setAmount((amount ?? min ?? 0) - step)}
            className="w-[46px] flex-none bg-muted text-xl text-muted-foreground hover:bg-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <input
            inputMode="numeric"
            autoComplete="off"
            aria-label="Giá bạn trả"
            value={amount ? groupNumber(amount) : ""}
            onChange={(e) => setAmount(parseNumber(e.target.value) || null)}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-right text-[clamp(18px,2vw,22px)] font-bold tabular-nums outline-none"
          />
          <span className="grid place-items-center pr-3 font-semibold text-muted-foreground">₫</span>
          <button
            type="button"
            aria-label="Tăng 1 bước"
            disabled={first || amount == null || max == null || amount >= max}
            onClick={() => setAmount((amount ?? min ?? 0) + step)}
            className="w-[46px] flex-none bg-muted text-xl text-muted-foreground hover:bg-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>

        <div className="max-md:sticky max-md:bottom-0 max-md:bg-card max-md:pt-2">
          <button
            type="button"
            disabled={blocked}
            onClick={() => amount != null && setConfirming({ amount, nonce: newBidNonce() })}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-base font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground"
          >
            {place.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Trả giá
          </button>
        </div>

        {(error || !clockReady) && (
          <p className={cn("col-span-full text-xs", error ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {error ?? "Đang đồng bộ giờ máy chủ…"}
          </p>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !place.isPending && setConfirming(null)}>
        <AlertDialogContent className="max-w-[440px] gap-0 rounded-[14px] p-[22px]">
          <AlertDialogHeader className="space-y-0 text-left">
            <AlertDialogTitle className="mb-1.5 text-[17px]">Xác nhận trả giá</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[13.5px] text-muted-foreground">
                <p>
                  Tài sản {lot.lot_no} · {lot.title}
                </p>
                <div className="mb-3 mt-2 text-[28px] font-[750] tabular-nums text-primary">
                  {formatMoneyFull(confirming?.amount)}
                </div>
                <p>{first ? "Bằng giá khởi điểm." : `Bằng giá hiện tại + ${stepsOver} bước giá.`}</p>
                <div className="mt-3 rounded-lg bg-[hsl(var(--tier-warn-bg))] px-3 py-2.5 text-[13px] text-[hsl(var(--tier-warn-fg))]">
                  Lượt đã ghi nhận <b>không rút lại được miễn phí</b>: rút lại giá đang dẫn đầu sẽ bị tịch thu toàn bộ
                  tiền đặt trước của phiên.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-[18px] gap-2">
            <AlertDialogCancel disabled={place.isPending} className="mt-0">
              Huỷ
            </AlertDialogCancel>
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

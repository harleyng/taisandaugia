import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
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
import { formatMoneyFull } from "@/utils/money";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { BiddingRpcError, biddingReasonMessage } from "@/lib/bidding/errors";
import { clockText } from "@/lib/bidding/roomView";
import type { BidSession } from "@/lib/bidding/rules";
import { inCurrentRound, myRoundBid, roundLabel, sealedMinBid, validateSealedBid } from "@/lib/bidding/sealed";
import { newBidNonce } from "@/hooks/usePlaceBid";
import { useSealedBids, useSubmitSealedBid } from "@/hooks/useMethodBids";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Bỏ phiếu kín — MỘT phiếu mỗi vòng, không sửa. Đã nộp thì thay ô nhập bằng thẻ
 * "Phiếu của bạn". Vòng phụ chỉ số báo danh trong tied_bidder_nos nộp được, giá
 * từ tie_amount. Component được key theo lô + vòng ⇒ sang vòng mới là ô trống.
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
  contractId: string;
}

export function SealedBidPanel({ sessionId, bidSession, lot, state, now, clockReady, userId, bidderNo, contractId }: Props) {
  const submitBid = useSubmitSealedBid(sessionId);
  const { data: bids = [], isLoading } = useSealedBids(sessionId, lot.id);
  const round = state?.round_no ?? 1;
  const mine = myRoundBid(bids, contractId, round);

  const min = sealedMinBid(state, lot);
  const step = lot.bid_step ?? 0;
  const [amount, setAmountState] = useState<number | null>(min);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState<{ amount: number; nonce: string } | null>(null);

  const reason = validateSealedBid({
    amount,
    lot,
    state,
    session: bidSession,
    bidderNo,
    eligible: true,
    userId,
    now,
    alreadySubmitted: !!mine,
  });
  const error = touched && reason ? biddingReasonMessage(reason, { min_amount: min }) : null;
  const setAmount = (v: number | null) => {
    setAmountState(v);
    setTouched(true);
  };

  if (mine) {
    return (
      <div className="m-3 my-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <Lock className="mt-0.5 h-5 w-5 flex-none text-primary" />
        <div className="text-[13.5px]">
          <b className="block text-foreground">
            Phiếu của bạn · {roundLabel(round)}: {formatMoneyFull(mine.amount)}
          </b>
          <span className="text-muted-foreground">
            Nộp lúc {clockText(mine.placed_at)} — phiếu kín không sửa được. Kết quả công bố khi hết giờ nhận phiếu.
          </span>
        </div>
      </div>
    );
  }

  if (!inCurrentRound(state, bidderNo)) {
    return (
      <div className="m-3 my-4 rounded-xl bg-muted px-5 py-4 text-[13.5px] text-muted-foreground">
        {roundLabel(round)} chỉ dành cho số báo danh {(state?.tied_bidder_nos ?? []).map(formatBidderNo).join(", ")} —
        những người cùng trả giá cao nhất ở vòng trước.
      </div>
    );
  }

  const submit = () => {
    if (!confirming) return;
    submitBid.mutate(
      { lotId: lot.id, amount: confirming.amount, nonce: confirming.nonce },
      {
        onSuccess: () => setConfirming(null),
        // Server đã từ chối ⇒ đóng hộp thoại; lỗi mạng ⇒ giữ nonce để bấm lại idempotent.
        onError: (err) => err instanceof BiddingRpcError && setConfirming(null),
      },
    );
  };

  const blocked = !clockReady || isLoading || reason !== null || submitBid.isPending;

  return (
    <>
      <div className="m-3 my-4 grid items-start gap-3 rounded-xl border border-border bg-muted/50 px-5 pb-5 pt-[18px] sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="col-span-full text-[13px] font-bold text-foreground">
          Phiếu giá kín · {roundLabel(round)}
          <span className="ml-2 font-normal text-muted-foreground">từ {formatMoneyFull(min)}, theo bước {formatMoneyFull(step)}</span>
        </div>
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-[10px] border-[1.5px] border-border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
            error && "border-destructive focus-within:border-destructive",
          )}
        >
          <button
            type="button"
            aria-label="Giảm 1 bước"
            disabled={amount == null || min == null || amount <= min}
            onClick={() => setAmount((amount ?? min ?? 0) - step)}
            className="w-[46px] flex-none bg-muted text-xl text-muted-foreground hover:bg-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <input
            inputMode="numeric"
            autoComplete="off"
            aria-label="Giá trên phiếu"
            value={amount ? groupNumber(amount) : ""}
            onChange={(e) => setAmount(parseNumber(e.target.value) || null)}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-right text-[clamp(18px,2vw,22px)] font-bold tabular-nums outline-none"
          />
          <span className="grid place-items-center pr-3 font-semibold text-muted-foreground">₫</span>
          <button
            type="button"
            aria-label="Tăng 1 bước"
            disabled={amount == null && min == null}
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
            {submitBid.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Nộp phiếu
          </button>
        </div>
        {(error || !clockReady) && (
          <p className={cn("col-span-full text-xs", error ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {error ?? "Đang đồng bộ giờ máy chủ…"}
          </p>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !submitBid.isPending && setConfirming(null)}>
        <AlertDialogContent className="max-w-[440px] gap-0 rounded-[14px] p-[22px]">
          <AlertDialogHeader className="space-y-0 text-left">
            <AlertDialogTitle className="mb-1.5 text-[17px]">Xác nhận nộp phiếu kín</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[13.5px] text-muted-foreground">
                <p>
                  Tài sản {lot.lot_no} · {lot.title} · {roundLabel(round)}
                </p>
                <div className="mb-3 mt-2 text-[28px] font-[750] tabular-nums text-primary">
                  {formatMoneyFull(confirming?.amount)}
                </div>
                <div className="rounded-lg bg-[hsl(var(--tier-warn-bg))] px-3 py-2.5 text-[13px] text-[hsl(var(--tier-warn-fg))]">
                  Mỗi người chỉ nộp <b>một phiếu</b> mỗi vòng — phiếu đã nộp <b>không sửa, không rút được</b>. Giá cao
                  nhất khi hết giờ trúng; bằng giá thì vào vòng phụ.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-[18px] gap-2">
            <AlertDialogCancel disabled={submitBid.isPending} className="mt-0">
              Huỷ
            </AlertDialogCancel>
            <Button onClick={submit} disabled={submitBid.isPending} className="gap-1.5">
              {submitBid.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Nộp phiếu
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

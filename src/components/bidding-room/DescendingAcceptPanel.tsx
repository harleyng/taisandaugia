import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { formatMoneyFull } from "@/utils/money";
import { BiddingRpcError, biddingReasonMessage } from "@/lib/bidding/errors";
import { descendingPriceAt, validateAccept } from "@/lib/bidding/descending";
import type { BidSession } from "@/lib/bidding/rules";
import { newBidNonce } from "@/hooks/usePlaceBid";
import { useAcceptDescendingPrice } from "@/hooks/useMethodBids";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Đặt giá xuống — một nút "Chấp nhận giá". Người đầu tiên được máy chủ ghi nhận
 * trúng NGAY, lô đóng luôn.
 *
 * Nonce + số tiền đóng băng lúc mở hộp thoại (như BidComposer). Máy chủ ghi GIÁ
 * CỦA MÁY CHỦ — chỉ có thể thấp hơn hoặc bằng số đã đóng băng. Nếu đồng hồ client
 * chạy trước máy chủ (price_changed) thì mở lại hộp thoại ở giá máy chủ báo về,
 * không toast lỗi.
 */

interface Props {
  sessionId: string;
  bidSession: BidSession;
  lot: AuctionSessionItem;
  state: LotState | null;
  now: Date;
  clockReady: boolean;
  dropSeconds: number;
  userId: string;
  bidderNo: number;
}

export function DescendingAcceptPanel({ sessionId, bidSession, lot, state, now, clockReady, dropSeconds, userId, bidderNo }: Props) {
  const accept = useAcceptDescendingPrice(sessionId);
  const [confirming, setConfirming] = useState<{ amount: number; nonce: string; repriced: boolean } | null>(null);

  const price = descendingPriceAt(state, lot, dropSeconds, now);
  const reason = validateAccept({ lot, state, session: bidSession, bidderNo, eligible: true, userId, now });
  const blocked = !clockReady || reason !== null || price == null || accept.isPending;

  const submit = () => {
    if (!confirming) return;
    accept.mutate(
      { lotId: lot.id, amount: confirming.amount, nonce: confirming.nonce },
      {
        onSuccess: () => setConfirming(null),
        onError: (err) => {
          if (!(err instanceof BiddingRpcError)) return; // lỗi mạng: giữ nonce để bấm lại idempotent
          const current = err.details.current_price;
          if (err.reason === "price_changed" && typeof current === "number") {
            setConfirming({ amount: current, nonce: newBidNonce(), repriced: true });
          } else {
            setConfirming(null);
          }
        },
      },
    );
  };

  return (
    <>
      <div className="m-3 my-4 grid items-center gap-3 rounded-xl border border-border bg-muted/50 px-5 pb-5 pt-[18px] sm:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className="text-[13px] font-bold text-foreground">Chấp nhận mức giá đang chào</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Người đầu tiên chấp nhận trúng đấu giá ngay ở giá máy chủ ghi nhận. Chờ thêm thì giá thấp hơn nhưng người
            khác có thể nhận trước.
          </p>
        </div>
        <div className="max-md:sticky max-md:bottom-0 max-md:bg-card max-md:pt-2">
          <button
            type="button"
            disabled={blocked}
            onClick={() => price != null && setConfirming({ amount: price, nonce: newBidNonce(), repriced: false })}
            className="flex h-[54px] w-full flex-col items-center justify-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground"
          >
            <span className="text-[12px] font-semibold opacity-90">Chấp nhận giá</span>
            <span className="text-base font-bold tabular-nums">{formatMoneyFull(price)}</span>
          </button>
        </div>
        {(!clockReady || reason) && (
          <p className="col-span-full text-xs text-muted-foreground">
            {!clockReady ? "Đang đồng bộ giờ máy chủ…" : biddingReasonMessage(reason)}
          </p>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !accept.isPending && setConfirming(null)}>
        <AlertDialogContent className="max-w-[440px] gap-0 rounded-[14px] p-[22px]">
          <AlertDialogHeader className="space-y-0 text-left">
            <AlertDialogTitle className="mb-1.5 text-[17px]">
              {confirming?.repriced ? "Giá vừa giảm — xác nhận lại" : "Xác nhận chấp nhận giá"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[13.5px] text-muted-foreground">
                <p>
                  Tài sản {lot.lot_no} · {lot.title}
                </p>
                <div className="mb-3 mt-2 text-[28px] font-[750] tabular-nums text-primary">
                  {formatMoneyFull(confirming?.amount)}
                </div>
                <p>Nếu giá giảm tiếp trước khi máy chủ ghi nhận, bạn trúng ở mức thấp hơn.</p>
                <div className="mt-3 rounded-lg bg-[hsl(var(--tier-warn-bg))] px-3 py-2.5 text-[13px] text-[hsl(var(--tier-warn-fg))]">
                  Chấp nhận là <b>trúng đấu giá ngay</b> và không rút lại được. Không thanh toán đúng hạn sẽ bị tịch thu
                  tiền đặt trước.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-[18px] gap-2">
            <AlertDialogCancel disabled={accept.isPending} className="mt-0">
              Huỷ
            </AlertDialogCancel>
            <Button onClick={submit} disabled={accept.isPending} className="gap-1.5">
              {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Chấp nhận giá
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

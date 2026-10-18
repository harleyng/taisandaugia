import type { useOpenLot, usePauseLot, useWithdrawLot } from "@/hooks/useOrgBidding";
import type { useOpenTieRound } from "@/hooks/useOrgTieRound";
import type { BiddingMethod } from "@/lib/bidding/methods";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import { OpenLotDialog } from "./OpenLotDialog";
import { OpenTieRoundDialog } from "./OpenTieRoundDialog";
import { PauseLotDialog } from "./PauseLotDialog";
import { WithdrawLotDialog } from "./WithdrawLotDialog";

export type DialogKind = "open" | "pause" | "withdraw" | "tieRound" | null;

interface Props {
  dialog: DialogKind;
  target: AuctionSessionItem | null;
  session: AuctionSessionWithItems;
  stateByLot: Map<string, LotState>;
  method: BiddingMethod;
  dropSeconds: number;
  now: Date;
  mutations: {
    openLot: ReturnType<typeof useOpenLot>;
    pauseLot: ReturnType<typeof usePauseLot>;
    withdrawLot: ReturnType<typeof useWithdrawLot>;
    openTieRound: ReturnType<typeof useOpenTieRound>;
  };
  onClose: () => void;
}

/** Bốn hộp thoại thao tác lô của phòng điều hành — tách khỏi BiddingControlRoom cho gọn. */
export function ControlDialogs({ dialog, target, session, stateByLot, method, dropSeconds, now, mutations, onClose }: Props) {
  const { openLot, pauseLot, withdrawLot, openTieRound } = mutations;
  const targetState = target ? (stateByLot.get(target.id) ?? null) : null;
  return (
    <>
      <OpenLotDialog
        lot={dialog === "open" ? target : null}
        sessionEndsAt={session.ends_at}
        extensionSeconds={session.extension_seconds}
        method={method}
        dropSeconds={dropSeconds}
        now={now}
        pending={openLot.isPending}
        onOpenChange={(open) => !open && onClose()}
        onConfirm={(durationSeconds) =>
          target && openLot.mutate({ lotId: target.id, durationSeconds }, { onSuccess: onClose })
        }
      />
      <OpenTieRoundDialog
        lot={dialog === "tieRound" ? target : null}
        state={targetState}
        now={now}
        pending={openTieRound.isPending}
        onOpenChange={(open) => !open && onClose()}
        onConfirm={(durationSeconds) =>
          target && openTieRound.mutate({ lotId: target.id, durationSeconds }, { onSuccess: onClose })
        }
      />
      <PauseLotDialog
        lot={dialog === "pause" ? target : null}
        pending={pauseLot.isPending}
        onOpenChange={(open) => !open && onClose()}
        onConfirm={(reason) => target && pauseLot.mutate({ lotId: target.id, reason }, { onSuccess: onClose })}
      />
      <WithdrawLotDialog
        lot={dialog === "withdraw" ? target : null}
        state={targetState}
        pending={withdrawLot.isPending}
        onOpenChange={(open) => !open && onClose()}
        onConfirm={(reason) => target && withdrawLot.mutate({ lotId: target.id, reason }, { onSuccess: onClose })}
      />
    </>
  );
}

import type { BiddingMethod } from "@/lib/bidding/methods";
import type { BidSession } from "@/lib/bidding/rules";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import { BidComposer } from "./BidComposer";
import { DescendingAcceptPanel } from "./DescendingAcceptPanel";
import { SealedBidPanel } from "./SealedBidPanel";

interface Props {
  method: BiddingMethod;
  sessionId: string;
  bidSession: BidSession;
  lot: AuctionSessionItem;
  state: LotState | null;
  now: Date;
  clockReady: boolean;
  userId: string;
  bidderNo: number;
  contractId: string;
  dropSeconds: number;
}

/** Khung trả giá theo phương thức. Key theo lô (+ vòng) để đổi lô/vòng là xoá số đang gõ. */
export function LotActionArea({ method, ...p }: Props) {
  if (method === "descending") {
    return <DescendingAcceptPanel key={p.lot.id} {...p} />;
  }
  if (method === "sealed") {
    return <SealedBidPanel key={`${p.lot.id}:${p.state?.round_no ?? 1}`} {...p} />;
  }
  return <BidComposer key={p.lot.id} {...p} />;
}

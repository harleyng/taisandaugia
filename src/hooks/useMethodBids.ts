import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertBiddingRpcOk, biddingErrorMessage, BiddingRpcError } from "@/lib/bidding/errors";
import { formatVnd } from "@/lib/advertising/slug";
import type { AcceptDescendingOk, SealedBid, SubmitSealedBidOk } from "@/types/auction-bidding";

/**
 * Trả giá theo hai phương thức còn lại (20261018190000):
 *   • đặt giá xuống — accept_descending_price;
 *   • bỏ phiếu kín  — submit_sealed_bid + đọc phiếu (auction_sealed_bids).
 *
 * Cùng quy ước với usePlaceBid: RPC trả {ok, reason} ⇒ BẮT BUỘC assertBiddingRpcOk;
 * nonce sinh một lần mỗi lần bấm (newBidNonce) và dùng lại khi thử lại.
 */

export interface MethodBidVars {
  lotId: string;
  amount: number;
  nonce: string;
}

export function useAcceptDescendingPrice(sessionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lotId, amount, nonce }: MethodBidVars): Promise<AcceptDescendingOk> => {
      const { data, error } = await supabase.rpc("accept_descending_price", {
        _lot_id: lotId,
        _amount: amount,
        _nonce: nonce,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as AcceptDescendingOk;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
      if (res.duplicate) return;
      toast.success(`Bạn đã chấp nhận giá ${formatVnd(res.amount)} và trúng đấu giá tài sản này.`);
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: qk.bidding.lotStates(sessionId) });
      // price_changed do panel tự xử lý (mở lại xác nhận ở giá mới) — không toast đỏ.
      if (err instanceof BiddingRpcError && err.reason === "price_changed") return;
      toast.error(biddingErrorMessage(err));
    },
  });
}

export function useSubmitSealedBid(sessionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lotId, amount, nonce }: MethodBidVars): Promise<SubmitSealedBidOk> => {
      const { data, error } = await supabase.rpc("submit_sealed_bid", {
        _lot_id: lotId,
        _amount: amount,
        _nonce: nonce,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as SubmitSealedBidOk;
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
      queryClient.invalidateQueries({ queryKey: qk.bidding.sealedBids(sessionId, vars.lotId) });
      if (res.duplicate) return;
      toast.success(`Đã nộp phiếu kín ${formatVnd(res.amount)}. Kết quả công bố khi hết giờ nhận phiếu.`);
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}

/**
 * Phiếu kín của một lô. RLS trả: phiếu CỦA MÌNH (mọi lúc) + mọi phiếu của vòng đã
 * công bố (lô đóng / bằng giá / vòng đã qua). Không realtime — useLotStates đánh
 * thức key này mỗi khi dòng trạng thái lô đổi.
 */
export function useSealedBids(sessionId?: string | null, lotId?: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.bidding.sealedBids(sessionId, lotId),
    enabled: !!sessionId && !!lotId && enabled,
    queryFn: async (): Promise<SealedBid[]> => {
      const { data, error } = await supabase
        .from("auction_sealed_bids")
        .select("*")
        .eq("lot_id", lotId!)
        .order("round_no", { ascending: false })
        .order("amount", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SealedBid[];
    },
  });
}

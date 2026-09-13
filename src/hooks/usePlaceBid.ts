import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertBiddingRpcOk, biddingErrorMessage } from "@/lib/bidding/errors";
import { formatVnd } from "@/lib/advertising/slug";
import type { PlaceBidOk, WithdrawBidOk } from "@/types/auction-bidding";

/**
 * Trả giá và rút giá.
 *
 * Bảng auction_bids không có policy ghi — mọi thứ đi qua RPC trả {ok, reason},
 * mà Supabase coi là THÀNH CÔNG (error = null). Nên sau `if (error) throw` vẫn
 * bắt buộc assertBiddingRpcOk, nếu không một lượt bị từ chối vẫn toast xanh.
 *
 * Một key invalidate là đủ: qk.bidding.all(sessionId) phủ trạng thái lô, sổ trả
 * giá và nhật ký.
 */

/**
 * `client_nonce` làm cho việc gửi lại là vô hại: cùng nonce ⇒ server trả về
 * đúng lượt đã ghi thay vì tạo lượt thứ hai. Sinh MỘT lần cho mỗi lần người
 * dùng bấm, rồi dùng lại nếu phải thử lại — sinh mới mỗi lần thử là mất tác dụng.
 * SQL đòi độ dài 8–100; UUID (36) nằm gọn trong khoảng đó.
 */
export function newBidNonce(): string {
  return crypto.randomUUID();
}

export interface PlaceBidVars {
  lotId: string;
  amount: number;
  nonce: string;
}

export function usePlaceBid(sessionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lotId, amount, nonce }: PlaceBidVars): Promise<PlaceBidOk> => {
      const { data, error } = await supabase.rpc("place_bid", {
        _lot_id: lotId,
        _amount: amount,
        _nonce: nonce,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as PlaceBidOk;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
      // `duplicate` = lần gửi lại của đúng lượt cũ. Báo "đã trả giá" lần nữa sẽ
      // khiến người dùng tưởng mình vừa trả thêm một lượt.
      if (res.duplicate) return;
      toast.success(
        res.extended
          ? `Đã trả giá ${formatVnd(res.amount)}. Lô được gia hạn thêm thời gian.`
          : `Đã trả giá ${formatVnd(res.amount)}.`,
      );
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}

export function useWithdrawBid(sessionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bidId: string): Promise<WithdrawBidOk> => {
      const { data, error } = await supabase.rpc("withdraw_bid", { _bid_id: bidId });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as WithdrawBidOk;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
      // Rút giá làm mất tiền đặt trước ⇒ hồ sơ tham gia cũng đổi trạng thái.
      queryClient.invalidateQueries({ queryKey: qk.biddingContracts.all });
      toast.success(
        res.deposit_forfeited
          ? "Đã rút lượt trả giá. Tiền đặt trước không được hoàn trả."
          : "Đã rút lượt trả giá.",
      );
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}

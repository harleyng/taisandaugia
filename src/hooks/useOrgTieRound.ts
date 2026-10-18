import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertBiddingRpcOk, biddingErrorMessage } from "@/lib/bidding/errors";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import type { OpenTieRoundOk } from "@/types/auction-bidding";

/**
 * Bỏ phiếu kín: mở vòng phụ cho những người cùng trả giá cao nhất
 * (org_open_tie_round, quyền dieu-hanh-dau-gia.operate). Thời lượng bắt buộc,
 * KHÔNG bị cắt theo giờ kết thúc phiên. Tách khỏi useOrgBidding (đã 300 dòng).
 */
export function useOpenTieRound(sessionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lotId, durationSeconds }: { lotId: string; durationSeconds: number }) => {
      const { data, error } = await supabase.rpc("org_open_tie_round", {
        _lot_id: lotId,
        _duration_seconds: durationSeconds,
      });
      if (error) throw error;
      assertBiddingRpcOk(data);
      return data as unknown as OpenTieRoundOk;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: qk.bidding.all(sessionId) });
      toast.success(`Đã mở vòng phụ ${res.round_no - 1} — nhận phiếu đến ${formatDateTime(res.ends_at)}.`);
    },
    onError: (err) => toast.error(biddingErrorMessage(err)),
  });
}

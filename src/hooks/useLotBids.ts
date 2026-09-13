import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { LotBid } from "@/types/auction-bidding";

/**
 * Sổ trả giá của một lô (chỉ-ghi-thêm; UPDATE duy nhất là đánh dấu rút giá).
 *
 * Query THUẦN: kênh realtime của phiên nằm ở useLotStates và tự làm mới key
 * này khi có lượt mới — một kênh cho cả phiên, xem chú thích ở đó.
 *
 * RLS cho phép cả người ẩn danh đọc khi phiên đã công bố, nhưng chỉ lộ
 * `bidder_no` (đã phi chuẩn hoá sẵn sang bảng này) chứ không lộ danh tính —
 * nên dòng thời gian công khai dựng từ đây là an toàn.
 */
export function useLotBids(sessionId?: string | null, lotId?: string | null) {
  return useQuery({
    queryKey: qk.bidding.lotBids(sessionId, lotId),
    enabled: !!sessionId && !!lotId,
    queryFn: async (): Promise<LotBid[]> => {
      const { data, error } = await supabase
        .from("auction_bids")
        .select("*")
        .eq("lot_id", lotId!)
        .order("seq", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LotBid[];
    },
  });
}

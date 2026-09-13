import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { LotBid, LotState } from "@/types/auction-bidding";

/**
 * Trạng thái các lô của một phiên + KÊNH REALTIME của phiên đó.
 *
 * Đây là realtime ĐẦU TIÊN của dự án. Vài điều đã chốt:
 *
 * - MỘT kênh cho cả phiên, không phải mỗi lô một kênh. Vì vậy kênh ở đây lắng
 *   nghe CẢ auction_lot_states lẫn auction_bids (hai bảng duy nhất được đưa vào
 *   publication supabase_realtime); useLotBids chỉ là query thuần, được kênh
 *   này đánh thức. Màn nào cần sổ trả giá thì cũng đang hiển thị bảng lô, nên
 *   luôn có hook này chạy kèm.
 * - Phải removeChannel khi unmount, nếu không mỗi lần vào/ra phòng đấu giá lại
 *   bỏ lại một socket.
 * - Vẫn giữ một nhịp refetch làm LƯỚI AN TOÀN: realtime chưa từng chạy thật
 *   trong dự án này, và một sự kiện rơi giữa đường ở phòng đấu giá nghĩa là
 *   người dùng nhìn nhầm giá hiện tại.
 *
 * RLS: ai cũng đọc được khi phiên đã công bố, nên hook dùng chung cho phòng
 * đấu giá công khai lẫn màn điều hành của tổ chức.
 */

const SAFETY_POLL_MS = 15_000;

type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;

function mergeLotState(prev: LotState[] | undefined, payload: Change): LotState[] {
  const list = prev ?? [];

  if (payload.eventType === "DELETE") {
    const gone = (payload.old as Partial<LotState> | null)?.lot_id;
    return gone ? list.filter((s) => s.lot_id !== gone) : list;
  }

  const row = payload.new as unknown as LotState | null;
  if (!row?.lot_id) return list;

  const idx = list.findIndex((s) => s.lot_id === row.lot_id);
  if (idx === -1) return [...list, row];
  const next = [...list];
  next[idx] = row;
  return next;
}

export function useLotStates(sessionId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.bidding.lotStates(sessionId),
    enabled: !!sessionId,
    refetchInterval: SAFETY_POLL_MS,
    queryFn: async (): Promise<LotState[]> => {
      const { data, error } = await supabase
        .from("auction_lot_states")
        .select("*")
        .eq("session_id", sessionId!);
      if (error) throw error;
      return (data ?? []) as unknown as LotState[];
    },
  });

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`bidding:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_lot_states",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: Change) => {
          queryClient.setQueryData<LotState[]>(qk.bidding.lotStates(sessionId), (prev) =>
            mergeLotState(prev, payload),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_bids",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: Change) => {
          // auction_bids KHÔNG đặt REPLICA IDENTITY FULL, nên bản ghi cũ của
          // UPDATE (rút giá) chỉ có khoá chính — lấy lot_id từ bản mới trước.
          const row = (payload.new ?? payload.old) as Partial<LotBid> | null;
          if (row?.lot_id) {
            queryClient.invalidateQueries({ queryKey: qk.bidding.lotBids(sessionId, row.lot_id) });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return query;
}

/** Trạng thái của MỘT lô. `null` nghĩa là lô chưa mở (chưa có dòng trong bảng). */
export function useLotState(sessionId: string | null | undefined, lotId: string | null | undefined) {
  const { data, ...rest } = useLotStates(sessionId);
  return { ...rest, data: data?.find((s) => s.lot_id === lotId) ?? null };
}

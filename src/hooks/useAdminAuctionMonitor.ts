// Giám sát phiên đấu giá (admin, chỉ đọc) — RPC admin_auction_sessions /
// admin_auction_session_detail, cổng quyền "phien-dau-gia:view" ở server.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DETAIL_LIVE_REFRESH_MS,
  LIST_REFRESH_MS,
  liveLotCount,
  type AdminAuctionSessionRow,
  type MonitorSessionDetail,
} from "@/lib/auctionMonitor/monitor";

export const adminAuctionMonitorKeys = {
  list: ["admin", "auction-sessions"] as const,
  detail: (id: string | undefined) => ["admin", "auction-sessions", id] as const,
};

export function useAdminAuctionSessions() {
  return useQuery({
    queryKey: adminAuctionMonitorKeys.list,
    queryFn: async (): Promise<AdminAuctionSessionRow[]> => {
      const { data, error } = await supabase.rpc("admin_auction_sessions");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: LIST_REFRESH_MS,
  });
}

export function useAdminAuctionSessionDetail(id: string | undefined) {
  return useQuery({
    queryKey: adminAuctionMonitorKeys.detail(id),
    enabled: !!id,
    queryFn: async (): Promise<MonitorSessionDetail | null> => {
      const { data, error } = await supabase.rpc("admin_auction_session_detail", { _session_id: id! });
      if (error) throw error;
      return (data as unknown as MonitorSessionDetail | null) ?? null;
    },
    // Lô đang đấu ⇒ giá / lượt trả đổi liên tục; không có thì thôi poll.
    refetchInterval: (q) => (liveLotCount(q.state.data) > 0 ? DETAIL_LIVE_REFRESH_MS : false),
  });
}

// Gợi ý từ tư vấn đấu giá cho tổ chức khi lập phiên (BR-CNS-06). Một lần gọi cho cả phiên:
// server chỉ trả đề xuất ĐÃ ĐƯỢC NGƯỜI BÁN CHẤP NHẬN của hồ sơ mà tổ chức đang giữ hợp đồng
// ký gửi đã ký; không quyền ⇒ rỗng.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { suggestionsByPosting } from "@/lib/auctionConsult/suggestion";
import type { AuctionConsultSuggestion } from "@/types/auctionConsult";

export function useSessionAuctionConsultSuggestions(sessionId: string | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: qk.auctionConsult.sessionSuggestions(sessionId),
    enabled: !!sessionId && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("org_session_auction_consult_suggestions", {
        _session_id: sessionId!,
      });
      if (error) throw error;
      return (data ?? []) as AuctionConsultSuggestion[];
    },
  });
  const map = useMemo(() => suggestionsByPosting(query.data ?? []), [query.data]);
  return { map, isLoading: query.isLoading };
}

export function useLotAuctionConsultSuggestion(
  sessionId: string | null | undefined,
  postingId: string | null | undefined,
  enabled = true,
) {
  const { map } = useSessionAuctionConsultSuggestions(sessionId, enabled && !!postingId);
  return postingId ? (map.get(postingId) ?? null) : null;
}

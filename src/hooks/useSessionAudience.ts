import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { AudienceRow } from "@/types/org-contacts";

/**
 * Người nhận tiếp thị của một phiên. Luật khớp nằm DUY NHẤT trong RPC
 * org_session_audience — hook này không lọc / xếp lại gì, chỉ chuyển kết quả.
 */
export function useSessionAudience(sessionId: string | undefined, groupIds: string[], enabled: boolean) {
  const groupKey = [...groupIds].sort().join(",");
  return useQuery({
    queryKey: qk.sessionAudience.list(sessionId, groupKey),
    enabled: enabled && !!sessionId,
    queryFn: async (): Promise<AudienceRow[]> => {
      const { data, error } = await supabase.rpc("org_session_audience", {
        _session_id: sessionId!,
        ...(groupIds.length > 0 ? { _group_ids: groupIds } : {}),
      });
      if (error) throw error;
      return (data ?? []) as unknown as AudienceRow[];
    },
  });
}

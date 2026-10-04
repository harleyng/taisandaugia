import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { qk } from "@/lib/queryKeys";
import { FUNNEL_REASON_MESSAGES, mapMarketingFunnel, type MarketingFunnel } from "@/lib/ownerMarketing/funnel";

// Phễu truyền thông (Phase M5, migration 20261002150000). Một RPC trả mọi phần — tổng, theo kênh,
// theo nguồn, theo tài sản — đều đã tính ở server; chỉ số đếm, không dữ liệu cá nhân.

export class FunnelRpcError extends Error {
  constructor(readonly reason: string) {
    super(FUNNEL_REASON_MESSAGES[reason] ?? "Không tải được hiệu quả truyền thông. Vui lòng thử lại.");
    this.name = "FunnelRpcError";
  }
}

export function useOwnerMarketingFunnel(from: string, to: string, listingId: string | null) {
  const { workspaceId } = useOwnerWorkspace();
  return useQuery({
    queryKey: qk.ownerMarketing.funnel(workspaceId, from, to, listingId),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<MarketingFunnel> => {
      const { data, error } = await supabase.rpc("owner_mkt_funnel", {
        p_workspace_id: workspaceId!,
        p_period_start: from,
        p_period_end: to,
        ...(listingId ? { p_listing_id: listingId } : {}),
      });
      if (error) throw error;
      const d = (data ?? {}) as { ok?: boolean; reason?: string };
      if (d.ok === false) throw new FunnelRpcError(d.reason ?? "unknown");
      const funnel = mapMarketingFunnel(data);
      if (!funnel) throw new FunnelRpcError("unknown");
      return funnel;
    },
  });
}

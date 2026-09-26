import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { mapOverviewRow, type OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import type { OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";

const NO_ROWS: OutcomeOverviewRow[] = [];

/**
 * "Kết quả phiên": mỗi tài sản có kết quả một dòng (RPC owner_outcomes_overview).
 * Không gộp nguồn ở client — server đã chọn số thắng, nhãn nguồn và cờ lệch.
 */
export function useOwnerOutcomesOverview(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.ownerOutcomesOverview(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<OutcomeOverviewRow[]> => {
      const { data, error } = await supabase.rpc("owner_outcomes_overview", { p_workspace_id: workspaceId! });
      if (error) throw error;
      return (data ?? []).map(mapOverviewRow);
    },
  });
  return {
    rows: query.data ?? NO_ROWS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Tài sản cần xem lịch sử: tin trên sàn (listingId) hoặc tài sản ngoài sàn (titleKey). */
export interface OutcomeAssetRef {
  listingId: string | null;
  titleKey: string | null;
}

export const outcomeAssetKey = (a: OutcomeAssetRef): string | null =>
  a.listingId ? `l:${a.listingId}` : a.titleKey ? `t:${a.titleKey}` : null;

/** Mọi lượt đơn vị đã tự khai cho MỘT tài sản, lượt mới nhất trước (đọc thẳng bảng, dưới RLS). */
export function useOwnerOutcomeHistory(workspaceId: string | null | undefined, asset: OutcomeAssetRef | null) {
  const key = asset ? outcomeAssetKey(asset) : null;
  return useQuery({
    queryKey: qk.ownerOutcomeHistory(workspaceId, key),
    enabled: !!workspaceId && !!key,
    queryFn: async (): Promise<OwnerOutcomeRecord[]> => {
      let q = supabase.from("owner_asset_outcomes").select("*").eq("workspace_id", workspaceId!);
      q = asset!.listingId
        ? q.eq("listing_id", asset!.listingId)
        : q.is("listing_id", null).is("asset_posting_id", null).eq("title_key", asset!.titleKey!);
      const { data, error } = await q.order("round_no", { ascending: false }).order("auction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

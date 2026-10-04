import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { mapPartnerScore, type PartnerScore } from "@/lib/dossier/partnerScorecard";

const NO_ROWS: PartnerScore[] = [];

/**
 * "Đối tác của tôi": mỗi đối tác (thẩm định giá / pháp lý / tổ chức đấu giá) một dòng
 * (RPC owner_partner_scorecard). Server gom tên, gộp nguồn kết quả và lọc theo chi nhánh;
 * client chỉ áp ngưỡng "Chưa đủ dữ liệu".
 */
export function useOwnerPartnerScorecard(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.ownerPartnerScorecard(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<PartnerScore[]> => {
      const { data, error } = await supabase.rpc("owner_partner_scorecard", { p_workspace_id: workspaceId! });
      if (error) throw error;
      return (data ?? [])
        .map((r) => mapPartnerScore(r as unknown as Record<string, unknown>))
        .filter((r): r is PartnerScore => r !== null);
    },
  });
  return {
    rows: query.data ?? NO_ROWS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

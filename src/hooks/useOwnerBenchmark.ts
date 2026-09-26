import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { parseBenchmark, type OwnerBenchmark } from "@/lib/ownerBenchmark";

/**
 * So sánh ẩn danh của Trạm với các chi nhánh cùng công ty mẹ (RPC owner_ws_benchmark).
 * Tính cho mọi Trạm cùng hệ thống ⇒ đắt; số chỉ đổi khi có kết quả phiên mới nên
 * cache lâu. Chỉ thành viên trực tiếp gọi được — trụ sở xem qua liên kết thì tắt.
 */
export function useOwnerBenchmark(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.ownerWorkspace.benchmark(workspaceId),
    enabled: !!workspaceId && enabled,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<OwnerBenchmark> => {
      const { data, error } = await supabase.rpc("owner_ws_benchmark", { p_workspace_id: workspaceId! });
      if (error) throw error;
      return parseBenchmark(data);
    },
  });
}

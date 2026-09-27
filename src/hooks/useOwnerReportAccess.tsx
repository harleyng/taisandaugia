import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";

/** Kết quả mở khoá báo cáo danh mục (RPC owner_charge_portfolio_report). */
export interface OwnerReportChargeResult {
  ok: boolean;
  /** free = bộ lọc mặc định · covered = gói thuê bao bao · credits = đã trừ credit. */
  mode?: "free" | "covered" | "credits";
  cost?: number;
  /** Lượt xem còn lại của gói tháng này khi covered; null = không giới hạn. */
  remaining?: number | null;
  reason?: "insufficient" | "quota_exhausted" | "not_found";
}

/**
 * Mở khoá báo cáo danh mục của Trạm. Trừ ở SERVER theo thứ tự: bộ lọc mặc định miễn phí
 * → hạn mức gói thuê bao của Trạm → credit của người xem (atomic, không trừ nửa chừng).
 */
export function useOwnerReportAccess(workspaceId: string) {
  const queryClient = useQueryClient();

  const charge = useMutation({
    mutationFn: async ({
      filter,
      isDefault,
    }: {
      filter: PortfolioFilter;
      isDefault: boolean;
    }): Promise<OwnerReportChargeResult> => {
      const { data, error } = await supabase.rpc("owner_charge_portfolio_report", {
        p_workspace_id: workspaceId,
        // filter được ghi vào cột JSONB owner_report_views.filter_combo
        p_filter: filter as unknown as Json,
        p_is_default: isDefault,
      });
      if (error) throw error;
      return (data ?? { ok: false }) as unknown as OwnerReportChargeResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.userCredits.all });
      queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.all });
    },
  });

  return { charge };
}

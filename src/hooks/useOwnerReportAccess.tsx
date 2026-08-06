import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chargeOwnerReport } from "@/lib/credits";
import type { PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";
import { useAuthState } from "@/hooks/useAuthState";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";

export function useOwnerReportAccess(workspaceId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuthState();

  const charge = useMutation({
    mutationFn: async ({
      filter,
      isDefault,
    }: {
      filter: PortfolioFilter;
      isDefault: boolean;
    }) => {
      const userId = session?.user.id;
      if (!userId) throw new Error("Chưa đăng nhập");
      // filter được ghi vào cột JSONB owner_report_views.filter_combo
      return chargeOwnerReport(userId, workspaceId, filter as unknown as Json, isDefault);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.userCredits.all });
    },
  });

  return { charge };
}

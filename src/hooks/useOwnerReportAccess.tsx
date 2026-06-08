import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chargeOwnerReport } from "@/lib/credits";
import type { PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";
import { useAuthState } from "@/hooks/useAuthState";

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
      return chargeOwnerReport(userId, workspaceId, filter, isDefault);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    },
  });

  return { charge };
}

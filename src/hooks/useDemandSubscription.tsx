import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEMAND_TIERS,
  NOT_SUBSCRIBED,
  cancelDemandSubscription as cancelImpl,
  fetchDemandSubscription,
  subscribeDemand as subscribeDemandImpl,
  type DemandTierKey,
} from "@/lib/demandSubscription";
import { qk } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Gói theo dõi nhu cầu của người dùng hiện tại.
 *
 * Chuyển từ useSyncExternalStore trên localStorage sang React Query trên bảng
 * user_demand_subscriptions. Giữ nguyên hình dạng trả về (spread state + hai hàm
 * + DEMAND_TIERS) nên các call site không phải đổi.
 */
export const useDemandSubscription = () => {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const queryKey = qk.demandSubscription(userId);

  const { data: state = NOT_SUBSCRIBED, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: () => fetchDemandSubscription(userId!),
    // Gói hết hạn theo thời gian, không theo mutation nào — staleTime ngắn để
    // trạng thái ACTIVE → EXPIRED tự đổi mà user không phải tải lại trang.
    staleTime: 60_000,
  });

  const subscribeDemand = useCallback(
    async (tier: DemandTierKey) => {
      if (!userId) return { ok: false as const, reason: "insufficient" as const };
      const result = await subscribeDemandImpl(userId, tier);
      if (result.ok) {
        qc.invalidateQueries({ queryKey });
        // Đã trừ credit ⇒ số dư và sổ giao dịch phải tính lại.
        qc.invalidateQueries({ queryKey: qk.userCredits.byUser(userId) });
      }
      return result;
    },
    [qc, queryKey, userId],
  );

  const cancel = useCallback(async () => {
    if (!userId) return;
    await cancelImpl(userId);
    qc.invalidateQueries({ queryKey });
  }, [qc, queryKey, userId]);

  return { ...state, isLoading, subscribeDemand, cancel, DEMAND_TIERS };
};

export { DEMAND_TIERS };
export type { DemandTierKey };

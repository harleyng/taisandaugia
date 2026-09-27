import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { unwrapSubRpc } from "@/lib/ownerSubscription/errors";
import type {
  OwnerSubscriptionQuote,
  OwnerSubscriptionStatus,
  PayOwnerSubscriptionResult,
} from "@/lib/ownerSubscription/types";

/**
 * Gói thuê bao của một Trạm (null = Trạm chưa có gói, hoặc tenant "Cá nhân").
 * Mọi thành viên đọc được qua RPC owner_subscription_status — không đọc bảng trực tiếp.
 */
export function useOwnerSubscription(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.ownerSubscription.byWorkspace(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_subscription_status", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data ?? null) as unknown as OwnerSubscriptionStatus | null;
    },
  });
}

/** Báo giá để thanh toán (trang VNPay mô phỏng). */
export function useOwnerSubscriptionQuote(subId: string | null | undefined) {
  return useQuery({
    queryKey: qk.ownerSubscription.quote(subId),
    enabled: !!subId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_subscription_quote", { p_sub_id: subId! });
      if (error) throw error;
      const q = (data ?? {}) as unknown as OwnerSubscriptionQuote;
      return q.ok ? q : null;
    },
  });
}

/**
 * Ghi nhận thanh toán gói (⚠️ MÔ PHỎNG — IPN thật sẽ gọi _settle_owner_subscription).
 * Idempotent ở server: F5 trang kết quả chỉ nhận `already_paid`.
 */
export function usePayOwnerSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { subId: string; txnRef: string; expectedAmount: number }) => {
      const { data, error } = await supabase.rpc("pay_owner_subscription", {
        p_sub_id: args.subId,
        p_txn_ref: args.txnRef,
        p_expected_amount: args.expectedAmount,
      });
      if (error) throw error;
      return unwrapSubRpc(data) as unknown as PayOwnerSubscriptionResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerSubscription.all }),
  });
}

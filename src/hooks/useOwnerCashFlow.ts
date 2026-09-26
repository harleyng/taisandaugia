// "Dòng tiền" (docs/owner-control-tower-plan.md Phase 15a): đọc RPC owner_cash_flow và
// ghi sổ thu chi owner_cash_events. Mọi thao tác ghi làm mới cả nhóm owner_asset_outcomes
// (Kết quả phiên, Chỉ tiêu, bản xem trước báo cáo, Nhịp đập) qua invalidateOwnerOutcomes.

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { mapCashFlowPayload, type CashFlowData } from "@/lib/ownerCashFlow";
import {
  cashEventErrorMessage,
  settleReasonMessage,
  type CashEventInsertPayload,
  type CashEventUpdatePayload,
} from "@/lib/ownerCashEvent";
import { invalidateOwnerOutcomes } from "@/hooks/useOwnerOutcomeEdit";

/** Một lần đọc cho cả trang; trụ sở nhận thêm các Trạm con đã liên kết. */
export function useOwnerCashFlow(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: qk.ownerCashFlow(workspaceId, true),
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async (): Promise<CashFlowData> => {
      const { data, error } = await supabase.rpc("owner_cash_flow", {
        p_workspace_id: workspaceId!,
        p_include_linked: true,
      });
      if (error) throw error;
      return mapCashFlowPayload(data);
    },
  });
}

export type SaveCashEventInput =
  | { mode: "create"; payload: CashEventInsertPayload; successMessage?: string }
  | { mode: "update"; id: string; payload: CashEventUpdatePayload; successMessage?: string };

/** Thêm / sửa một khoản. RLS lọc dòng không có quyền mà không báo lỗi ⇒ đọc lại id. */
export function useSaveCashEvent(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCashEventInput) => {
      if (input.mode === "create") {
        // workspace_id NOT NULL nhưng do trigger guard suy từ kết quả phiên; client không có
        // quyền cột này (GRANT INSERT theo cột) ⇒ kiểu Insert sinh tự động đòi nó, phải ép kiểu.
        const row = input.payload as unknown as TablesInsert<"owner_cash_events">;
        const { data, error } = await supabase.from("owner_cash_events").insert(row).select("id").single();
        if (error) throw error;
        return data.id;
      }
      const { data, error } = await supabase
        .from("owner_cash_events")
        .update(input.payload)
        .eq("id", input.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
      return input.id;
    },
    onSuccess: (_id, input) =>
      toast.success(input.successMessage ?? (input.mode === "create" ? "Đã ghi khoản thu chi" : "Đã sửa khoản thu chi")),
    onError: (err) => toast.error(cashEventErrorMessage(err)),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}

export function useDeleteCashEvent(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; successMessage?: string }) => {
      const { data, error } = await supabase.from("owner_cash_events").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
    },
    onSuccess: (_d, { successMessage }) => toast.success(successMessage ?? "Đã xoá khoản thu chi"),
    onError: (err) => toast.error(cashEventErrorMessage(err)),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}

/** Hạn người trúng nộp đủ tiền (null = dùng mặc định ngày phiên + 30). */
export function useSetPaymentDue(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ outcomeId, dueOn }: { outcomeId: string; dueOn: string | null }) => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase
        .from("owner_asset_outcomes")
        .update({ payment_due_on: dueOn })
        .eq("id", outcomeId)
        .eq("workspace_id", workspaceId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
    },
    onSuccess: (_d, { dueOn }) => toast.success(dueOn ? "Đã đặt hạn thanh toán" : "Đã bỏ hạn thanh toán"),
    onError: (err) => toast.error(cashEventErrorMessage(err)),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}

/** Lý do nghiệp vụ ({ok:false}) — đã là câu tiếng Việt, khác lỗi PostgREST. */
class SettleRefused extends Error {}

interface SettleResult {
  id: string;
  amount: number;
}

/**
 * "Đã thu đủ": server ghi một khoản thanh toán đúng bằng số còn lại (khoá dòng, không
 * tin số client đang giữ). Toast có "Hoàn tác" = xoá đúng khoản vừa ghi.
 */
export function useSettleOutcome(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const undo = useDeleteCashEvent(workspaceId);
  const undoRef = useRef(undo.mutate);
  undoRef.current = undo.mutate;

  return useMutation({
    mutationFn: async ({ outcomeId, occurredOn }: { outcomeId: string; occurredOn?: string }): Promise<SettleResult> => {
      const { data, error } = await supabase.rpc("owner_cash_settle", {
        p_outcome_id: outcomeId,
        ...(occurredOn ? { p_occurred_on: occurredOn } : {}),
      });
      if (error) throw error;
      const r = (data ?? {}) as { ok?: boolean; reason?: string; id?: string; amount?: number | string };
      if (!r.ok || !r.id) throw new SettleRefused(settleReasonMessage(r.reason));
      return { id: r.id, amount: Number(r.amount ?? 0) };
    },
    onSuccess: ({ id }) =>
      toast.success("Đã ghi nhận thu đủ", {
        action: { label: "Hoàn tác", onClick: () => undoRef.current({ id, successMessage: "Đã hoàn tác" }) },
      }),
    onError: (err) => toast.error(err instanceof SettleRefused ? err.message : cashEventErrorMessage(err)),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}

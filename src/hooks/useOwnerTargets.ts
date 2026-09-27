import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  computeTargetProgress,
  currentTargets,
  groupTargetsByStatus,
  mapTargetRow,
  targetErrorMessage,
  targetInputsFromOverview,
  type OwnerTarget,
  type TargetGroups,
  type TargetProgress,
  type TargetSaveArgs,
} from "@/lib/ownerTargets";
import type { OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerOutcomesOverview } from "@/hooks/useOwnerOutcomesOverview";
import { useWorkspaceBranchOptions, type WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";

const NO_TARGETS: OwnerTarget[] = [];
const NO_BRANCHES: WorkspaceBranchOption[] = [];
const NO_IDS: string[] = [];

type SaveTargetRpcArgs = Database["public"]["Functions"]["owner_save_target"]["Args"];

/** Mọi chỉ tiêu của không gian (cả kỳ cũ lẫn kỳ sắp tới) kèm tiêu chí — ít dòng, tải một lần. */
export function useOwnerTargets(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.ownerTargets(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerTarget[]> => {
      const { data, error } = await supabase
        .from("owner_workspace_targets")
        .select("*, criteria:owner_workspace_target_criteria(metric, goal, sort_order)")
        .eq("workspace_id", workspaceId!)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const t = mapTargetRow(row);
        return t ? [t] : [];
      });
    },
  });
  return {
    targets: query.data ?? NO_TARGETS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Tạo / sửa chỉ tiêu + thay toàn bộ tiêu chí trong MỘT giao dịch (RPC owner_save_target,
 * SECURITY INVOKER ⇒ RLS là cổng; server tự báo 42501 khi không ghi được). Trả id chỉ tiêu.
 */
export function useSaveOwnerTarget(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TargetSaveArgs): Promise<string> => {
      if (!workspaceId) throw new Error("no_workspace");
      // Kiểu sinh tự động coi mọi tham số là bắt buộc & khác null; server nhận NULL.
      const { data, error } = await supabase.rpc("owner_save_target", args as SaveTargetRpcArgs);
      if (error) throw error;
      if (!data) throw { code: "42501" };
      return data;
    },
    onSuccess: (_id, args) => toast.success(args.p_target_id ? "Đã cập nhật chỉ tiêu" : "Đã đặt chỉ tiêu"),
    onError: (err) => toast.error(targetErrorMessage(err)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerTargets(workspaceId) }),
  });
}

export function useDeleteOwnerTarget(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase
        .from("owner_workspace_targets")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
    },
    onSuccess: () => toast.success("Đã xoá chỉ tiêu"),
    onError: (err) => toast.error(targetErrorMessage(err)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerTargets(workspaceId) }),
  });
}

/**
 * Chỉ tiêu + đầu vào "đã thu" dùng chung cho Tổng quan và trang "Chỉ tiêu". Số đã
 * thu dựng từ CÙNG các dòng của trang "Kết quả phiên" (useOwnerOutcomesOverview,
 * chung cache) ⇒ cùng kỳ thì số tài sản đấu thành của các màn khớp nhau.
 */
function useTargetSources() {
  const { workspaceId, isScoped, branchScope, can } = useOwnerWorkspace();
  const targetsQuery = useOwnerTargets(workspaceId);
  const rowsQuery = useOwnerOutcomesOverview(workspaceId);
  const branchesQuery = useWorkspaceBranchOptions(workspaceId);

  const inputs = useMemo(() => targetInputsFromOverview(rowsQuery.rows), [rowsQuery.rows]);

  return {
    workspaceId,
    targets: targetsQuery.targets,
    rows: rowsQuery.rows,
    inputs,
    today: todayIso(),
    branches: branchesQuery.data ?? NO_BRANCHES,
    /** Người bị giới hạn chi nhánh mở sẵn chỉ tiêu của chi nhánh mình (nếu có). */
    preferredBranchIds: isScoped ? branchScope ?? NO_IDS : NO_IDS,
    /** Mở được hộp thoại "Đặt chỉ tiêu" (tạo mới hoặc sửa) — chi-tieu:create|update. */
    canManage: can("chi-tieu", "create") || can("chi-tieu", "update"),
    canUpdate: can("chi-tieu", "update"),
    canDelete: can("chi-tieu", "delete"),
    isLoading: targetsQuery.isLoading || rowsQuery.isLoading || branchesQuery.isLoading,
    isError: targetsQuery.isError || rowsQuery.isError || branchesQuery.isError,
    refetch: () => {
      void targetsQuery.refetch();
      void rowsQuery.refetch();
      void branchesQuery.refetch();
    },
  };
}

/** Tiến độ các chỉ tiêu của kỳ đang diễn ra — khối chỉ xem trên Tổng quan. */
export function useOwnerTargetProgress() {
  const { workspaceId, targets, inputs, today, branches, preferredBranchIds, canManage, isLoading } =
    useTargetSources();
  const progress = useMemo<TargetProgress[]>(
    () => currentTargets(targets, today).map((t) => computeTargetProgress(t, inputs, today)),
    [targets, inputs, today],
  );
  return { workspaceId, progress, branches, preferredBranchIds, canManage, isLoading };
}

/** Mọi chỉ tiêu kèm tiến độ, chia đang thực hiện · đã hoàn thành · không hoàn thành — trang "Chỉ tiêu". */
export function useOwnerTargetsBoard() {
  const { targets, inputs, today, ...rest } = useTargetSources();
  const groups = useMemo<TargetGroups>(
    () => groupTargetsByStatus(targets.map((t) => computeTargetProgress(t, inputs, today)), today),
    [targets, inputs, today],
  );
  return { ...rest, targets, groups, today };
}

const NO_ROWS_BY_KEY = new Map<string, OutcomeOverviewRow>();

/**
 * Một chỉ tiêu (trang chi tiết): tiến độ từng tiêu chí + các dòng Kết quả phiên để dựng
 * bảng số liệu cấu thành. `progress` null ⇒ không có chỉ tiêu này trong không gian
 * đang chọn (đã xoá, sai id, hoặc đổi sang không gian khác).
 */
export function useOwnerTargetDetail(id: string | undefined) {
  const { targets, inputs, rows, today, ...rest } = useTargetSources();
  const target = useMemo(() => targets.find((t) => t.id === id) ?? null, [targets, id]);
  const progress = useMemo(
    () => (target ? computeTargetProgress(target, inputs, today) : null),
    [target, inputs, today],
  );
  const rowsByKey = useMemo(
    () => (rows.length ? new Map(rows.map((r) => [r.rowKey, r])) : NO_ROWS_BY_KEY),
    [rows],
  );
  return { ...rest, targets, inputs, rowsByKey, progress, today };
}

/**
 * Trang đặt / sửa chỉ tiêu: mọi chỉ tiêu (để báo trùng kỳ + phạm vi) + đầu vào "đã thu"
 * (gợi ý số kỳ trước). `id` trống ⇒ đặt mới, `target` luôn null.
 */
export function useOwnerTargetEditor(id: string | undefined) {
  const { targets, ...rest } = useTargetSources();
  const target = useMemo(() => (id ? targets.find((t) => t.id === id) ?? null : null), [targets, id]);
  return { ...rest, targets, target };
}

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  computeTargetProgress,
  currentTargets,
  mapTargetRow,
  recoveryInputsFromOverview,
  targetErrorMessage,
  toTargetWrite,
  type OwnerTarget,
  type TargetForm,
  type TargetProgress,
} from "@/lib/ownerTargets";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerOutcomesOverview } from "@/hooks/useOwnerOutcomesOverview";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";

const NO_TARGETS: OwnerTarget[] = [];

/** Mọi chỉ tiêu của không gian (cả kỳ cũ lẫn kỳ sắp tới) — ít dòng, tải một lần. */
export function useOwnerTargets(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.ownerTargets(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<OwnerTarget[]> => {
      const { data, error } = await supabase
        .from("owner_workspace_targets")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const t = mapTargetRow(row);
        return t ? [t] : [];
      });
    },
  });
  return { targets: query.data ?? NO_TARGETS, isLoading: query.isLoading };
}

interface SaveTargetInput {
  /** Có ⇒ sửa chỉ tiêu này; không ⇒ tạo mới. */
  id: string | null;
  form: TargetForm;
}

/**
 * Tạo / sửa chỉ tiêu. RLS lọc dòng không có quyền mà không báo lỗi ⇒ đọc lại
 * id để biết có thật sự ghi được không (chỉ Trưởng đơn vị ghi được).
 */
export function useSaveOwnerTarget(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, form }: SaveTargetInput) => {
      if (!workspaceId) throw new Error("no_workspace");
      const payload = toTargetWrite(form, workspaceId);
      const { data, error } = id
        ? await supabase
            .from("owner_workspace_targets")
            .update(payload)
            .eq("id", id)
            .eq("workspace_id", workspaceId)
            .select("id")
        : await supabase.from("owner_workspace_targets").insert(payload).select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
    },
    onSuccess: (_data, { id }) => toast.success(id ? "Đã cập nhật chỉ tiêu" : "Đã đặt chỉ tiêu"),
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
 * Chỉ tiêu + tiến độ của kỳ đang diễn ra cho "Nhịp đập". Số đã thu dựng từ CÙNG
 * các dòng của trang "Kết quả phiên" (useOwnerOutcomesOverview, chung cache) ⇒
 * cùng kỳ thì số tài sản đấu thành của hai màn khớp nhau.
 */
export function useOwnerTargetProgress() {
  const { workspaceId, role, branchScope, can } = useOwnerWorkspace();
  const { targets, isLoading: targetsLoading } = useOwnerTargets(workspaceId);
  const { rows, isLoading: rowsLoading } = useOwnerOutcomesOverview(workspaceId);
  const { data: branches = [], isLoading: branchesLoading } = useWorkspaceBranchOptions(workspaceId);

  const inputs = useMemo(() => recoveryInputsFromOverview(rows), [rows]);
  const today = todayIso();
  const progress = useMemo<TargetProgress[]>(
    () => currentTargets(targets, today).map((t) => computeTargetProgress(t, inputs, today)),
    [targets, inputs, today],
  );

  return {
    workspaceId,
    targets,
    progress,
    branches,
    /** Cán bộ bị giới hạn chi nhánh mở khối ở chi nhánh của mình (nếu có chỉ tiêu). */
    preferredBranchIds: role === "staff" ? branchScope ?? [] : [],
    canManage: can("manage_members"),
    isLoading: targetsLoading || rowsLoading || branchesLoading,
  };
}

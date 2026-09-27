import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertOwnerWsRpcOk } from "@/lib/ownerWorkspace/errors";
import {
  countOwnerMatrix,
  flattenOwnerMatrix,
  ownerMatrixFromRows,
  type OwnerPermissionMatrix,
} from "@/lib/ownerWorkspace/permissions";
import type { OwnerWsRoleRow } from "@/types/ownerRbac";

// Vai trò của MỘT Trạm Điều Hành (migration 20260927170100). Bảng owner_ws_roles /
// owner_ws_role_permissions KHÔNG có policy ghi — mọi thao tác đi qua RPC, trả
// `{ ok:false, reason }` cho thất bại dự kiến ⇒ luôn assertOwnerWsRpcOk. Toast do
// component gọi (ownerWsErrorMessage).

const asRows = (value: unknown): { module: string; action: string }[] =>
  Array.isArray(value)
    ? value.flatMap((v) =>
        v && typeof v === "object" && typeof v.module === "string" && typeof v.action === "string"
          ? [{ module: v.module, action: v.action }]
          : [],
      )
    : [];

export function useOwnerWsRoles(workspaceId: string | null) {
  return useQuery({
    queryKey: qk.ownerWorkspace.roles(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<OwnerWsRoleRow[]> => {
      const { data, error } = await supabase.rpc("owner_ws_list_roles", { p_workspace_id: workspaceId! });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const matrix = ownerMatrixFromRows(asRows(r.permissions));
        return {
          id: r.id,
          name: r.name,
          code: r.code,
          description: r.description,
          isSystem: r.is_system,
          matrix,
          permissionCount: countOwnerMatrix(matrix),
          memberCount: r.member_count,
          inviteCount: r.invite_count,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
    },
  });
}

/** Làm mới vai trò + thành viên của Trạm, và quyền của chính mình (memberships). */
function useInvalidateRoles(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.all(workspaceId) });
    // Prefix ["owner-ws-memberships"] — mọi người dùng trong cache (chỉ có người đang đăng nhập).
    void queryClient.invalidateQueries({ queryKey: [qk.ownerWorkspace.memberships()[0]] });
  };
}

export function useCreateOwnerWsRole(workspaceId: string | null) {
  const invalidate = useInvalidateRoles(workspaceId);
  return useMutation({
    mutationFn: async (input: { name: string; description: string; copyFromRoleId: string | null }) => {
      const { data, error } = await supabase.rpc("owner_ws_create_role", {
        p_workspace_id: workspaceId!,
        p_name: input.name,
        p_description: input.description,
        p_copy_from_role_id: input.copyFromRoleId ?? undefined,
      });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
      return (data as { id: string }).id;
    },
    onSettled: invalidate,
  });
}

export function useUpdateOwnerWsRole(workspaceId: string | null) {
  const invalidate = useInvalidateRoles(workspaceId);
  return useMutation({
    mutationFn: async (input: { roleId: string; name: string; description: string }) => {
      const { data, error } = await supabase.rpc("owner_ws_update_role", {
        p_role_id: input.roleId,
        p_name: input.name,
        p_description: input.description,
      });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
    },
    onSettled: invalidate,
  });
}

export function useDeleteOwnerWsRole(workspaceId: string | null) {
  const invalidate = useInvalidateRoles(workspaceId);
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { data, error } = await supabase.rpc("owner_ws_delete_role", { p_role_id: roleId });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
    },
    onSettled: invalidate,
  });
}

/** Thay NGUYÊN bộ quyền của vai trò (server tự thêm "Xem" của module có thao tác). */
export function useSetOwnerWsRolePermissions(workspaceId: string | null) {
  const invalidate = useInvalidateRoles(workspaceId);
  return useMutation({
    mutationFn: async (input: { roleId: string; matrix: OwnerPermissionMatrix }) => {
      const { data, error } = await supabase.rpc("owner_ws_set_role_permissions", {
        p_role_id: input.roleId,
        p_permissions: flattenOwnerMatrix(input.matrix),
      });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
    },
    onSettled: invalidate,
  });
}

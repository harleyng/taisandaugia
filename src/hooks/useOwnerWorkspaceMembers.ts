import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertOwnerWsRpcOk } from "@/lib/ownerWorkspace/errors";

// Thành viên + lời mời của MỘT không gian chủ tài sản (Phase 3).
// Mọi thao tác ghi đi qua RPC owner_ws_* (bảng không có policy ghi trực tiếp);
// RPC trả {ok:false, reason} ⇒ luôn assertOwnerWsRpcOk. Toast do component gọi.

export interface OwnerWorkspaceMember {
  memberId: string;
  userId: string;
  fullName: string | null;
  email: string;
  roleId: string;
  roleName: string;
  /** Vai trò hệ thống Trưởng đơn vị. */
  isOwner: boolean;
  branchScope: string[] | null;
  joinedAt: string | null;
}

export interface OwnerWorkspaceInvite {
  id: string;
  email: string;
  roleId: string | null;
  roleName: string;
  branchScope: string[] | null;
  token: string;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

export interface CreatedOwnerInvite {
  id: string;
  token: string;
  expires_at: string;
}

/** Danh sách thành viên kèm tên/email — qua RPC vì RLS profiles giấu hồ sơ đồng nghiệp. */
export function useOwnerWorkspaceMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: qk.ownerWorkspace.members(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<OwnerWorkspaceMember[]> => {
      const { data, error } = await supabase.rpc("owner_ws_list_members", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        memberId: row.member_id,
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        roleId: row.role_id,
        roleName: row.role_name,
        isOwner: row.is_owner,
        branchScope: row.branch_scope,
        joinedAt: row.joined_at,
      }));
    },
  });
}

/** Lời mời đang chờ — RLS chỉ cho người quản lý thành viên đọc (có token). */
export function useOwnerWorkspaceInvites(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.ownerWorkspace.invites(workspaceId),
    enabled: !!workspaceId && enabled,
    queryFn: async (): Promise<OwnerWorkspaceInvite[]> => {
      const { data, error } = await supabase
        .from("asset_owner_workspace_invites")
        .select(
          "id, email, role_id, branch_scope, token, expires_at, created_at, ws_role:owner_ws_roles!asset_owner_workspace_invites_role_id_fkey(name)",
        )
        .eq("workspace_id", workspaceId!)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        roleId: row.role_id,
        roleName: row.ws_role?.name ?? "Vai trò đã xoá",
        branchScope: row.branch_scope,
        token: row.token,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        isExpired: new Date(row.expires_at).getTime() <= now,
      }));
    },
  });
}

export function useCreateOwnerInvite(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      roleId: string;
      branchScope: string[] | null;
    }): Promise<CreatedOwnerInvite> => {
      const { data, error } = await supabase.rpc("owner_ws_create_invite", {
        p_workspace_id: workspaceId!,
        p_email: input.email,
        p_role_id: input.roleId,
        p_branch_scope: input.branchScope ?? undefined,
      });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
      return data as unknown as CreatedOwnerInvite;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.invites(workspaceId) }),
  });
}

export function useRevokeOwnerInvite(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabase.rpc("owner_ws_revoke_invite", { p_invite_id: inviteId });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.invites(workspaceId) }),
  });
}

export function useUpdateOwnerMember(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; roleId: string; branchScope: string[] | null }) => {
      const { data, error } = await supabase.rpc("owner_ws_update_member", {
        p_member_id: input.memberId,
        p_role_id: input.roleId,
        p_branch_scope: input.branchScope ?? undefined,
      });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
    },
    // Mất quyền mời cũng thu hồi lời mời người đó gửi; số thành viên của vai trò đổi
    // ⇒ làm mới cả không gian (gồm danh sách vai trò).
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.all(workspaceId) }),
  });
}

export function useRemoveOwnerMember(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.rpc("owner_ws_remove_member", { p_member_id: memberId });
      if (error) throw error;
      assertOwnerWsRpcOk(data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.all(workspaceId) }),
  });
}

export interface WorkspaceBranchOption {
  id: string;
  label: string;
  isActive: boolean;
  /** Để suy chi nhánh của một tin (claim.asset_owner_id ↔ chi nhánh) — Chỉ tiêu (Phase 9). */
  assetOwnerId: string | null;
}

/**
 * Danh sách chi nhánh gọn cho bộ chọn phạm vi + hiển thị phạm vi của thành viên.
 * Key riêng dưới không gian — KHÔNG dùng lại ["workspace_branches", id] của
 * useWorkspaceBranches vì hai bên select khác cột.
 */
export function useWorkspaceBranchOptions(workspaceId: string | null) {
  return useQuery({
    queryKey: [...qk.ownerWorkspace.all(workspaceId), "branch-options"],
    enabled: !!workspaceId,
    queryFn: async (): Promise<WorkspaceBranchOption[]> => {
      const { data, error } = await supabase
        .from("workspace_branches")
        .select("id, display_name, is_active, asset_owner_id, asset_owner:asset_owners(name)")
        .eq("workspace_id", workspaceId!)
        .order("display_name");
      if (error) throw error;
      return (data ?? []).map((b) => ({
        id: b.id,
        label: b.display_name || b.asset_owner?.name || "Chi nhánh chưa đặt tên",
        isActive: b.is_active,
        assetOwnerId: b.asset_owner_id,
      }));
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  flattenOrgMatrix,
  orgMatrixFromRows,
  type OrgPermissionMatrix,
} from "@/lib/orgPermissions";
import type { OrgRole, OrgRoleWithMeta } from "@/types/orgRbac";
import { qk } from "@/lib/queryKeys";

// ─── Reads ───────────────────────────────────────────────────────────────────

// Vai trò của MỘT tổ chức + số quyền + số thành viên đang mang vai trò đó
// (join client-side, kiểu useAdminRoles).
export function useOrgRoles(orgId?: string | null) {
  return useQuery<OrgRoleWithMeta[]>({
    queryKey: qk.orgRoles(orgId),
    enabled: !!orgId,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("org_roles")
        .select("id,organization_id,name,code,description,is_system,created_at")
        .eq("organization_id", orgId!)
        .order("is_system", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const roleIds = (roles ?? []).map((r) => r.id);
      if (roleIds.length === 0) return [];

      const [permsRes, membersRes] = await Promise.all([
        supabase.from("org_role_permissions").select("role_id").in("role_id", roleIds),
        supabase
          .from("organization_memberships")
          .select("role_id")
          .eq("organization_id", orgId!),
      ]);

      const permCount = new Map<string, number>();
      (permsRes.data ?? []).forEach((r) =>
        permCount.set(r.role_id, (permCount.get(r.role_id) ?? 0) + 1),
      );
      const memberCount = new Map<string, number>();
      (membersRes.data ?? []).forEach((r) =>
        memberCount.set(r.role_id, (memberCount.get(r.role_id) ?? 0) + 1),
      );

      return (roles ?? []).map((r) => ({
        ...r,
        permissionCount: permCount.get(r.id) ?? 0,
        memberCount: memberCount.get(r.id) ?? 0,
      }));
    },
  });
}

export interface OrgRoleDetail {
  role: OrgRole;
  matrix: OrgPermissionMatrix;
}

export function useOrgRole(id?: string) {
  return useQuery<OrgRoleDetail>({
    queryKey: ["org-role", id],
    enabled: !!id,
    queryFn: async () => {
      const [roleRes, permsRes] = await Promise.all([
        supabase
          .from("org_roles")
          .select("id,organization_id,name,code,description,is_system,created_at")
          .eq("id", id!)
          .single(),
        supabase.from("org_role_permissions").select("module,action").eq("role_id", id!),
      ]);
      if (roleRes.error) throw roleRes.error;
      return { role: roleRes.data, matrix: orgMatrixFromRows(permsRes.data ?? []) };
    },
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidateOrgRoles(
  qc: ReturnType<typeof useQueryClient>,
  orgId?: string | null,
  id?: string,
) {
  qc.invalidateQueries({ queryKey: qk.orgRoles(orgId) });
  if (id) qc.invalidateQueries({ queryKey: ["org-role", id] });
  // Sửa vai trò/quyền có thể đổi quyền hiệu lực của chính người đang thao tác.
  qc.invalidateQueries({ queryKey: qk.orgPermissions.all });
}

export function useCreateOrgRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      name,
      code,
      description,
    }: {
      orgId: string;
      name: string;
      code: string;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from("org_roles")
        .insert({
          organization_id: orgId,
          name,
          code,
          description: description || null,
          is_system: false,
        })
        .select("id,organization_id,name,code,description,is_system,created_at")
        .single();
      if (error) throw error;
      return data as OrgRole;
    },
    onSuccess: (_r, vars) => invalidateOrgRoles(qc, vars.orgId),
  });
}

export function useUpdateOrgRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
    }: {
      id: string;
      orgId: string;
      name: string;
      description?: string;
    }) => {
      const { error } = await supabase
        .from("org_roles")
        .update({ name, description: description || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateOrgRoles(qc, vars.orgId, vars.id),
  });
}

export function useDeleteOrgRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; orgId: string }) => {
      const { error } = await supabase.from("org_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateOrgRoles(qc, vars.orgId),
  });
}

// Thay TOÀN BỘ ma trận quyền của vai trò qua RPC atomic (delete-all-then-insert).
export function useSetOrgRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roleId,
      matrix,
    }: {
      roleId: string;
      orgId: string;
      matrix: OrgPermissionMatrix;
    }) => {
      const { error } = await supabase.rpc("org_set_role_permissions", {
        _role_id: roleId,
        _perms: flattenOrgMatrix(matrix),
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateOrgRoles(qc, vars.orgId, vars.roleId),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { flattenMatrix, matrixFromRows, type PermissionMatrix } from "@/lib/adminPermissions";
import type { AdminRole, AdminRoleWithMeta } from "@/types/adminRbac";
import { qk } from "@/lib/queryKeys";

// ─── Reads ───────────────────────────────────────────────────────────────────

// Danh sách vai trò + số quyền + số tài khoản được gán (join client-side, kiểu
// useAdminUsers — admin đọc được cả 3 bảng qua RLS admin-read).
export function useAdminRoles() {
  return useQuery<AdminRoleWithMeta[]>({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const [rolesRes, permsRes, assignsRes] = await Promise.all([
        supabase
          .from("admin_roles")
          .select("id,name,code,description,is_system,created_at")
          .order("is_system", { ascending: false })
          .order("created_at", { ascending: true }),
        supabase.from("admin_role_permissions").select("role_id"),
        supabase.from("admin_role_assignments").select("role_id"),
      ]);
      if (rolesRes.error) throw rolesRes.error;

      const permCount = new Map<string, number>();
      (permsRes.data ?? []).forEach((r) => permCount.set(r.role_id, (permCount.get(r.role_id) ?? 0) + 1));
      const assignCount = new Map<string, number>();
      (assignsRes.data ?? []).forEach((r) => assignCount.set(r.role_id, (assignCount.get(r.role_id) ?? 0) + 1));

      return (rolesRes.data ?? []).map((r) => ({
        ...r,
        permissionCount: permCount.get(r.id) ?? 0,
        assignedCount: assignCount.get(r.id) ?? 0,
      }));
    },
  });
}

export interface AdminRoleDetail {
  role: AdminRole;
  matrix: PermissionMatrix;
}

export function useAdminRole(id?: string) {
  return useQuery<AdminRoleDetail>({
    queryKey: ["admin-role", id],
    enabled: !!id,
    queryFn: async () => {
      const [roleRes, permsRes] = await Promise.all([
        supabase
          .from("admin_roles")
          .select("id,name,code,description,is_system,created_at")
          .eq("id", id!)
          .single(),
        supabase.from("admin_role_permissions").select("module,action").eq("role_id", id!),
      ]);
      if (roleRes.error) throw roleRes.error;
      return { role: roleRes.data, matrix: matrixFromRows(permsRes.data ?? []) };
    },
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidateRoles(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["admin-roles"] });
  if (id) qc.invalidateQueries({ queryKey: ["admin-role", id] });
  // Đổi vai trò/quyền có thể đổi quyền hiệu lực của admin hiện tại.
  qc.invalidateQueries({ queryKey: qk.adminPermissions.all });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, code, description }: { name: string; code: string; description?: string }) => {
      const { data, error } = await supabase
        .from("admin_roles")
        .insert({ name, code, description: description || null, is_system: false })
        .select("id,name,code,description,is_system,created_at")
        .single();
      if (error) throw error;
      return data as AdminRole;
    },
    onSuccess: () => invalidateRoles(qc),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase
        .from("admin_roles")
        .update({ name, description: description || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateRoles(qc, vars.id),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRoles(qc),
  });
}

// Thay TOÀN BỘ ma trận quyền của vai trò qua RPC atomic (delete-all-then-insert).
export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, matrix }: { roleId: string; matrix: PermissionMatrix }) => {
      const { error } = await supabase.rpc("admin_set_role_permissions", {
        _role_id: roleId,
        _perms: flattenMatrix(matrix),
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateRoles(qc, vars.roleId),
  });
}

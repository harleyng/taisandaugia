import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeMessage } from "@/hooks/useAdminUsers";
import type { AdminAccount, AdminAccountDetail } from "@/types/adminRbac";
import { qk } from "@/lib/queryKeys";

// ─── Reads ───────────────────────────────────────────────────────────────────

type ProfileRow = { id: string; email: string; name: string | null; created_at: string; status: string };
type AssignRow = { user_id: string; role_id: string; admin_roles: { id: string; name: string; code: string } | null };

// Danh sách tài khoản quản trị = user có role ADMIN, kèm các vai trò RBAC được
// gán. Join client-side (kiểu useAdminUsers).
export function useAdminAccounts() {
  return useQuery<AdminAccount[]>({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const { data: adminRoleRows, error: arErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "ADMIN");
      if (arErr) throw arErr;
      const adminIds = (adminRoleRows ?? []).map((r) => r.user_id);
      if (adminIds.length === 0) return [];

      const [profilesRes, assignsRes] = await Promise.all([
        supabase.from("profiles").select("id,email,name,created_at,status").in("id", adminIds),
        supabase
          .from("admin_role_assignments")
          .select("user_id,role_id,admin_roles(id,name,code)")
          .in("user_id", adminIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const rolesByUser = new Map<string, { id: string; name: string; code: string }[]>();
      ((assignsRes.data ?? []) as unknown as AssignRow[]).forEach((a) => {
        if (!a.admin_roles) return;
        const list = rolesByUser.get(a.user_id) ?? [];
        list.push(a.admin_roles);
        rolesByUser.set(a.user_id, list);
      });

      return (profilesRes.data ?? []).map((p: ProfileRow) => {
        const roles = rolesByUser.get(p.id) ?? [];
        return {
          userId: p.id,
          email: p.email,
          name: p.name,
          created_at: p.created_at,
          lockStatus: p.status === "locked" ? "locked" : "active",
          isSuperAdmin: roles.some((r) => r.code === "SUPER_ADMIN"),
          roles,
        } as AdminAccount;
      });
    },
  });
}

// Chi tiết một tài khoản quản trị: hồ sơ + các vai trò được gán (kèm metadata).
type DetailAssignRow = {
  id: string;
  assigned_at: string;
  role_id: string;
  admin_roles: { id: string; name: string; code: string; description: string | null; is_system: boolean } | null;
};

export function useAdminAccount(userId?: string) {
  return useQuery<AdminAccountDetail>({
    queryKey: ["admin-account", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, assignsRes] = await Promise.all([
        supabase.from("profiles").select("id,email,name,created_at,status").eq("id", userId!).single(),
        supabase
          .from("admin_role_assignments")
          .select("id,assigned_at,role_id,admin_roles(id,name,code,description,is_system)")
          .eq("user_id", userId!)
          .order("assigned_at", { ascending: true }),
      ]);
      if (profileRes.error) throw profileRes.error;
      const p = profileRes.data as ProfileRow;

      const assignments = ((assignsRes.data ?? []) as unknown as DetailAssignRow[])
        .filter((r) => r.admin_roles)
        .map((r) => ({ id: r.id, assigned_at: r.assigned_at, role: r.admin_roles! }));

      return {
        account: {
          userId: p.id,
          email: p.email,
          name: p.name,
          created_at: p.created_at,
          lockStatus: p.status === "locked" ? "locked" : "active",
          isSuperAdmin: assignments.some((a) => a.role.code === "SUPER_ADMIN"),
          roles: assignments.map((a) => a.role),
        },
        assignments,
      };
    },
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidateAccounts(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  qc.invalidateQueries({ queryKey: ["admin-accounts"] });
  qc.invalidateQueries({ queryKey: qk.adminUsers.all });
  qc.invalidateQueries({ queryKey: qk.adminPermissions.all });
  if (userId) qc.invalidateQueries({ queryKey: ["admin-account", userId] });
}

async function assignRoles(userId: string, roleIds: string[]) {
  if (roleIds.length === 0) return;
  const { error } = await supabase
    .from("admin_role_assignments")
    .upsert(
      roleIds.map((role_id) => ({ user_id: userId, role_id })),
      { onConflict: "user_id,role_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

// Tạo tài khoản admin MỚI (cần GoTrue → edge fn), rồi gán vai trò đã chọn.
export function useCreateAdminAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, name, roleIds }: { email: string; name: string; roleIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", {
        body: { action: "create", email, name, makeAdmin: true, redirectTo: `${window.location.origin}/tao-mat-khau` },
      });
      if (error) throw new Error(await invokeMessage(error));
      const res = data as { userId: string; email: string; actionLink: string | null };
      await assignRoles(res.userId, roleIds);
      return res;
    },
    onSuccess: (res) => invalidateAccounts(qc, res.userId),
  });
}

// Thăng cấp một user hiện có thành admin + gán vai trò.
export function usePromoteToAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "ADMIN" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw error;
      await assignRoles(userId, roleIds);
    },
    onSuccess: (_r, vars) => invalidateAccounts(qc, vars.userId),
  });
}

// "Xóa" tài khoản admin = thu hồi quyền: gỡ mọi vai trò RBAC + role ADMIN.
// Tài khoản đăng nhập vẫn còn (trở thành user thường).
export function useRevokeAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error: aErr } = await supabase.from("admin_role_assignments").delete().eq("user_id", userId);
      if (aErr) throw aErr;
      const { error: rErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "ADMIN");
      if (rErr) throw rErr;
    },
    onSuccess: (_r, userId) => invalidateAccounts(qc, userId),
  });
}

// Gán THÊM vai trò cho tài khoản (chỉ thêm — dùng ở dialog "Gán vai trò").
export function useAddAccountRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      await assignRoles(userId, roleIds);
      return userId;
    },
    onSuccess: (userId) => invalidateAccounts(qc, userId),
  });
}

// Gỡ MỘT vai trò khỏi tài khoản (theo id bản ghi gán).
export function useRemoveAccountRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, userId }: { assignmentId: string; userId: string }) => {
      const { error } = await supabase.from("admin_role_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => invalidateAccounts(qc, userId),
  });
}

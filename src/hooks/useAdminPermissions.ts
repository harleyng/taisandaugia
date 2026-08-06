import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  emptyMatrix,
  fullMatrix,
  matrixFromRows,
  matrixHas,
  type AdminAction,
  type PermissionMatrix,
} from "@/lib/adminPermissions";
import { qk } from "@/lib/queryKeys";

export interface AdminPermState {
  isSuperAdmin: boolean;
  matrix: PermissionMatrix; // quyền hiệu lực (hợp mọi vai trò được gán)
  ready: boolean; // đã nạp xong (dùng cho guard/nav để tránh nháy)
}

// Nạp quyền hiệu lực của admin ĐANG đăng nhập: hợp các quyền của mọi vai trò
// được gán, hoặc toàn quyền nếu có vai trò SUPER_ADMIN. Chỉ để dựng UI / gate —
// cổng thật vẫn là RLS ở database.
export function useAdminPermissions(): AdminPermState {
  const { userId } = useAuth();

  const q = useQuery({
    queryKey: qk.adminPermissions.byUser(userId),
    enabled: !!userId,
    queryFn: async (): Promise<{ isSuperAdmin: boolean; matrix: PermissionMatrix }> => {
      // 1) Vai trò được gán cho user hiện tại.
      const { data: assigns, error } = await supabase
        .from("admin_role_assignments")
        .select("role_id")
        .eq("user_id", userId!);
      if (error) throw error;

      const roleIds = (assigns ?? []).map((a) => a.role_id);
      if (roleIds.length === 0) return { isSuperAdmin: false, matrix: emptyMatrix() };

      // 2) SUPER_ADMIN đi tắt (toàn quyền).
      const { data: roles, error: rErr } = await supabase
        .from("admin_roles")
        .select("id,code")
        .in("id", roleIds);
      if (rErr) throw rErr;
      if ((roles ?? []).some((r) => r.code === "SUPER_ADMIN")) {
        return { isSuperAdmin: true, matrix: fullMatrix() };
      }

      // 3) Hợp quyền của các vai trò.
      const { data: perms, error: pErr } = await supabase
        .from("admin_role_permissions")
        .select("module,action")
        .in("role_id", roleIds);
      if (pErr) throw pErr;

      return { isSuperAdmin: false, matrix: matrixFromRows(perms ?? []) };
    },
  });

  return {
    isSuperAdmin: q.data?.isSuperAdmin ?? false,
    matrix: q.data?.matrix ?? emptyMatrix(),
    ready: !!userId && !q.isLoading, // fail-closed: lỗi/tải xong mà thiếu quyền → chặn
  };
}

// Kiểm tra 1 quyền cụ thể (dùng để ẩn/hiện nút & lọc nav).
export function useHasAdminPermission(module: string, action: AdminAction = "view"): boolean {
  const { isSuperAdmin, matrix } = useAdminPermissions();
  return isSuperAdmin || matrixHas(matrix, module, action);
}

export function useCanViewModule(module: string): boolean {
  return useHasAdminPermission(module, "view");
}

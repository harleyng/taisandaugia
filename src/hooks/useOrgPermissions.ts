import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import {
  emptyOrgMatrix,
  fullOrgMatrix,
  orgMatrixFromRows,
  orgMatrixHas,
  type OrgAction,
  type OrgPermissionMatrix,
} from "@/lib/orgPermissions";
import { qk } from "@/lib/queryKeys";

export interface OrgPermState {
  isOwner: boolean;
  matrix: OrgPermissionMatrix; // quyền hiệu lực trong tổ chức đang chọn
  ready: boolean; // đã nạp xong (dùng cho guard/nav để tránh nháy)
}

/**
 * Quyền hiệu lực của user trong MỘT tổ chức. Chủ sở hữu đi tắt (toàn quyền).
 * Chỉ để dựng UI / gate — cổng thật là RLS + org_has_permission() ở database.
 *
 * Vai trò lấy từ useMyOrganizations (đã cache) nên hook này chỉ tốn thêm đúng
 * một query org_role_permissions.
 */
export function useOrgPermissions(orgId?: string | null): OrgPermState {
  const { userId } = useAuth();
  const { orgs, currentOrgId, loading } = useOrg();
  const targetId = orgId ?? currentOrgId;
  const membership = orgs.find((o) => o.id === targetId);
  const roleId = membership?.roleId ?? null;
  const isOwner = membership?.roleCode === "OWNER";

  const q = useQuery({
    queryKey: qk.orgPermissions.byTarget(targetId, userId),
    enabled: !!targetId && !!roleId && !isOwner,
    queryFn: async (): Promise<OrgPermissionMatrix> => {
      const { data, error } = await supabase
        .from("org_role_permissions")
        .select("module,action")
        .eq("role_id", roleId!);
      if (error) throw error;
      return orgMatrixFromRows(data ?? []);
    },
  });

  if (isOwner) {
    return { isOwner: true, matrix: fullOrgMatrix(), ready: true };
  }

  return {
    isOwner: false,
    matrix: q.data ?? emptyOrgMatrix(),
    // fail-closed: chưa resolve xong tổ chức/vai trò → coi như chưa sẵn sàng.
    ready: !loading && !!targetId && !!roleId && !q.isLoading,
  };
}

// Kiểm tra 1 quyền cụ thể (dùng để ẩn/hiện nút & lọc nav).
export function useHasOrgPermission(module: string, action: OrgAction = "view"): boolean {
  const { isOwner, matrix } = useOrgPermissions();
  return isOwner || orgMatrixHas(matrix, module, action);
}

export function useCanViewOrgModule(module: string): boolean {
  return useHasOrgPermission(module, "view");
}

import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOrgPermissions, useHasOrgPermission } from "@/hooks/useOrgPermissions";
import type { OrgAction } from "@/lib/orgPermissions";

/**
 * Cổng quyền cho từng trang trong portal tổ chức (/portal).
 * RLS + org_has_permission() ở database vẫn là cổng thật cho dữ liệu; đây chỉ
 * chặn lộ giao diện.
 *
 * LƯU Ý: /portal/dashboard KHÔNG được bọc bằng component này — thành viên thiếu
 * quyền 'tong-quan' sẽ nhảy vòng vô tận. Dashboard tự render empty state.
 */
export function PortalPermissionRoute({
  module,
  action = "view",
  children,
}: {
  module: string;
  action?: OrgAction;
  children: ReactNode;
}) {
  const { ready } = useOrgPermissions();
  const allowed = useHasOrgPermission(module, action);

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return allowed ? <>{children}</> : <Navigate to="/portal/dashboard" replace />;
}

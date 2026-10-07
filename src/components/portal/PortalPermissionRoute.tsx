import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOrgPermissions } from "@/hooks/useOrgPermissions";
import { orgMatrixHas, type OrgAction } from "@/lib/orgPermissions";

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
  anyOf,
  children,
}: {
  module: string;
  action?: OrgAction;
  /** Qua được khi có MỘT trong các quyền này (thay cho `action`). */
  anyOf?: OrgAction[];
  children: ReactNode;
}) {
  const { ready, isOwner, matrix } = useOrgPermissions();
  const allowed = isOwner || (anyOf ?? [action]).some((a) => orgMatrixHas(matrix, module, a));

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return allowed ? <>{children}</> : <Navigate to="/portal/dashboard" replace />;
}

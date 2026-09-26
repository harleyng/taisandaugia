import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { matrixHas, type AdminAction } from "@/lib/adminPermissions";

/**
 * Cổng quyền cho từng trang trong khu /admin (defense-in-depth trên AdminRoute).
 * RLS ở database vẫn là cổng thật cho dữ liệu; đây chỉ chặn lộ giao diện.
 *
 * `module` = một module cụ thể; `anyOf` = trang gộp nhiều module (VD Yêu cầu dịch vụ),
 * vào được khi có quyền ở ÍT NHẤT một module.
 */
export function AdminPermissionRoute({
  module,
  anyOf,
  action = "view",
  children,
}: ({ module: string; anyOf?: never } | { anyOf: readonly string[]; module?: never }) & {
  action?: AdminAction;
  children: ReactNode;
}) {
  const { ready, isSuperAdmin, matrix } = useAdminPermissions();
  const modules = anyOf ?? [module];
  const allowed = isSuperAdmin || modules.some((m) => matrixHas(matrix, m, action));

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return allowed ? <>{children}</> : <Navigate to="/admin" replace />;
}

import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAdminPermissions, useHasAdminPermission } from "@/hooks/useAdminPermissions";
import type { AdminAction } from "@/lib/adminPermissions";

/**
 * Cổng quyền cho từng trang trong khu /admin (defense-in-depth trên AdminRoute).
 * RLS ở database vẫn là cổng thật cho dữ liệu; đây chỉ chặn lộ giao diện.
 */
export function AdminPermissionRoute({
  module,
  action = "view",
  children,
}: {
  module: string;
  action?: AdminAction;
  children: ReactNode;
}) {
  const { ready } = useAdminPermissions();
  const allowed = useHasAdminPermission(module, action);

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return allowed ? <>{children}</> : <Navigate to="/admin" replace />;
}

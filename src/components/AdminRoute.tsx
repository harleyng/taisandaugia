import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Cổng cho toàn bộ khu `/admin`.
 *
 * Chặn ở HAI mức, khớp với RLS phía database:
 * 1. Chưa đăng nhập → về trang đăng nhập.
 * 2. Đã đăng nhập nhưng KHÔNG có role ADMIN → về trang chủ.
 *
 * Không có bước 2 thì bất kỳ ai cũng mở được giao diện admin (RLS vẫn
 * che dữ liệu, nhưng cấu trúc/route admin bị lộ).
 */
export const AdminRoute = () => {
  const { session, userId, loading } = useAuth();
  const location = useLocation();

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "ADMIN")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  if (loading || (session && roleLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

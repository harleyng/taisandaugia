import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const AdminRoute = () => {
  const [status, setStatus] = useState<"loading" | "admin" | "denied">("loading");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setStatus("denied"); return; }

      const { data } = await supabase
        .from("user_roles")
        .select("app_role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      setStatus(data?.app_role === "ADMIN" ? "admin" : "denied");
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Đang xác thực quyền truy cập...
      </div>
    );
  }

  if (status === "denied") return <Navigate to="/" replace />;

  return <Outlet />;
};

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  roles?: string[];
  adminOnly?: boolean;
}

export const ProtectedRoute = ({ roles, adminOnly }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);

        if (session) {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id);

          if (rolesData) {
            setUserRoles(rolesData.map((r) => r.role));
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        setUserRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    // Admin routes redirect to admin login
    if (adminOnly) {
      return <Navigate to="/admin/login" replace />;
    }
    // Regular routes redirect to marketplace auth
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Block ADMIN users from accessing non-admin routes
  const isAdmin = userRoles.includes("ADMIN");
  if (!adminOnly && isAdmin) {
    // ADMIN trying to access marketplace - redirect to admin login
    return <Navigate to="/admin/login" replace />;
  }

  // Check admin-only routes
  if (adminOnly && !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};
